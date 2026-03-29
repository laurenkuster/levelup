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
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { loadData, SYNC_DOCS } from '../services/firestoreSync';
import { computeBMR, bmrBurnedSoFar } from '../utils/bmr';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const FOOD_LOG_KEY = 'levelup_food_log_v1';
const PROFILE_KEY = 'levelup_profile_v1';

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const shortDate = (iso) => {
  const d = new Date(iso);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${mon} ${d.getDate()}`;
};

const StatHPScreen = ({ navigation }) => {
  const [logs, setLogs] = useState([]);
  const [dailyBMR, setDailyBMR] = useState(0);
  const [burned, setBurned] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [data, profileData] = await Promise.all([
            loadData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS),
            loadData(PROFILE_KEY, SYNC_DOCS.PROFILE),
          ]);
          if (data) setLogs(data);
          const bmr = computeBMR(profileData);
          setDailyBMR(bmr);
          setBurned(bmrBurnedSoFar(bmr));
        } catch (_) { /* ignore */ }
      })();
    }, []),
  );

  // Update burn every 60s
  React.useEffect(() => {
    if (!dailyBMR) return;
    const t = setInterval(() => setBurned(bmrBurnedSoFar(dailyBMR)), 60_000);
    return () => clearInterval(t);
  }, [dailyBMR]);

  /* today's totals */
  const today = fmtDate(new Date());
  const todayLogs = logs.filter((l) => l.date === today);
  const totals = todayLogs.reduce(
    (acc, l) => ({
      cal: acc.cal + l.calories,
      p: acc.p + l.protein,
      c: acc.c + l.carbs,
      f: acc.f + l.fats,
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  /* last 7 days data */
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = fmtDate(d);
    const dayLogs = logs.filter((l) => l.date === key);
    const cal = dayLogs.reduce((s, l) => s + l.calories, 0);
    last7.push({ date: key, cal, meals: dayLogs.length });
  }
  const maxCal = Math.max(...last7.map((d) => d.cal), 1);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>HP — NUTRITION</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="close" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Today's macros */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>TODAY'S INTAKE</Text>
          <View style={styles.macroRow}>
            <MacroCard icon="fire" label="CALORIES" value={totals.cal} unit="kcal" color="#f59e0b" />
            <MacroCard icon="food-steak" label="PROTEIN" value={totals.p} unit="g" color="#ef4444" />
          </View>
          <View style={styles.macroRow}>
            <MacroCard icon="barley" label="CARBS" value={totals.c} unit="g" color="#3b82f6" />
            <MacroCard icon="water" label="FATS" value={totals.f} unit="g" color="#22c55e" />
          </View>
          <Text style={styles.mealCountText}>
            {todayLogs.length} meal{todayLogs.length !== 1 ? 's' : ''} logged today
          </Text>
        </View>

        {/* Energy balance */}
        {dailyBMR > 0 && (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>ENERGY BALANCE</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceValue, { color: colors.success }]}>+{totals.cal}</Text>
                <Text style={styles.balanceLabel}>EATEN</Text>
              </View>
              <Text style={styles.balanceSep}>−</Text>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceValue, { color: colors.error }]}>{burned}</Text>
                <Text style={styles.balanceLabel}>BURNED</Text>
              </View>
              <Text style={styles.balanceSep}>=</Text>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceValue, { color: totals.cal - burned >= 0 ? colors.success : colors.error }]}>
                  {totals.cal - burned >= 0 ? '+' : ''}{totals.cal - burned}
                </Text>
                <Text style={styles.balanceLabel}>NET</Text>
              </View>
            </View>
            <View style={styles.bmrRow}>
              <Text style={styles.bmrLabel}>Daily BMR</Text>
              <Text style={styles.bmrValue}>{dailyBMR} kcal</Text>
            </View>
            <View style={styles.bmrRow}>
              <Text style={styles.bmrLabel}>Burned so far</Text>
              <Text style={styles.bmrValue}>{burned} / {dailyBMR} kcal</Text>
            </View>
            <View style={styles.burnTrack}>
              <View style={[styles.burnFill, { width: `${Math.min(100, Math.round((burned / dailyBMR) * 100))}%` }]} />
            </View>
          </View>
        )}

        {/* 7-day chart */}
        <Text style={styles.sectionTitle}>LAST 7 DAYS</Text>
        <View style={styles.panel}>
          {last7.reverse().map((day) => (
            <View key={day.date} style={styles.barRow}>
              <Text style={styles.barLabel}>{day.date.slice(5)}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((day.cal / maxCal) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{day.cal}</Text>
            </View>
          ))}
        </View>

        {/* Recent meals */}
        <Text style={styles.sectionTitle}>RECENT MEALS</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>No meals logged yet. Go log your food!</Text>
          </View>
        ) : (
          <View style={styles.panel}>
            {logs.slice(0, 20).map((entry) => (
              <View key={entry.id} style={styles.logRow}>
                <MaterialCommunityIcons name="food-apple" size={18} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logFood}>{entry.food}</Text>
                  <Text style={styles.logMeta}>
                    {shortDate(entry.createdAt)} {entry.time} • {entry.quantity}
                  </Text>
                  <Text style={styles.logNutrition}>
                    {entry.calories} kcal  •  P {entry.protein}g  •  C {entry.carbs}g  •  F {entry.fats}g
                  </Text>
                </View>
                <Text style={styles.logSource}>{entry.source}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── small components ── */

const MacroCard = ({ icon, label, value, unit, color }) => (
  <View style={[styles.macroCard, { borderColor: `${color}55` }]}>
    <MaterialCommunityIcons name={icon} size={20} color={color} />
    <Text style={[styles.macroValue, { color }]}>
      {value} <Text style={styles.macroUnit}>{unit}</Text>
    </Text>
    <Text style={styles.macroLabel}>{label}</Text>
  </View>
);

/* ═══════════ STYLES ═══════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: colors.accentStrong, fontSize: 12, fontFamily: typography.family.pixel },
  content: { padding: 16, gap: 14, paddingBottom: 80 },

  panel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: 16, gap: 10,
  },
  sectionTitle: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: 10, marginTop: 4 },

  /* macro cards */
  macroRow: { flexDirection: 'row', gap: 10 },
  macroCard: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderRadius: 4,
  },
  macroValue: { fontFamily: typography.family.mono, fontSize: 28 },
  macroUnit: { fontSize: 18, color: colors.textMuted },
  macroLabel: { fontFamily: typography.family.pixel, fontSize: 9, color: colors.textMuted },
  mealCountText: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 16, textAlign: 'center', marginTop: 4 },

  /* bar chart */
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 16, width: 40 },
  barTrack: {
    flex: 1, height: 14, backgroundColor: colors.surfaceAlt, borderRadius: 2,
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.2)',
  },
  barFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 2 },
  barValue: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: 16, width: 40, textAlign: 'right' },

  /* meal log rows */
  logRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  logFood: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: 22 },
  logMeta: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 16 },
  logNutrition: { color: colors.textLabel, fontFamily: typography.family.mono, fontSize: 16 },
  logSource: {
    fontFamily: typography.family.pixel, fontSize: 9, color: colors.textMuted,
    backgroundColor: '#1e293b', paddingHorizontal: 4, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 4,
  },

  emptyPanel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: 24, alignItems: 'center',
  },
  emptyText: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 18 },

  /* energy balance */
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 8 },
  balanceItem: { alignItems: 'center', flex: 1 },
  balanceValue: { fontFamily: typography.family.mono, fontSize: 28 },
  balanceLabel: { fontFamily: typography.family.pixel, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  balanceSep: { color: colors.placeholder, fontFamily: typography.family.mono, fontSize: 28 },
  bmrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bmrLabel: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 16 },
  bmrValue: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: 16 },
  burnTrack: {
    height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 2,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginTop: 4,
  },
  burnFill: { height: '100%', backgroundColor: '#ef4444', borderRadius: 2 },
});

export default StatHPScreen;
