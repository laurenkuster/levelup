import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { getDexDashboard, zoneScores, loadDexHistory } from '../services/dexService';

const StatDexScreen = ({ navigation }) => {
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const [dash, hist] = await Promise.all([
            getDexDashboard(),
            loadDexHistory(),
          ]);
          setDashboard(dash);
          setHistory(hist);
        } catch (e) {
          console.error('[StatDex] load error:', e);
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading || !dashboard) {
    return (
      <SafeAreaView style={styles.container}>
        <Header navigation={navigation} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      </SafeAreaView>
    );
  }

  const { level, progress, rank, totalXp, xpCurrent, xpNeeded, zones } = dashboard;
  const scoredZones = zoneScores(zones);
  const last7 = history.slice(0, 7);
  const maxScore = Math.max(...last7.map((h) => h.dexScore), 1);

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} level={level} progress={progress} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Overall DEX Panel ── */}
        <View style={styles.panel}>
          <View style={styles.panelCorner} />
          <View style={[styles.panelCorner, { right: 2, left: undefined }]} />
          <View style={[styles.panelCorner, { bottom: 2, top: undefined }]} />
          <View style={[styles.panelCorner, { bottom: 2, right: 2, left: undefined, top: undefined }]} />

          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>TOTAL EXPERIENCE</Text>
            <Text style={styles.xpValue}>{totalXp.toLocaleString()}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubText}>{xpCurrent} / {xpNeeded} to next level</Text>
          </View>
          <Text style={styles.rankText}>[ {rank} ]</Text>
        </View>

        {/* ── Flexibility Zone Scores ── */}
        <View style={styles.sectionRow}>
          <MaterialCommunityIcons name="yoga" size={18} color="#f97316" />
          <Text style={styles.sectionTitle}>FLEXIBILITY ZONES</Text>
          <View style={styles.sectionLine} />
        </View>

        {scoredZones.map((z) => (
          <View key={z.key}>
            <Pressable style={styles.zoneCard} onPress={() => toggleExpand(z.key)}>
              <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.zoneHeaderRow}>
                  <Text style={styles.zoneName}>{z.label.toUpperCase()}</Text>
                  <View style={[styles.zoneLevelBadge, { borderColor: `${z.color}55`, backgroundColor: `${z.color}15` }]}>
                    <Text style={[styles.zoneLevelText, { color: z.color }]}>LVL {z.level}</Text>
                  </View>
                  <Text style={styles.zoneScore}>{z.score}</Text>
                </View>
                <View style={styles.zoneTrack}>
                  <View style={[styles.zoneFill, { width: `${Math.round(z.progress * 100)}%`, backgroundColor: z.color }]} />
                </View>
              </View>
              <MaterialIcons
                name={expanded[z.key] ? 'expand-less' : 'expand-more'}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>

            {expanded[z.key] && (
              <View style={styles.subsectionWrap}>
                {z.subsections.map((sub) => (
                  <View key={sub.key} style={styles.subRow}>
                    <View style={[styles.subDot, { backgroundColor: z.color }]} />
                    <Text style={styles.subName}>{sub.label}</Text>
                    <View style={styles.subTrackOuter}>
                      <View style={[styles.subTrackFill, { width: `${Math.round(sub.progress * 100)}%`, backgroundColor: z.color }]} />
                    </View>
                    <Text style={styles.subLevel}>LVL {sub.level}</Text>
                    <Text style={styles.subXP}>{sub.xp} XP</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* ── Recent Sessions ── */}
        {last7.length > 0 && (
          <>
            <View style={[styles.sectionRow, { marginTop: spacing.base }]}>
              <MaterialIcons name="history" size={18} color="#f97316" />
              <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.panel}>
              {last7.map((session) => (
                <View key={session.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{session.date.slice(5)}</Text>
                  <View style={styles.historyBarOuter}>
                    <View style={[styles.historyBarFill, { width: `${Math.round((session.dexScore / maxScore) * 100)}%` }]} />
                  </View>
                  <View style={styles.historyStats}>
                    <Text style={styles.historyScore}>{session.dexScore}</Text>
                    <Text style={styles.historyXP}>+{session.totalXp} XP</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Tip ── */}
        <View style={styles.tipPanel}>
          <MaterialIcons name="info-outline" size={22} color="#f97316" />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>FLEXIBILITY TIP</Text>
            <Text style={styles.tipBody}>
              Log your stretching and yoga to level up each flexibility zone.
              Longer holds and higher difficulty stretches earn more XP.
              Consistency is the key to unlocking mobility gains.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Header = ({ navigation, level = 1, progress = 0 }) => (
  <View style={styles.header}>
    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
      <MaterialIcons name="arrow-back" size={22} color="#f97316" />
    </Pressable>
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>DEX - LVL {level}</Text>
      <View style={styles.headerTrack}>
        <View style={[styles.headerFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
      <MaterialIcons name="close" size={22} color="#f97316" />
    </Pressable>
  </View>
);

const ACCENT = '#f97316';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(249,115,22,0.35)',
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },
  headerTrack: { marginTop: spacing.xs, width: 120, height: 4, backgroundColor: colors.disabled },
  headerFill: { height: '100%', backgroundColor: ACCENT },

  content: { padding: spacing.base, paddingBottom: spacing.xxxl, gap: spacing.sm },

  panel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: spacing.cardPadding, gap: spacing.sm,
    position: 'relative',
  },
  panelCorner: { position: 'absolute', top: 2, left: 2, width: 6, height: 6, backgroundColor: ACCENT },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  xpLabel: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  xpValue: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xxl },
  track: { height: 12, backgroundColor: colors.disabled, borderWidth: 1, borderColor: '#475569', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: ACCENT },
  xpSubRow: { alignItems: 'flex-end' },
  xpSubText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  rankText: { color: colors.textSecondary, textAlign: 'center', fontFamily: typography.family.mono, fontSize: typography.size.lg },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  zoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.disabled,
    padding: spacing.md,
  },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },
  zoneHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  zoneName: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, flex: 1 },
  zoneLevelBadge: { paddingHorizontal: 6, paddingVertical: spacing.valueLabelGap, borderWidth: 1, borderRadius: 2 },
  zoneLevelText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  zoneScore: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.xl, width: 30, textAlign: 'right' },
  zoneTrack: { height: 6, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#475569', overflow: 'hidden' },
  zoneFill: { height: '100%' },

  subsectionWrap: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.disabled,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subDot: { width: 5, height: 5, borderRadius: 3 },
  subName: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 90 },
  subTrackOuter: { flex: 1, height: 5, backgroundColor: colors.surfaceAlt, borderRadius: 2, overflow: 'hidden' },
  subTrackFill: { height: '100%', borderRadius: 2 },
  subLevel: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, width: 36 },
  subXP: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.md, width: 48, textAlign: 'right' },

  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDate: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 40 },
  historyBarOuter: {
    flex: 1, height: 10, backgroundColor: colors.surfaceAlt,
    borderRadius: 2, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    overflow: 'hidden',
  },
  historyBarFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  historyStats: { alignItems: 'flex-end', width: 80 },
  historyScore: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  historyXP: { color: ACCENT, fontFamily: typography.family.mono, fontSize: typography.size.md },

  tipPanel: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm,
  },
  tipTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginBottom: spacing.xs },
  tipBody: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: 22 },
});

export default StatDexScreen;
