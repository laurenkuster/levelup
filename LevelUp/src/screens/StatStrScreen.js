import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { getStrDashboard, bodyPartScores, loadStrHistory, loadStrLogs } from '../services/strService';
import { classifyUserLifts } from '../services/strengthStandardsService';

const ACCENT = '#ef4444';

const StatStrScreen = ({ navigation }) => {
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [liftRankings, setLiftRankings] = useState([]);
  const [expanded, setExpanded] = useState({}); // { [bodyPartKey]: true }
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const [dash, hist, logs] = await Promise.all([
            getStrDashboard(),
            loadStrHistory(),
            loadStrLogs(),
          ]);
          setDashboard(dash);
          setHistory(hist);
          // Classify core lifts against strength standards
          const rankings = classifyUserLifts(logs, { sex: 'M', bodyweightLbs: 170 });
          setLiftRankings(rankings);
        } catch (e) {
          console.error('[StatStr] load error:', e);
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
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  const { level, progress, rank, totalXp, xpCurrent, xpNeeded, bodyParts } = dashboard;
  const scoredParts = bodyPartScores(bodyParts);

  // Recent sessions (last 7 days)
  const last7 = history.slice(0, 7);
  const maxScore = Math.max(...last7.map((h) => h.strengthScore), 1);

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} level={level} progress={progress} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Overall STR Panel ── */}
        <View style={styles.panel}>
          <View style={styles.panelCorner} />
          <View style={[styles.panelCorner, { right: 2, left: undefined }]} />
          <View style={[styles.panelCorner, { bottom: 2, top: undefined }]} />
          <View style={[styles.panelCorner, { bottom: 2, right: 2, left: undefined, top: undefined }]} />

          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>TOTAL EXPERIENCE</Text>
            <Text style={styles.xpValue}>
              {totalXp.toLocaleString()}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.xpSubRow}>
            <Text style={styles.xpSubText}>{xpCurrent} / {xpNeeded} to next level</Text>
          </View>
          <Text style={styles.rankText}>[ {rank} ]</Text>
        </View>

        {/* ── Body Part Scores ── */}
        <View style={styles.sectionRow}>
          <MaterialCommunityIcons name="dumbbell" size={18} color={ACCENT} />
          <Text style={styles.sectionTitle}>BODY PART SCORES</Text>
          <View style={styles.sectionLine} />
        </View>

        {scoredParts.map((bp) => (
          <View key={bp.key}>
            {/* Body part header */}
            <Pressable
              style={styles.bodyPartCard}
              onPress={() => toggleExpand(bp.key)}
            >
              <View style={[styles.bpDot, { backgroundColor: bp.color }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.bpHeaderRow}>
                  <Text style={styles.bpName}>{bp.label.toUpperCase()}</Text>
                  <View style={[styles.bpLevelBadge, { borderColor: `${bp.color}55`, backgroundColor: `${bp.color}15` }]}>
                    <Text style={[styles.bpLevelText, { color: bp.color }]}>LVL {bp.level}</Text>
                  </View>
                  <Text style={styles.bpScore}>{bp.score}</Text>
                </View>
                <View style={styles.bpTrack}>
                  <View style={[styles.bpFill, { width: `${Math.round(bp.progress * 100)}%`, backgroundColor: bp.color }]} />
                </View>
              </View>
              <MaterialIcons
                name={expanded[bp.key] ? 'expand-less' : 'expand-more'}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>

            {/* Expanded subsections */}
            {expanded[bp.key] && (
              <View style={styles.subsectionWrap}>
                {bp.subsections.map((sub) => (
                  <View key={sub.key} style={styles.subRow}>
                    <View style={[styles.subDot, { backgroundColor: bp.color }]} />
                    <Text style={styles.subName}>{sub.label}</Text>
                    <View style={styles.subTrackOuter}>
                      <View
                        style={[
                          styles.subTrackFill,
                          {
                            width: `${Math.round(sub.progress * 100)}%`,
                            backgroundColor: bp.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.subLevel}>LVL {sub.level}</Text>
                    <Text style={styles.subXP}>{sub.xp} XP</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* ── Lift Rankings ── */}
        {liftRankings.length > 0 && (
          <>
            <View style={[styles.sectionRow, { marginTop: spacing.base }]}>
              <MaterialCommunityIcons name="trophy" size={18} color={ACCENT} />
              <Text style={styles.sectionTitle}>LIFT RANKINGS</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.panel}>
              {liftRankings.map((lift) => (
                <View key={lift.exerciseId} style={styles.rankRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankExercise}>{lift.exerciseName.toUpperCase()}</Text>
                    <Text style={styles.rankOneRM}>1RM: {lift.oneRM} lbs</Text>
                  </View>
                  <View style={styles.rankBadgeWrap}>
                    <View style={[styles.rankBadge, { borderColor: lift.color, backgroundColor: `${lift.color}18` }]}>
                      <MaterialCommunityIcons name={lift.icon} size={14} color={lift.color} />
                      <Text style={[styles.rankBadgeText, { color: lift.color }]}>{lift.label.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.rankPercentile}>P{lift.percentile}</Text>
                  </View>
                  {lift.nextTier && (
                    <Text style={styles.rankDeficit}>
                      +{lift.deficit} lbs → {lift.nextTier}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Recent Sessions ── */}
        {last7.length > 0 && (
          <>
            <View style={[styles.sectionRow, { marginTop: spacing.base }]}>
              <MaterialIcons name="history" size={18} color={ACCENT} />
              <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.panel}>
              {last7.map((session) => (
                <View key={session.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{session.date.slice(5)}</Text>
                  <View style={styles.historyBarOuter}>
                    <View
                      style={[
                        styles.historyBarFill,
                        { width: `${Math.round((session.strengthScore / maxScore) * 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.historyStats}>
                    <Text style={styles.historyScore}>{session.strengthScore}</Text>
                    <Text style={styles.historyXP}>+{session.totalXp} XP</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Training Tip ── */}
        <View style={styles.tipPanel}>
          <MaterialIcons name="info-outline" size={22} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>TRAINING TIP</Text>
            <Text style={styles.tipBody}>
              Log your strength workouts to level up each body part.
              Heavier weights and higher volume earn more XP.
              The Epley formula estimates your 1-rep max from each set.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── Header sub-component ── */
const Header = ({ navigation, level = 1, progress = 0 }) => (
  <View style={styles.header}>
    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
      <MaterialIcons name="arrow-back" size={22} color={ACCENT} />
    </Pressable>
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>STR - LVL {level}</Text>
      <View style={styles.headerTrack}>
        <View style={[styles.headerFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
      <MaterialIcons name="close" size={22} color={ACCENT} />
    </Pressable>
  </View>
);

/* ═══════════ STYLES ═══════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* header */
  header: {
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: ACCENT + '55',
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },
  headerTrack: { marginTop: spacing.xs, width: 120, height: 4, backgroundColor: colors.disabled },
  headerFill: { height: '100%', backgroundColor: ACCENT },

  content: { padding: spacing.base, paddingBottom: spacing.xxxl, gap: spacing.sm },

  /* overall panel */
  panel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: spacing.cardPadding, gap: spacing.sm,
    position: 'relative',
  },
  panelCorner: { position: 'absolute', top: 2, left: 2, width: 6, height: 6, backgroundColor: ACCENT },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  xpLabel: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  xpValue: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xxl },
  track: {
    height: 12, backgroundColor: colors.disabled,
    borderWidth: 1, borderColor: '#475569',
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: ACCENT },
  xpSubRow: { alignItems: 'flex-end' },
  xpSubText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  rankText: { color: colors.textSecondary, textAlign: 'center', fontFamily: typography.family.mono, fontSize: typography.size.lg },

  /* section header */
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  sectionTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  /* body part cards */
  bodyPartCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.disabled,
    padding: spacing.md,
  },
  bpDot: { width: 10, height: 10, borderRadius: 5 },
  bpHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  bpName: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm, flex: 1 },
  bpLevelBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderWidth: 1, borderRadius: 2,
  },
  bpLevelText: { fontFamily: typography.family.mono, fontSize: typography.size.lg },
  bpScore: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.xl, width: 36, textAlign: 'right' },
  bpTrack: {
    height: 6, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: '#475569',
    overflow: 'hidden',
  },
  bpFill: { height: '100%' },

  /* subsections (expanded) */
  subsectionWrap: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.disabled,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  subDot: { width: 5, height: 5, borderRadius: 3 },
  subName: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, flex: 1 },
  subTrackOuter: {
    flex: 1, height: 6, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.disabled,
    borderRadius: 2, overflow: 'hidden',
  },
  subTrackFill: { height: '100%', borderRadius: 2 },
  subLevel: { color: ACCENT, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 44 },
  subXP: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 56, textAlign: 'right' },

  /* lift rankings */
  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  rankExercise: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  rankOneRM: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, marginTop: spacing.valueLabelGap },
  rankBadgeWrap: { alignItems: 'flex-end', gap: spacing.valueLabelGap },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderRadius: 2,
  },
  rankBadgeText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  rankPercentile: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.md },
  rankDeficit: {
    color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.md,
    width: '100%', paddingLeft: spacing.valueLabelGap,
  },

  /* history */
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDate: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 40 },
  historyBarOuter: {
    flex: 1, height: 10, backgroundColor: colors.surfaceAlt,
    borderRadius: 2, borderWidth: 1, borderColor: ACCENT + '33',
    overflow: 'hidden',
  },
  historyBarFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  historyStats: { alignItems: 'flex-end', width: 80 },
  historyScore: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  historyXP: { color: ACCENT, fontFamily: typography.family.mono, fontSize: typography.size.md },

  /* tip */
  tipPanel: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm,
  },
  tipTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginBottom: spacing.xs },
  tipBody: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, lineHeight: 22 },
});

export default StatStrScreen;
