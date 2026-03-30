import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { getSpdDashboard, loadSpdHistory } from '../services/spdService';
import { levelProgress, levelFromTotalXP, xpForNextLevel, xpToReachLevel } from '../utils/xpSystem';

const ACCENT = '#f59e0b';

const StatSpdScreen = ({ navigation }) => {
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [dash, hist] = await Promise.all([getSpdDashboard(), loadSpdHistory()]);
      setDashboard(dash);
      setHistory(hist.slice(0, 15));
    };
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

  if (!dashboard) return null;

  const { level, progress, rank, totalXp, metrics } = dashboard;
  const needed = xpForNextLevel(level);
  const currentLevelXp = totalXp - xpToReachLevel(level);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={ACCENT} />
        </Pressable>
        <Text style={styles.headerTitle}>SPD</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Level card */}
        <View style={styles.levelCard}>
          <MaterialCommunityIcons name="run-fast" size={36} color={ACCENT} />
          <Text style={styles.levelNum}>LV {level}</Text>
          <Text style={styles.rank}>{rank}</Text>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${(progress * 100).toFixed(0)}%` }]} />
          </View>
          <Text style={styles.xpText}>{currentLevelXp} / {needed} XP</Text>
          <Text style={styles.totalXp}>Total: {totalXp} XP</Text>
        </View>

        {/* Metric breakdown */}
        <Text style={styles.sectionTitle}>METRIC BREAKDOWN</Text>
        {metrics.map((m) => (
          <View key={m.key} style={styles.metricRow}>
            <View style={[styles.metricDot, { backgroundColor: m.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricDesc}>{m.description}</Text>
            </View>
            <Text style={[styles.metricXp, { color: m.color }]}>{m.xp} XP</Text>
          </View>
        ))}

        {/* Recent sessions */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>RECENT SPRINTS</Text>
            {history.map((h, i) => (
              <View key={h.sessionId || i} style={styles.historyRow}>
                <Text style={styles.histDate}>{h.date}</Text>
                <Text style={styles.histStat}>{h.maxSpeedMph} mph</Text>
                <Text style={styles.histStat}>{h.distanceM}m</Text>
                <Text style={[styles.histXp, { color: ACCENT }]}>+{h.totalXp}</Text>
              </View>
            ))}
          </>
        )}

        {history.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No sprints logged yet. Tap LOG → SPD to start.</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: `${ACCENT}55`, backgroundColor: colors.header,
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.lg },

  scroll: { padding: spacing.base, gap: spacing.md },

  levelCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: `${ACCENT}40`,
    padding: spacing.lg, alignItems: 'center', gap: spacing.xs,
  },
  levelNum: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xxl },
  rank: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  xpBarBg: { width: '100%', height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden', marginTop: spacing.sm },
  xpBarFill: { height: 8, backgroundColor: ACCENT, borderRadius: 4 },
  xpText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  totalXp: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  sectionTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xs, marginTop: spacing.sm },

  metricRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceAlt,
    padding: spacing.md,
  },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricLabel: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  metricDesc: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  metricXp: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  histDate: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 70 },
  histStat: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, flex: 1 },
  histXp: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  emptyCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceAlt,
    padding: spacing.xl, alignItems: 'center',
  },
  emptyText: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.xl, textAlign: 'center' },
});

export default StatSpdScreen;
