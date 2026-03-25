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
import { getStrDashboard, bodyPartScores, loadStrHistory, loadStrLogs } from '../services/strService';
import { classifyUserLifts } from '../services/strengthStandardsService';

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
          <ActivityIndicator size="large" color={colors.accent} />
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
          <MaterialCommunityIcons name="dumbbell" size={18} color={colors.accent} />
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
            <View style={[styles.sectionRow, { marginTop: 16 }]}>
              <MaterialCommunityIcons name="trophy" size={18} color={colors.accent} />
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
            <View style={[styles.sectionRow, { marginTop: 16 }]}>
              <MaterialIcons name="history" size={18} color={colors.accent} />
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
          <MaterialIcons name="info-outline" size={22} color={colors.accent} />
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
      <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
    </Pressable>
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>STR - LVL {level}</Text>
      <View style={styles.headerTrack}>
        <View style={[styles.headerFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
    <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
      <MaterialIcons name="close" size={22} color={colors.accent} />
    </Pressable>
  </View>
);

/* ═══════════ STYLES ═══════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* header */
  header: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: 'PressStart2P', fontSize: 12 },
  headerTrack: { marginTop: 6, width: 120, height: 4, backgroundColor: '#1f2937' },
  headerFill: { height: '100%', backgroundColor: colors.accent },

  content: { padding: 16, paddingBottom: 40, gap: 10 },

  /* overall panel */
  panel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: 16, gap: 10,
    position: 'relative',
  },
  panelCorner: { position: 'absolute', top: 2, left: 2, width: 6, height: 6, backgroundColor: colors.accent },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  xpLabel: { color: colors.accent, fontFamily: 'PressStart2P', fontSize: 9 },
  xpValue: { color: colors.textPrimary, fontFamily: 'VT323', fontSize: 24 },
  track: {
    height: 12, backgroundColor: '#1f2937',
    borderWidth: 1, borderColor: '#475569',
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent },
  xpSubRow: { alignItems: 'flex-end' },
  xpSubText: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 16 },
  rankText: { color: colors.textMuted, textAlign: 'center', fontFamily: 'VT323', fontSize: 18 },

  /* section header */
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  sectionTitle: { color: colors.textPrimary, fontFamily: 'PressStart2P', fontSize: 10 },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  /* body part cards */
  bodyPartCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: '#334155',
    padding: 14,
  },
  bpDot: { width: 10, height: 10, borderRadius: 5 },
  bpHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bpName: { color: colors.textPrimary, fontFamily: 'PressStart2P', fontSize: 9, flex: 1 },
  bpLevelBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderRadius: 2,
  },
  bpLevelText: { fontFamily: 'PressStart2P', fontSize: 7 },
  bpScore: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 20, width: 30, textAlign: 'right' },
  bpTrack: {
    height: 6, backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: '#475569',
    overflow: 'hidden',
  },
  bpFill: { height: '100%' },

  /* subsections (expanded) */
  subsectionWrap: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1, borderTopWidth: 0, borderColor: '#334155',
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subDot: { width: 5, height: 5, borderRadius: 3 },
  subName: { color: colors.textSecondary, fontFamily: 'VT323', fontSize: 18, width: 90 },
  subTrackOuter: {
    flex: 1, height: 5, backgroundColor: '#1e293b',
    borderRadius: 2, overflow: 'hidden',
  },
  subTrackFill: { height: '100%', borderRadius: 2 },
  subLevel: { color: colors.textMuted, fontFamily: 'PressStart2P', fontSize: 6, width: 36 },
  subXP: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 14, width: 48, textAlign: 'right' },

  /* lift rankings */
  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  rankExercise: { color: colors.textPrimary, fontFamily: 'PressStart2P', fontSize: 8 },
  rankOneRM: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 16, marginTop: 2 },
  rankBadgeWrap: { alignItems: 'flex-end', gap: 2 },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderRadius: 2,
  },
  rankBadgeText: { fontFamily: 'PressStart2P', fontSize: 6 },
  rankPercentile: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 14 },
  rankDeficit: {
    color: colors.textMuted, fontFamily: 'VT323', fontSize: 14,
    width: '100%', paddingLeft: 2,
  },

  /* history */
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyDate: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 16, width: 40 },
  historyBarOuter: {
    flex: 1, height: 10, backgroundColor: '#0f172a',
    borderRadius: 2, borderWidth: 1, borderColor: 'rgba(37,123,244,0.2)',
    overflow: 'hidden',
  },
  historyBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  historyStats: { alignItems: 'flex-end', width: 80 },
  historyScore: { color: colors.textPrimary, fontFamily: 'VT323', fontSize: 18 },
  historyXP: { color: colors.accent, fontFamily: 'VT323', fontSize: 14 },

  /* tip */
  tipPanel: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: 14, marginTop: 8,
  },
  tipTitle: { color: colors.accent, fontFamily: 'PressStart2P', fontSize: 8, marginBottom: 4 },
  tipBody: { color: colors.textSecondary, fontFamily: 'VT323', fontSize: 18, lineHeight: 22 },
});

export default StatStrScreen;
