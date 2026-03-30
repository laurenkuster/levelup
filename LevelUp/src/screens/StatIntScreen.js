import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  levelFromTotalXP,
  levelProgress,
  xpToReachLevel,
  xpForNextLevel,
  rankForLevel,
  MAX_LEVEL,
} from '../utils/xpSystem';
import { loadData, SYNC_DOCS } from '../services/firestoreSync';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const ACCENT = '#818cf8';
const INT_XP_KEY = 'levelup_int_xp_v1';
const INT_LOG_KEY = 'levelup_int_log_v1';

/* ── helpers ── */
const fmtDate = (iso) => {
  const d = new Date(iso);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${mon} ${d.getDate()}`;
};

const StatIntScreen = ({ navigation }) => {
  const [xpData, setXpData] = useState({ totalXp: 0, level: 1, history: [] });
  const [quizLog, setQuizLog] = useState([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [xpResult, logResult] = await Promise.all([
            loadData(INT_XP_KEY, SYNC_DOCS.INT_XP),
            loadData(INT_LOG_KEY, SYNC_DOCS.QUIZ_LOGS),
          ]);
          if (xpResult) setXpData(xpResult);
          if (logResult) setQuizLog(logResult);
        } catch (_) { /* ignore */ }
      })();
    }, []),
  );

  const level = levelFromTotalXP(xpData.totalXp);
  const progress = levelProgress(xpData.totalXp);
  const rank = rankForLevel(level);
  const currentLevelXP = xpToReachLevel(level);
  const nextLevelXP = level >= MAX_LEVEL ? xpData.totalXp : xpToReachLevel(level + 1);
  const xpIntoLevel = xpData.totalXp - currentLevelXP;
  const xpNeeded = xpForNextLevel(level);

  /* ── last 5 quizzes for quick view ── */
  const recentQuizzes = quizLog.slice(0, 10);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={ACCENT} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>INT — LVL {level}</Text>
          <View style={styles.smallTrack}>
            <View style={[styles.smallFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="close" size={22} color={ACCENT} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── XP Panel ── */}
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.label}>TOTAL EXPERIENCE</Text>
            <Text style={styles.value}>
              {level >= MAX_LEVEL
                ? `${xpData.totalXp.toLocaleString()} XP (MAX)`
                : `${xpIntoLevel} / ${xpNeeded}`}
            </Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          <Text style={styles.rank}>[ {rank} ]</Text>

          <View style={styles.statRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniLabel}>LEVEL</Text>
              <Text style={styles.miniValue}>{level}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniLabel}>TOTAL XP</Text>
              <Text style={styles.miniValue}>{xpData.totalXp.toLocaleString()}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniLabel}>QUIZZES</Text>
              <Text style={styles.miniValue}>{quizLog.length}</Text>
            </View>
          </View>
        </View>

        {/* ── Level milestones ── */}
        <Text style={styles.sectionTitle}>RANK PROGRESSION</Text>
        <View style={styles.milestonesPanel}>
          {[
            { lv: 10, title: 'APPRENTICE' },
            { lv: 25, title: 'SCHOLAR' },
            { lv: 50, title: 'SAGE' },
            { lv: 75, title: 'MASTER' },
            { lv: 90, title: 'GRANDMASTER' },
            { lv: 100, title: 'ENLIGHTENED' },
          ].map((m) => {
            const reached = level >= m.lv;
            return (
              <View key={m.lv} style={styles.milestoneRow}>
                <MaterialIcons
                  name={reached ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={reached ? colors.success : colors.disabled}
                />
                <Text style={[styles.milestoneText, reached && styles.milestoneReached]}>
                  LVL {m.lv} — {m.title}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Recent Quizzes ── */}
        <Text style={styles.sectionTitle}>RECENT QUIZZES</Text>
        {recentQuizzes.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>No quizzes taken yet. Train to gain XP!</Text>
          </View>
        ) : (
          recentQuizzes.map((q) => (
            <View key={q.id} style={styles.quizRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.quizTopic} numberOfLines={1}>{q.topic}</Text>
                <Text style={styles.quizMeta}>
                  D{q.difficulty}  •  {fmtDate(q.date)}  •  {q.score}/{q.total}
                </Text>
              </View>
              <View style={styles.quizXpBadge}>
                <Text style={styles.quizXpText}>+{q.xp || 0} XP</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── styles ── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* header */
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT + '55',
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.md,
  },
  smallTrack: {
    marginTop: spacing.xs,
    width: 120,
    height: 4,
    backgroundColor: colors.disabled,
  },
  smallFill: { height: '100%', backgroundColor: ACCENT },

  /* body */
  content: { padding: spacing.base, paddingBottom: spacing.xxl, gap: spacing.md },

  /* XP panel */
  panel: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: ACCENT + '55',
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    color: ACCENT,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
  },
  track: {
    height: 12,
    backgroundColor: colors.disabled,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: ACCENT },
  rank: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xs,
  },
  miniStat: { alignItems: 'center', gap: spacing.valueLabelGap },
  miniLabel: {
    color: colors.textSecondary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  miniValue: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
  },

  /* milestones */
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },
  milestonesPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  milestoneText: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  milestoneReached: { color: colors.success },

  /* recent quizzes */
  emptyPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  quizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  quizTopic: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  quizMeta: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
    marginTop: spacing.valueLabelGap,
  },
  quizXpBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quizXpText: {
    color: '#22c55e',
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
  },
});

export default StatIntScreen;
