import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveData, loadData, SYNC_DOCS } from '../services/firestoreSync';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const SLEEP_LOG_KEY = 'levelup_sleep_log_v1';
const SLEEP_MP_KEY = 'levelup_sleep_mp_v1';
const PROFILE_KEY = 'levelup_profile_v1';
const AGE_KEY = 'levelup_age_v1';

/* ───────── age → recommended sleep hours ───────── */
const getRequiredSleep = (age) => {
  if (age <= 0 || Number.isNaN(age)) return { range: 'Unknown', requiredHours: 8 };
  if (age <= 1) return { range: '0-1', requiredHours: 15.5 };
  if (age <= 2) return { range: '1-2', requiredHours: 12.5 };
  if (age <= 5) return { range: '3-5', requiredHours: 11.5 };
  if (age <= 13) return { range: '6-13', requiredHours: 10 };
  if (age <= 17) return { range: '14-17', requiredHours: 9 };
  if (age <= 64) return { range: '18-64', requiredHours: 8 };
  return { range: '65+', requiredHours: 7.5 };
};

/* ───────── helpers ───────── */
const pad = (n) => String(n).padStart(2, '0');

const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatTime = (h, m) => `${pad(h)}:${pad(m)}`;

const calcSleepHours = (bedH, bedM, wakeH, wakeM) => {
  let bed = bedH * 60 + bedM;
  let wake = wakeH * 60 + wakeM;
  if (wake <= bed) wake += 24 * 60; // crossed midnight
  return (wake - bed) / 60;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ITEM_H = 38;
const VISIBLE = 3;
const WHEEL_H = ITEM_H * VISIBLE;

/* ───────── Scroll Wheel Column ───────── */
const WheelColumn = ({ data, selected, onChange, width }) => {
  const ref = useRef(null);
  const mounted = useRef(false);

  const idx = data.indexOf(selected);

  useEffect(() => {
    if (ref.current && idx >= 0) {
      ref.current.scrollTo({ y: idx * ITEM_H, animated: mounted.current });
      mounted.current = true;
    }
  }, [idx]);

  const onSnap = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.round(y / ITEM_H);
    if (i >= 0 && i < data.length && data[i] !== selected) {
      onChange(data[i]);
    }
  }, [data, selected, onChange]);

  return (
    <View style={[styles.wheelContainer, { height: WHEEL_H, width }]}>
      {/* highlight band */}
      <View style={[styles.wheelBand, { top: ITEM_H, height: ITEM_H }]} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={styles.wheelContent}
        onMomentumScrollEnd={onSnap}
        onScrollEndDrag={onSnap}
        nestedScrollEnabled
      >
        {data.map((item) => {
          const active = item === selected;
          return (
            <View key={String(item)} style={[styles.wheelItem, { height: ITEM_H, width }]}> 
              <Text style={[styles.wheelText, active && styles.wheelTextActive]}>
                {pad(item)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

/* ───────── Scroll Wheel Time Picker ───────── */
const WheelTimePicker = ({ label, icon, hour, minute, onChangeHour, onChangeMinute }) => (
  <View style={styles.wheelPickerWrap}>
    <View style={styles.compactHeader}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.textLabel} />
      <Text style={styles.compactLabel}>{label}</Text>
    </View>
    <View style={styles.wheelRow}>
      <WheelColumn data={HOURS} selected={hour} onChange={onChangeHour} width={54} />
      <Text style={styles.wheelColon}>:</Text>
      <WheelColumn data={MINUTES} selected={minute} onChange={onChangeMinute} width={54} />
    </View>
  </View>
);

/* ───────── Date stepper ───────── */
const DateStepper = ({ date, onPrev, onNext }) => (
  <View style={styles.dateStepper}>
    <Pressable onPress={onPrev} style={styles.dateArrow}>
      <MaterialIcons name="chevron-left" size={28} color={colors.textLabel} />
    </Pressable>
    <Text style={styles.dateText}>{formatDate(date)}</Text>
    <Pressable onPress={onNext} style={styles.dateArrow}>
      <MaterialIcons name="chevron-right" size={28} color={colors.textLabel} />
    </Pressable>
  </View>
);

/* ═══════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════ */
const LogSleepEntryScreen = ({ navigation }) => {
  // Fetch age from Firestore
  const [age, setAge] = useState('');
  const [date, setDate] = useState(new Date());
  const [bedHour, setBedHour] = useState(23);
  const [bedMin, setBedMin] = useState(0);
  const [wakeHour, setWakeHour] = useState(7);
  const [wakeMin, setWakeMin] = useState(0);
  const [quality, setQuality] = useState(null); // 1-5
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState([]);
  const [sleepSummary, setSleepSummary] = useState(null);

  /* load persisted data */
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const loadAll = async () => {
        try {
          // Load age from local profile
          const profileData = await loadData(PROFILE_KEY, SYNC_DOCS.PROFILE);
          if (mounted && profileData) {
            setAge(profileData.age ? String(profileData.age) : '');
          }
          // Load logs and summary from local + cloud fallback
          const [logsData, summaryData] = await Promise.all([
            loadData(SLEEP_LOG_KEY, SYNC_DOCS.SLEEP_LOGS),
            loadData(SLEEP_MP_KEY, SYNC_DOCS.SLEEP_SUMMARY),
          ]);
          if (!mounted) return;
          if (logsData) setLogs(logsData);
          if (summaryData) setSleepSummary(summaryData);
        } catch (e) {
          // silently ignore load errors
        }
      };
      loadAll();
      return () => { mounted = false; };
    }, [])
  );

  /* derived */
  const sleepHours = useMemo(
    () => calcSleepHours(bedHour, bedMin, wakeHour, wakeMin),
    [bedHour, bedMin, wakeHour, wakeMin],
  );

  const parsedAge = Number.parseInt(age, 10) || 0;
  const { range: ageRange, requiredHours } = getRequiredSleep(parsedAge);

  /* ── date stepper ── */
  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    if (d > new Date()) return; // can't go into future
    setDate(d);
  };

  /* ── save entry ── */
  const handleSave = async () => {
    if (!age || parsedAge <= 0) {
      Alert.alert('Age required', 'Please enter your age here or set it in your Profile.');
      return;
    }
    if (quality === null) {
      Alert.alert('Quality', 'Please rate your sleep quality (1-5).');
      return;
    }

    const entry = {
      id: `${Date.now()}`,
      date: formatDate(date),
      bedTime: formatTime(bedHour, bedMin),
      wakeTime: formatTime(wakeHour, wakeMin),
      sleepHours: Number(sleepHours.toFixed(2)),
      quality,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [entry, ...logs].slice(0, 60); // keep last 60
    setLogs(updated);
    await saveData(SLEEP_LOG_KEY, SYNC_DOCS.SLEEP_LOGS, updated);

    // Recalculate MP from last 2 days
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    const recent = updated.filter((l) => new Date(l.date) >= twoDaysAgo);
    const totalHours = recent.reduce((sum, l) => sum + l.sleepHours, 0);
    const percent = Math.min(100, Math.round((totalHours / requiredHours) * 100));
    // Build wake datetime from entry date + wakeTime for MP decay anchor
    const [wH, wM] = formatTime(wakeHour, wakeMin).split(':').map(Number);
    const wakeDate = new Date(date);
    wakeDate.setHours(wH, wM, 0, 0);
    // If wake time is before bed time, it's the next morning
    if (wakeHour < bedHour) wakeDate.setDate(wakeDate.getDate() + 1);

    const summary = {
      totalHours: Number(totalHours.toFixed(2)),
      requiredHours,
      percent,
      ageRange,
      wakeTime: wakeDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSleepSummary(summary);
    await saveData(SLEEP_MP_KEY, SYNC_DOCS.SLEEP_SUMMARY, summary);

    Alert.alert('Saved!', `Logged ${entry.sleepHours}h sleep on ${entry.date}.`);
    setQuality(null);
    setNote('');
  };

  /* ── delete entry ── */
  const handleDelete = async (id) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    await saveData(SLEEP_LOG_KEY, SYNC_DOCS.SLEEP_LOGS, updated);
  };

  const handleAgeChange = async (value) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3);
    setAge(cleaned);
    try {
      // Sync to profile so ProfileScreen picks it up
      const profileData = await loadData(PROFILE_KEY, SYNC_DOCS.PROFILE) || {};
      profileData.age = Number(cleaned) || 0;
      await saveData(PROFILE_KEY, SYNC_DOCS.PROFILE, profileData);
    } catch (e) {
      // ignore
    }
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <SafeAreaView style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle}>SLEEP LOG</Text>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        renderItem={() => <>
        {/* MP summary card */}
        {sleepSummary ? (
          <View style={styles.panel}>
            <Text style={styles.label}>MP (Sleep Score)</Text>
            <Text style={styles.bigValue}>{sleepSummary.percent} / 100</Text>
            <Text style={styles.metaText}>
              Last 48h: {sleepSummary.totalHours}h • Recommended: {sleepSummary.requiredHours}h
            </Text>
          </View>
        ) : null}

        {/* age display only */}
        <View style={styles.panel}>
          <Text style={styles.label}>Age</Text>
          <Text style={styles.bigValue}>{age || 'Not set'}</Text>
          <Text style={styles.metaText}>
            Recommended sleep ({ageRange}): {requiredHours}h
          </Text>
        </View>

        {/* date picker */}
        <View style={styles.panel}>
          <Text style={styles.label}>Date</Text>
          <DateStepper
            date={date}
            onPrev={() => shiftDate(-1)}
            onNext={() => shiftDate(1)}
          />
        </View>

        {/* sleep & wake time — scroll wheels */}
        <View style={styles.panel}>
          <View style={styles.durationBanner}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.success} />
            <Text style={styles.durationText}>{sleepHours.toFixed(1)}h sleep</Text>
          </View>
          <View style={styles.wheelsContainer}>
            <WheelTimePicker
              label="BEDTIME" icon="weather-night"
              hour={bedHour} minute={bedMin}
              onChangeHour={setBedHour} onChangeMinute={setBedMin}
            />
            <View style={styles.wheelDivider} />
            <WheelTimePicker
              label="WAKE UP" icon="white-balance-sunny"
              hour={wakeHour} minute={wakeMin}
              onChangeHour={setWakeHour} onChangeMinute={setWakeMin}
            />
          </View>
        </View>

        {/* quality */}
        <View style={styles.panel}>
          <Text style={styles.label}>Sleep Quality</Text>
          <View style={styles.qualityRow}>
            {[1, 2, 3, 4, 5].map((q) => (
              <Pressable
                key={q}
                onPress={() => setQuality(q)}
                style={[styles.qualityChip, quality === q && styles.qualityChipActive]}
              >
                <MaterialCommunityIcons
                  name={q <= 2 ? 'emoticon-sad' : q === 3 ? 'emoticon-neutral' : 'emoticon-happy'}
                  size={22}
                  color={quality === q ? colors.textPrimary : colors.placeholder}
                />
                <Text style={[styles.qualityText, quality === q && styles.qualityTextActive]}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* note */}
        <View style={styles.panel}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. woke up once, felt rested"
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={200}
          />
        </View>

        {/* save button */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
        >
          <MaterialIcons name="save" size={18} color={colors.textPrimary} />
          <Text style={styles.saveBtnText}>LOG SLEEP</Text>
        </Pressable>

        {/* recent logs */}
        {logs.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.label}>Recent Logs</Text>
            {logs.slice(0, 10).map((entry) => (
              <View key={entry.id} style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDate}>{entry.date}</Text>
                  <Text style={styles.logMeta}>
                    {entry.bedTime} → {entry.wakeTime}  •  {entry.sleepHours}h  •  Q{entry.quality}/5
                  </Text>
                  {entry.note ? <Text style={styles.logNote}>{entry.note}</Text> : null}
                </View>
                <Pressable onPress={() => handleDelete(entry.id)} hitSlop={10}>
                  <MaterialIcons name="delete-outline" size={20} color="#f87171" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </>}
      />
    </SafeAreaView>
  );
};

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
  headerTitle: { color: colors.accentStrong, fontSize: 12, fontFamily: typography.family.pixel },
  content: { padding: 16, gap: 14, paddingBottom: 60 },

  panel: {
    backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, padding: 16, gap: 8,
  },
  label: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: 10 },
  bigValue: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: 32 },
  metaText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: 16 },
  input: {
    height: 40, backgroundColor: colors.surfaceAlt, borderWidth: 1,
    borderColor: colors.accentOutline, color: colors.textPrimary,
    paddingHorizontal: 10, fontFamily: typography.family.mono, fontSize: 18,
  },

  /* date stepper */
  dateStepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  dateArrow: { padding: 4 },
  dateText: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: 24 },

  /* scroll wheel time picker */
  wheelPickerWrap: { alignItems: 'center', gap: 4 },
  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactLabel: { color: colors.textMuted, fontFamily: typography.family.pixel, fontSize: 9 },
  wheelsContainer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16 },
  wheelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wheelContainer: {
    overflow: 'hidden', borderRadius: 6,
    backgroundColor: '#0a0f1a',
    borderWidth: 1, borderColor: colors.accentSoft,
  },
  wheelBand: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: colors.accentSoft,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  wheelContent: { paddingVertical: ITEM_H },
  wheelItem: { alignItems: 'center', justifyContent: 'center' },
  wheelText: { color: colors.placeholder, fontFamily: typography.family.mono, fontSize: 22 },
  wheelTextActive: { color: colors.textPrimary, fontSize: 26 },
  wheelColon: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: 14, marginTop: 36 },
  wheelDivider: { width: 1, height: 120, backgroundColor: colors.accentSoft, marginTop: 20 },
  durationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)', borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8,
  },
  durationText: { color: colors.success, fontFamily: typography.family.pixel, fontSize: 9 },

  /* quality */
  qualityRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  qualityChip: {
    width: 50, height: 50, borderRadius: 6, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  qualityChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  qualityText: { color: colors.placeholder, fontFamily: typography.family.mono, fontSize: 14 },
  qualityTextActive: { color: colors.textPrimary },

  /* save button */
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, backgroundColor: colors.accent,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: 11 },

  /* log rows */
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  logDate: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: 20 },
  logMeta: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 16 },
  logNote: { color: colors.textLabel, fontFamily: typography.family.mono, fontSize: 15, fontStyle: 'italic' },
});

export default LogSleepEntryScreen;
