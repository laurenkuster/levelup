import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
let activateKeepAwakeAsync = async () => {};
let deactivateKeepAwake = () => {};
try {
  const keepAwake = require('expo-keep-awake');
  activateKeepAwakeAsync = keepAwake.activateKeepAwakeAsync;
  deactivateKeepAwake = keepAwake.deactivateKeepAwake;
} catch { /* native module not available */ }
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { PRESET_DURATIONS, COUNTDOWN_SECONDS } from '../config/spdConstants';
import { requestSensorPermissions, getStrideLengthM, createSensorSession } from '../services/sensorService';
import { logSpdSession, calcSessionSpdScore, calcSpdXP } from '../services/spdService';

const ACCENT = '#f59e0b';

// states: SETUP → COUNTDOWN → ACTIVE → RESULTS
const LogSpdEntryScreen = ({ navigation }) => {
  const [phase, setPhase] = useState('SETUP');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [saving, setSaving] = useState(false);
  const [permGranted, setPermGranted] = useState(false);

  const sensorRef = useRef(null);
  const timerRef = useRef(null);

  // Request permissions on mount
  useEffect(() => {
    requestSensorPermissions().then((perms) => {
      setPermGranted(perms.accelerometer || perms.pedometer);
      if (!perms.accelerometer && !perms.pedometer) {
        Alert.alert(
          'Sensor Permission Required',
          'LevelUp needs motion sensor access to track your speed. Please enable it in Settings.',
        );
      }
    });
    return () => {
      clearInterval(timerRef.current);
      deactivateKeepAwake();
    };
  }, []);

  // ── START COUNTDOWN ──
  const startCountdown = useCallback(async () => {
    if (!permGranted) {
      Alert.alert('No Sensors', 'Motion sensor access is required for speed tracking.');
      return;
    }

    const stride = await getStrideLengthM();
    sensorRef.current = createSensorSession(stride);
    setCountdown(COUNTDOWN_SECONDS);
    setPhase('COUNTDOWN');
    await activateKeepAwakeAsync();

    let c = COUNTDOWN_SECONDS;
    timerRef.current = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(timerRef.current);
        beginRecording();
      } else {
        setCountdown(c);
      }
    }, 1000);
  }, [permGranted, selectedDuration]);

  // ── BEGIN RECORDING ──
  const beginRecording = useCallback(() => {
    setPhase('ACTIVE');
    setElapsed(0);
    sensorRef.current?.start();
    Vibration.vibrate(200);

    let e = 0;
    timerRef.current = setInterval(() => {
      e += 1;
      setElapsed(e);
      if (e >= selectedDuration) {
        clearInterval(timerRef.current);
        finishRecording();
      }
    }, 1000);
  }, [selectedDuration]);

  // ── FINISH ──
  const finishRecording = useCallback(async () => {
    clearInterval(timerRef.current);
    Vibration.vibrate([100, 100, 100]);

    const result = await sensorRef.current?.stop();
    setMetrics(result);
    setPhase('RESULTS');
    deactivateKeepAwake();
  }, []);

  // ── SAVE ──
  const handleSave = async () => {
    if (!metrics) return;
    setSaving(true);
    try {
      const result = await logSpdSession(metrics, selectedDuration);
      Alert.alert(
        'Sprint Logged!',
        `+${result.totalXp} XP  |  Score: ${result.score}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      console.error('[LogSpd] save error:', e);
      Alert.alert('Error', 'Failed to save sprint.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    clearInterval(timerRef.current);
    sensorRef.current?.stop().catch(() => {});
    deactivateKeepAwake();
    if (phase === 'RESULTS') {
      setPhase('SETUP');
      setMetrics(null);
    } else {
      navigation.goBack();
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.headerBtn}>
          <MaterialIcons name={phase === 'RESULTS' ? 'replay' : 'close'} size={22} color={ACCENT} />
        </Pressable>
        <Text style={styles.headerTitle}>SPD ENTRY</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* ═══ SETUP ═══ */}
      {phase === 'SETUP' && (
        <View style={styles.center}>
          <MaterialCommunityIcons name="run-fast" size={48} color={ACCENT} />
          <Text style={styles.instruction}>SELECT SPRINT DURATION</Text>
          <Text style={styles.hint}>
            Place your phone in your pocket. A 5-second countdown will give you time to secure it before the sprint starts.
          </Text>

          <View style={styles.presetRow}>
            {PRESET_DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[styles.presetBtn, selectedDuration === d && styles.presetBtnActive]}
                onPress={() => setSelectedDuration(d)}
              >
                <Text style={[styles.presetText, selectedDuration === d && styles.presetTextActive]}>
                  {d}s
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.startBtn} onPress={startCountdown}>
            <MaterialIcons name="play-arrow" size={28} color={colors.textPrimary} />
            <Text style={styles.startText}>START</Text>
          </Pressable>
        </View>
      )}

      {/* ═══ COUNTDOWN ═══ */}
      {phase === 'COUNTDOWN' && (
        <View style={styles.center}>
          <Text style={styles.countdownLabel}>GET READY</Text>
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.hint}>Secure phone in pocket!</Text>
        </View>
      )}

      {/* ═══ ACTIVE ═══ */}
      {phase === 'ACTIVE' && (
        <View style={styles.center}>
          <Text style={styles.activeLabel}>RECORDING</Text>
          <View style={styles.timerRing}>
            <Text style={styles.timerNum}>{formatTime(elapsed)}</Text>
            <Text style={styles.timerSub}>/ {formatTime(selectedDuration)}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, (elapsed / selectedDuration) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.hint}>Sprint as fast as you can!</Text>
        </View>
      )}

      {/* ═══ RESULTS ═══ */}
      {phase === 'RESULTS' && metrics && (
        <View style={styles.resultsWrap}>
          <Text style={styles.resultsTitle}>SPRINT COMPLETE</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.maxSpeedMph}</Text>
              <Text style={styles.statLabel}>MAX MPH</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.avgSpeedMph}</Text>
              <Text style={styles.statLabel}>AVG MPH</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.distanceM}</Text>
              <Text style={styles.statLabel}>METERS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.steps}</Text>
              <Text style={styles.statLabel}>STEPS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.cadence}</Text>
              <Text style={styles.statLabel}>CADENCE</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: ACCENT }]}>+{calcSpdXP(metrics)}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
          </View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialIcons name="save" size={20} color={colors.textPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'SAVE SPRINT'}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: `${ACCENT}55`,
    backgroundColor: colors.header,
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.md },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.base },

  instruction: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm, textAlign: 'center' },
  hint: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.xl, textAlign: 'center' },

  presetRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  presetBtn: {
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.disabled, borderRadius: 4,
  },
  presetBtnActive: { borderColor: ACCENT, backgroundColor: `${ACCENT}20` },
  presetText: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  presetTextActive: { color: ACCENT },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: ACCENT, paddingHorizontal: spacing.xxl, paddingVertical: spacing.base, borderRadius: 4,
    marginTop: spacing.base,
  },
  startText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },

  /* Countdown */
  countdownLabel: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.md },
  countdownNum: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xxl },

  /* Active */
  activeLabel: { color: '#ef4444', fontFamily: typography.family.pixel, fontSize: typography.size.md, letterSpacing: 2 },
  timerRing: { alignItems: 'center', gap: spacing.xs },
  timerNum: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xxl },
  timerSub: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  progressBarBg: {
    width: '80%', height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },

  /* Results */
  resultsWrap: { flex: 1, padding: spacing.lg, gap: spacing.base, justifyContent: 'center' },
  resultsTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.md, textAlign: 'center' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center',
  },
  statBox: {
    width: '30%', backgroundColor: colors.surface, borderWidth: 1, borderColor: `${ACCENT}40`,
    padding: spacing.md, alignItems: 'center', gap: spacing.xs,
  },
  statVal: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },
  statLabel: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: ACCENT, paddingVertical: spacing.base, borderRadius: 4,
  },
  saveBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
});

export default LogSpdEntryScreen;
