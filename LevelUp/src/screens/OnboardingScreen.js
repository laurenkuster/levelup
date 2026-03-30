import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { saveData, SYNC_DOCS } from '../services/firestoreSync';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { calcAgeFromDate, isValidHunterId } from '../utils/profileHelpers';

const PROFILE_KEY = 'levelup_profile_v1';

const OnboardingScreen = ({ navigation }) => {
  /* ── state ──────────────────────────── */
  const [hunterId, setHunterId] = useState('');
  const [idStatus, setIdStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const [name, setName] = useState(auth.currentUser?.displayName || '');

  // DOB fields
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [calculatedAge, setCalculatedAge] = useState(null);

  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef(null);
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  /* ── auto-calculate age when DOB changes ─── */
  useEffect(() => {
    const m = parseInt(dobMonth, 10);
    const d = parseInt(dobDay, 10);
    const y = parseInt(dobYear, 10);

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= new Date().getFullYear()) {
      const dob = new Date(y, m - 1, d);
      if (!isNaN(dob.getTime())) {
        const age = calcAgeFromDate(dob);
        setCalculatedAge(age >= 0 && age < 150 ? age : null);
        return;
      }
    }
    setCalculatedAge(null);
  }, [dobMonth, dobDay, dobYear]);

  /* ── HunterID availability check (debounced) ─── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = hunterId.trim();
    if (!trimmed) { setIdStatus('idle'); return; }
    if (!isValidHunterId(trimmed)) { setIdStatus('invalid'); return; }

    setIdStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, 'hunterIds', trimmed.toLowerCase()));
        const takenByOther = snap.exists() && snap.data()?.uid !== auth.currentUser?.uid;
        setIdStatus(takenByOther ? 'taken' : 'available');
      } catch {
        setIdStatus('idle'); // network issue; let submit validate again
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [hunterId]);

  /* ── submit ── */
  const handleSubmit = async () => {
    const trimmedId = hunterId.trim();
    const trimmedName = name.trim();

    if (!trimmedId || !isValidHunterId(trimmedId)) {
      Alert.alert('Invalid Hunter ID', 'Must be 3-16 characters: letters, numbers, or underscores.');
      return;
    }
    if (idStatus === 'taken') {
      Alert.alert('Hunter ID Taken', 'That ID is already in use. Pick something unique!');
      return;
    }
    if (!trimmedName) {
      Alert.alert('Name Required', 'Enter your player name.');
      return;
    }
    if (calculatedAge === null) {
      Alert.alert('Invalid DOB', 'Please enter a valid date of birth.');
      return;
    }
    if (!weight || Number(weight) <= 0) {
      Alert.alert('Invalid Weight', 'Please enter your weight in kg.');
      return;
    }
    if (!height || Number(height) <= 0) {
      Alert.alert('Invalid Height', 'Please enter your height in cm.');
      return;
    }
    if (!sex) {
      Alert.alert('Sex Required', 'Please select your sex.');
      return;
    }

    setSubmitting(true);
    try {
      const uid = auth.currentUser.uid;
      const lowerHunterId = trimmedId.toLowerCase();

      // Double-check availability at write time
      const snap = await getDoc(doc(db, 'hunterIds', lowerHunterId));
      if (snap.exists() && snap.data()?.uid !== uid) {
        Alert.alert('Hunter ID Taken', 'Someone just claimed that ID. Try another!');
        setIdStatus('taken');
        setSubmitting(false);
        return;
      }

      // 1. Reserve the Hunter ID in the global hunterIds collection
      await setDoc(doc(db, 'hunterIds', lowerHunterId), {
        uid,
        displayId: trimmedId, // preserve original casing
        claimedAt: serverTimestamp(),
      });

      // 2. Save profile data
      const dobString = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
      const profileData = {
        hunterId: trimmedId,
        displayName: trimmedName,
        dob: dobString,
        age: calculatedAge,
        weight: Number(weight),
        height: Number(height),
        sex,
      };
      await saveData(PROFILE_KEY, SYNC_DOCS.PROFILE, profileData);

      // 3. Mark onboarding complete in the user doc
      await setDoc(doc(db, 'users', uid), {
        onboardingComplete: true,
        hunterId: trimmedId,
      }, { merge: true });

      // 4. Navigate to the main app
      const rootNav = navigation.getParent?.() || navigation;
      rootNav.reset({ index: 0, routes: [{ name: 'Goals' }] });
    } catch (e) {
      console.error('Onboarding error:', e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── helper: status indicator ─── */
  const renderIdStatus = () => {
    switch (idStatus) {
      case 'checking':
        return <ActivityIndicator size="small" color={colors.textLabel} style={{ marginLeft: spacing.sm }} />;
      case 'available':
        return <MaterialIcons name="check-circle" size={20} color={colors.success} style={{ marginLeft: spacing.sm }} />;
      case 'taken':
        return <MaterialIcons name="cancel" size={20} color={colors.error} style={{ marginLeft: spacing.sm }} />;
      case 'invalid':
        return <MaterialIcons name="error" size={20} color="#f59e0b" style={{ marginLeft: spacing.sm }} />;
      default:
        return null;
    }
  };

  /* ── render ─── */
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>HUNTER{'\n'}REGISTRATION</Text>
          <Text style={styles.subtitle}>Configure your character</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Hunter ID */}
          <View style={styles.section}>
            <Text style={styles.label}>HUNTER ID</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="UNIQUE_NAME"
                placeholderTextColor={colors.placeholder}
                value={hunterId}
                onChangeText={(v) => setHunterId(v.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={16}
              />
              {renderIdStatus()}
            </View>
            <Text style={styles.hint}>
              {idStatus === 'taken'
                ? '✗ Already taken — try another'
                : idStatus === 'available'
                  ? '✓ Available!'
                  : idStatus === 'invalid'
                    ? '3-16 chars: letters, numbers, underscores'
                    : 'Your unique identity. Choose wisely!'}
            </Text>
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="ENTER NAME"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* DOB */}
          <View style={styles.section}>
            <Text style={styles.label}>DATE OF BIRTH</Text>
            <View style={styles.dobRow}>
              <TextInput
                style={[styles.input, styles.dobField]}
                placeholder="MM"
                placeholderTextColor={colors.placeholder}
                value={dobMonth}
                onChangeText={(v) => {
                  const cleaned = v.replace(/[^0-9]/g, '').slice(0, 2);
                  setDobMonth(cleaned);
                  if (cleaned.length === 2) dayRef.current?.focus();
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.dobSep}>/</Text>
              <TextInput
                ref={dayRef}
                style={[styles.input, styles.dobField]}
                placeholder="DD"
                placeholderTextColor={colors.placeholder}
                value={dobDay}
                onChangeText={(v) => {
                  const cleaned = v.replace(/[^0-9]/g, '').slice(0, 2);
                  setDobDay(cleaned);
                  if (cleaned.length === 2) yearRef.current?.focus();
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.dobSep}>/</Text>
              <TextInput
                ref={yearRef}
                style={[styles.input, styles.dobFieldYear]}
                placeholder="YYYY"
                placeholderTextColor={colors.placeholder}
                value={dobYear}
                onChangeText={(v) => setDobYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            {calculatedAge !== null && (
              <Text style={styles.ageTag}>AGE: {calculatedAge}</Text>
            )}
          </View>

          {/* Weight */}
          <View style={styles.section}>
            <Text style={styles.label}>WEIGHT (KG)</Text>
            <TextInput
              style={styles.input}
              placeholder="70"
              placeholderTextColor={colors.placeholder}
              value={weight}
              onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, '').slice(0, 6))}
              keyboardType="decimal-pad"
              maxLength={6}
            />
          </View>

          {/* Height */}
          <View style={styles.section}>
            <Text style={styles.label}>HEIGHT (CM)</Text>
            <TextInput
              style={styles.input}
              placeholder="170"
              placeholderTextColor={colors.placeholder}
              value={height}
              onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, '').slice(0, 6))}
              keyboardType="decimal-pad"
              maxLength={6}
            />
          </View>

          {/* Sex */}
          <View style={styles.section}>
            <Text style={styles.label}>SEX</Text>
            <View style={styles.chipRow}>
              {['Male', 'Female', 'Other'].map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setSex(opt)}
                  style={[styles.chip, sex === opt && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sex === opt && styles.chipTextActive]}>
                    {opt.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.submitText}>BEGIN ADVENTURE</Text>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* ── styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
    alignItems: 'center',
  },
  title: {
    color: colors.accentStrong,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.lg,
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    color: colors.textTertiary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
    marginTop: spacing.sm,
  },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },

  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    gap: spacing.sm,
  },
  label: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  input: {
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
  },
  hint: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.md },
  row: { flexDirection: 'row', alignItems: 'center' },

  dobRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dobField: { flex: 1, textAlign: 'center' },
  dobFieldYear: { flex: 1.5, textAlign: 'center' },
  dobSep: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  ageTag: {
    color: colors.success,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },

  chipRow: { flexDirection: 'row', gap: spacing.md },
  chip: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  chipTextActive: { color: colors.textPrimary },

  submitBtn: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },
});

export default OnboardingScreen;
