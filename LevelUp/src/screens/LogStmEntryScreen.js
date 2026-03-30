import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
let activateKeepAwakeAsync = async () => {};
let deactivateKeepAwake = () => {};
try {
  const keepAwake = require('expo-keep-awake');
  activateKeepAwakeAsync = keepAwake.activateKeepAwakeAsync;
  deactivateKeepAwake = keepAwake.deactivateKeepAwake;
} catch { /* native module not available */ }
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { COUNTDOWN_SECONDS } from '../config/stmConstants';
import { requestSensorPermissions, getStrideLengthM, createSensorSession } from '../services/sensorService';
import { logStmSession, calcSessionStmScore, calcStmXP } from '../services/stmService';
import { trackStmSession } from '../services/trackingService';

const ACCENT = '#ec4899';

// states: SETUP → COUNTDOWN → ACTIVE → RESULTS
const LogStmEntryScreen = ({ navigation }) => {
  const [phase, setPhase] = useState('SETUP');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [liveSteps, setLiveSteps] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [saving, setSaving] = useState(false);
  const [permGranted, setPermGranted] = useState(false);

  const sensorRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    requestSensorPermissions().then((perms) => {
      setPermGranted(perms.accelerometer || perms.pedometer);
      if (!perms.accelerometer && !perms.pedometer) {
        Alert.alert('Sensor Permission Required',
          'LevelUp needs motion sensor access to track your stamina run.');
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
      Alert.alert('No Sensors', 'Motion sensor access is required.');
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
  }, [permGranted]);

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
      // Update live steps every 5 seconds
      if (e % 5 === 0) {
        setLiveSteps(sensorRef.current?.getLiveSteps() || 0);
      }
    }, 1000);
  }, []);

  // ── STOP ──
  const stopRecording = useCallback(async () => {
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
      const result = await logStmSession(metrics);
      trackStmSession({ totalXp: result.totalXp, distanceMi: metrics.distanceMi, elapsedMin: Math.round(metrics.elapsedS / 60) });
      Alert.alert(
        'Run Logged!',
        `+${result.totalXp} XP  |  Score: ${result.score}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      console.error('[LogStm] save error:', e);
      Alert.alert('Error', 'Failed to save run.');
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
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.headerBtn}>
          <MaterialIcons name={phase === 'RESULTS' ? 'replay' : 'close'} size={22} color={ACCENT} />
        </Pressable>
        <Text style={styles.headerTitle}>STM ENTRY</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* ═══ SETUP ═══ */}
      {phase === 'SETUP' && (
        <View style={styles.center}>
          <MaterialIcons name="favorite" size={48} color={ACCENT} />
          <Text style={styles.instruction}>ENDURANCE RUN</Text>
          <Text style={styles.hint}>
            Place your phone in your pocket. Start when ready, stop when you're done. We'll track your distance, pace, and stamina.
          </Text>
          <Text style={styles.hint}>
            A 5-second countdown will give you time to secure your device.
          </Text>

          <Pressable style={styles.startBtn} onPress={startCountdown}>
            <MaterialIcons name="play-arrow" size={28} color={colors.textPrimary} />
            <Text style={styles.startText}>START RUN</Text>
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
          <Text style={styles.activeLabel}>RUNNING</Text>
          <Text style={styles.timerNum}>{formatTime(elapsed)}</Text>

          <View style={styles.liveRow}>
            <View style={styles.liveStat}>
              <Text style={styles.liveVal}>{liveSteps}</Text>
              <Text style={styles.liveLbl}>STEPS</Text>
            </View>
          </View>

          <Pressable style={styles.stopBtn} onPress={stopRecording}>
            <MaterialIcons name="stop" size={32} color={colors.textPrimary} />
            <Text style={styles.stopText}>STOP</Text>
          </Pressable>
        </View>
      )}

      {/* ═══ RESULTS ═══ */}
      {phase === 'RESULTS' && metrics && (
        <View style={styles.resultsWrap}>
          <Text style={styles.resultsTitle}>RUN COMPLETE</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{formatTime(Math.round(metrics.elapsedS))}</Text>
              <Text style={styles.statLabel}>DURATION</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.distanceMi}</Text>
              <Text style={styles.statLabel}>MILES</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.avgSpeedMph}</Text>
              <Text style={styles.statLabel}>AVG MPH</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.paceMinPerMi}</Text>
              <Text style={styles.statLabel}>MIN/MI</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.steps}</Text>
              <Text style={styles.statLabel}>STEPS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: ACCENT }]}>+{calcStmXP(metrics)}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
          </View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialIcons name="save" size={20} color={colors.textPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'SAVE RUN'}</Text>
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
  activeLabel: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.md, letterSpacing: 3 },
  timerNum: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xxl },
  liveRow: { flexDirection: 'row', gap: spacing.xl, marginVertical: spacing.sm },
  liveStat: { alignItems: 'center', gap: spacing.valueLabelGap },
  liveVal: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.xxl },
  liveLbl: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.error, paddingHorizontal: spacing.xxl, paddingVertical: spacing.base, borderRadius: 4,
    marginTop: spacing.lg,
  },
  stopText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },

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

export default LogStmEntryScreen;
