import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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

/* ───────── Time Picker ───────── */
const TimePicker = ({ label, hour, minute, onChangeHour, onChangeMinute }) => (
  <View style={styles.timePickerWrap}>
    <Text style={styles.timePickerLabel}>{label}</Text>
    <View style={styles.timeRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeScroll}
        nestedScrollEnabled
      >
        {HOURS.map((h) => (
          <Pressable
            key={`h-${h}`}
            onPress={() => onChangeHour(h)}
            style={[styles.timeChip, hour === h && styles.timeChipActive]}
          >
            <Text style={[styles.timeChipText, hour === h && styles.timeChipTextActive]}>
              {pad(h)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
    <View style={styles.timeRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeScroll}
        nestedScrollEnabled
      >
        {MINUTES.map((m) => (
          <Pressable
            key={`m-${m}`}
            onPress={() => onChangeMinute(m)}
            style={[styles.timeChip, minute === m && styles.timeChipActive]}
          >
            <Text style={[styles.timeChipText, minute === m && styles.timeChipTextActive]}>
              {pad(m)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
    <Text style={styles.selectedTime}>{formatTime(hour, minute)}</Text>
  </View>
);

/* ───────── Date stepper ───────── */
const DateStepper = ({ date, onPrev, onNext }) => (
  <View style={styles.dateStepper}>
    <Pressable onPress={onPrev} style={styles.dateArrow}>
      <MaterialIcons name="chevron-left" size={28} color="#7aaef8" />
    </Pressable>
    <Text style={styles.dateText}>{formatDate(date)}</Text>
    <Pressable onPress={onNext} style={styles.dateArrow}>
      <MaterialIcons name="chevron-right" size={28} color="#7aaef8" />
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
      const loadData = async () => {
        try {
          // Load age from local profile
          const profileRaw = await AsyncStorage.getItem(PROFILE_KEY);
          if (mounted && profileRaw) {
            const data = JSON.parse(profileRaw);
            setAge(data.age ? String(data.age) : '');
          }
          // Load logs and summary
          const [logsRaw, summaryRaw] = await Promise.all([
            AsyncStorage.getItem(SLEEP_LOG_KEY),
            AsyncStorage.getItem(SLEEP_MP_KEY),
          ]);
          if (!mounted) return;
          if (logsRaw) setLogs(JSON.parse(logsRaw));
          if (summaryRaw) setSleepSummary(JSON.parse(summaryRaw));
        } catch (e) {
          // silently ignore load errors
        }
      };
      loadData();
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
    await AsyncStorage.setItem(SLEEP_LOG_KEY, JSON.stringify(updated));

    // Recalculate MP from last 2 days
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    const recent = updated.filter((l) => new Date(l.date) >= twoDaysAgo);
    const totalHours = recent.reduce((sum, l) => sum + l.sleepHours, 0);
    const percent = Math.min(100, Math.round((totalHours / requiredHours) * 100));
    const summary = {
      totalHours: Number(totalHours.toFixed(2)),
      requiredHours,
      percent,
      ageRange,
      updatedAt: new Date().toISOString(),
    };
    setSleepSummary(summary);
    await AsyncStorage.setItem(SLEEP_MP_KEY, JSON.stringify(summary));

    Alert.alert('Saved!', `Logged ${entry.sleepHours}h sleep on ${entry.date}.`);
    setQuality(null);
    setNote('');
  };

  /* ── delete entry ── */
  const handleDelete = async (id) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    await AsyncStorage.setItem(SLEEP_LOG_KEY, JSON.stringify(updated));
  };

  const handleAgeChange = async (value) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3);
    setAge(cleaned);
    try {
      await AsyncStorage.setItem(AGE_KEY, cleaned);
      // Also sync to profile so ProfileScreen picks it up
      const profileRaw = await AsyncStorage.getItem(PROFILE_KEY);
      const profileData = profileRaw ? JSON.parse(profileRaw) : {};
      profileData.age = Number(cleaned) || 0;
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
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
          <MaterialIcons name="arrow-back" size={22} color="#257bf4" />
        </Pressable>
        <Text style={styles.headerTitle}>SLEEP LOG</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

            // Age is now fetched from Firestore only
            label="Bedtime (HH then MM)"
            hour={bedHour}
            minute={bedMin}
            onChangeHour={setBedHour}
            onChangeMinute={setBedMin}
          />
        </View>

        {/* wake time */}
        <View style={styles.panel}>
          <TimePicker
            label="Wake Time (HH then MM)"
            hour={wakeHour}
            minute={wakeMin}
            onChangeHour={setWakeHour}
            onChangeMinute={setWakeMin}
          />
        </View>

        {/* duration display */}
        <View style={styles.panel}>
          <Text style={styles.label}>Duration</Text>
          <Text style={styles.bigValue}>{sleepHours.toFixed(1)}h</Text>
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
                  color={quality === q ? '#FFFFFF' : '#64748b'}
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
            placeholderTextColor="#64748b"
            multiline
            maxLength={200}
          />
        </View>

        {/* save button */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
        >
          <MaterialIcons name="save" size={18} color="#FFFFFF" />
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
      </ScrollView>
    </SafeAreaView>
  );
};

/* ═══════════ STYLES ═══════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1B26' },
  header: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: '#3B82F6', fontSize: 12, fontFamily: 'PressStart2P' },
  content: { padding: 16, gap: 14, paddingBottom: 60 },

  panel: {
    backgroundColor: '#111827', borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.4)', padding: 16, gap: 8,
  },
  label: { color: '#7aaef8', fontFamily: 'PressStart2P', fontSize: 10 },
  bigValue: { color: '#FFFFFF', fontFamily: 'VT323', fontSize: 32 },
  metaText: { color: '#cbd5e1', fontFamily: 'VT323', fontSize: 16 },
  input: {
    height: 40, backgroundColor: '#0f172a', borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)', color: '#FFFFFF',
    paddingHorizontal: 10, fontFamily: 'VT323', fontSize: 18,
  },

  /* date stepper */
  dateStepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  dateArrow: { padding: 4 },
  dateText: { color: '#FFFFFF', fontFamily: 'VT323', fontSize: 24 },

  /* time picker */
  timePickerWrap: { gap: 6 },
  timePickerLabel: { color: '#cbd5e1', fontFamily: 'PressStart2P', fontSize: 9 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeScroll: { gap: 6, paddingVertical: 4 },
  timeChip: {
    width: 36, height: 36, borderRadius: 4, backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  timeChipActive: { backgroundColor: '#257bf4', borderColor: '#257bf4' },
  timeChipText: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 18 },
  timeChipTextActive: { color: '#FFFFFF' },
  selectedTime: { color: '#FFFFFF', fontFamily: 'VT323', fontSize: 22, textAlign: 'center' },

  /* quality */
  qualityRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  qualityChip: {
    width: 50, height: 50, borderRadius: 6, backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.3)',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  qualityChipActive: { backgroundColor: '#257bf4', borderColor: '#257bf4' },
  qualityText: { color: '#64748b', fontFamily: 'VT323', fontSize: 14 },
  qualityTextActive: { color: '#FFFFFF' },

  /* save button */
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, backgroundColor: '#257bf4',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.7)',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { color: '#FFFFFF', fontFamily: 'PressStart2P', fontSize: 11 },

  /* log rows */
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  logDate: { color: '#e2e8f0', fontFamily: 'VT323', fontSize: 20 },
  logMeta: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 16 },
  logNote: { color: '#7aaef8', fontFamily: 'VT323', fontSize: 15, fontStyle: 'italic' },
});

export default LogSleepEntryScreen;
