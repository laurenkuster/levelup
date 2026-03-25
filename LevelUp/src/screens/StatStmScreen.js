import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getStmDashboard, loadStmHistory } from '../services/stmService';
import { xpForNextLevel, xpToReachLevel } from '../utils/xpSystem';

const ACCENT = '#ec4899';

const StatStmScreen = ({ navigation }) => {
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [dash, hist] = await Promise.all([getStmDashboard(), loadStmHistory()]);
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

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={ACCENT} />
        </Pressable>
        <Text style={styles.headerTitle}>STM</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Level card */}
        <View style={styles.levelCard}>
          <MaterialIcons name="favorite" size={36} color={ACCENT} />
          <Text style={styles.levelNum}>LV {level}</Text>
          <Text style={styles.rank}>{rank}</Text>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${(progress * 100).toFixed(0)}%` }]} />
          </View>
          <Text style={styles.xpText}>{currentLevelXp} / {needed} XP</Text>
          <Text style={styles.totalXp}>Total: {totalXp} XP</Text>
        </View>

        {/* Metric breakdown */}
        <Text style={styles.sectionTitle}>RUN TYPES</Text>
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
            <Text style={styles.sectionTitle}>RECENT RUNS</Text>
            {history.map((h, i) => (
              <View key={h.sessionId || i} style={styles.historyRow}>
                <Text style={styles.histDate}>{h.date}</Text>
                <Text style={styles.histStat}>{formatTime(h.elapsedS)}</Text>
                <Text style={styles.histStat}>{h.distanceMi} mi</Text>
                <Text style={styles.histStat}>{h.paceMinPerMi} min/mi</Text>
                <Text style={[styles.histXp, { color: ACCENT }]}>+{h.totalXp}</Text>
              </View>
            ))}
          </>
        )}

        {history.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No runs logged yet. Tap LOG → STM to start your first endurance run.</Text>
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
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: `${ACCENT}55`, backgroundColor: colors.header,
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: ACCENT, fontFamily: 'PressStart2P', fontSize: 16 },

  scroll: { padding: 16, gap: 12 },

  levelCard: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: `${ACCENT}40`,
    padding: 20, alignItems: 'center', gap: 6,
  },
  levelNum: { color: '#e2e8f0', fontFamily: 'PressStart2P', fontSize: 24 },
  rank: { color: ACCENT, fontFamily: 'PressStart2P', fontSize: 10 },
  xpBarBg: { width: '100%', height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  xpBarFill: { height: 8, backgroundColor: ACCENT, borderRadius: 4 },
  xpText: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 18 },
  totalXp: { color: '#64748b', fontFamily: 'VT323', fontSize: 16 },

  sectionTitle: { color: ACCENT, fontFamily: 'PressStart2P', fontSize: 9, marginTop: 8 },

  metricRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b', padding: 12,
  },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricLabel: { color: '#e2e8f0', fontFamily: 'VT323', fontSize: 20 },
  metricDesc: { color: '#64748b', fontFamily: 'VT323', fontSize: 16 },
  metricXp: { fontFamily: 'PressStart2P', fontSize: 9 },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  histDate: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 16, width: 70 },
  histStat: { color: '#cbd5e1', fontFamily: 'VT323', fontSize: 16, flex: 1 },
  histXp: { fontFamily: 'PressStart2P', fontSize: 8 },

  emptyCard: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b',
    padding: 24, alignItems: 'center',
  },
  emptyText: { color: '#64748b', fontFamily: 'VT323', fontSize: 20, textAlign: 'center' },
});

export default StatStmScreen;
