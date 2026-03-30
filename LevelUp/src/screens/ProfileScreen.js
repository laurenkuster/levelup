import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signOutUser } from '../services/authService';
import { auth, db } from '../services/firebase';
import { saveData, loadData, SYNC_DOCS } from '../services/firestoreSync';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { calcAgeFromString } from '../utils/profileHelpers';

const PROFILE_KEY = 'levelup_profile_v1';

const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [hunterId, setHunterId] = useState('');
  const [editingHunterId, setEditingHunterId] = useState(false);
  const [hunterIdStatus, setHunterIdStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState('');
  const [editingWeight, setEditingWeight] = useState(false);
  const [editingHeight, setEditingHeight] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
        try {
          const data = await loadData(PROFILE_KEY, SYNC_DOCS.PROFILE);
          if (!mounted) return;

          if (data) {
            setProfile(data);
            setHunterId(data?.hunterId || '');
            setName(data?.displayName || '');
            setDob(data?.dob || '');
            setAge(data?.dob ? calcAgeFromString(data.dob) : (data?.age != null ? String(data.age) : ''));
            setWeight(data?.weight != null ? String(data.weight) : '');
            setHeight(data?.height != null ? String(data.height) : '');
            setSex(data?.sex || '');
          } else {
            setProfile(null);
            setHunterId('');
            setName('');
            setDob('');
            setAge('');
            setWeight('');
            setHeight('');
            setSex('');
          }
        } catch (e) {
          if (mounted) Alert.alert('Error', 'Failed to load profile.');
        } finally {
          if (mounted) setLoading(false);
        }
      };

      load();

      return () => {
        mounted = false;
      };
    }, [])
  );

  /* ── HunterID availability check (debounced) ─── */
  useEffect(() => {
    if (!editingHunterId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = hunterId.trim();
    if (!trimmed) { setHunterIdStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(trimmed)) { setHunterIdStatus('invalid'); return; }
    // If same as current profile value, no check needed
    if (trimmed.toLowerCase() === (profile?.hunterId || '').toLowerCase()) {
      setHunterIdStatus('available');
      return;
    }

    setHunterIdStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, 'hunterIds', trimmed.toLowerCase()));
        const takenByOther = snap.exists() && snap.data()?.uid !== auth.currentUser?.uid;
        setHunterIdStatus(takenByOther ? 'taken' : 'available');
      } catch {
        setHunterIdStatus('idle');
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [hunterId, editingHunterId]);

  const saveField = async (field, rawValue, maxLen, allowDecimal) => {
    const pattern = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
    const cleaned = String(rawValue).replace(pattern, '').slice(0, maxLen);
    const n = Number(cleaned);

    if (!cleaned || !Number.isFinite(n) || n <= 0) {
      Alert.alert(`Invalid ${field}`, `Please enter a valid ${field.toLowerCase()} greater than 0.`);
      return false;
    }

    setSaving(true);
    try {
      const updated = { ...(profile || {}), [field.toLowerCase()]: n };
      await saveData(PROFILE_KEY, SYNC_DOCS.PROFILE, updated);
      setProfile(updated);
      return n;
    } catch (e) {
      Alert.alert('Error', `Could not save ${field.toLowerCase()}. Please try again.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHunterId = async () => {
    const trimmed = hunterId.trim();
    if (!trimmed || !/^[a-zA-Z0-9_]{3,16}$/.test(trimmed)) {
      Alert.alert('Invalid Hunter ID', '3-16 characters: letters, numbers, or underscores.');
      return;
    }
    if (hunterIdStatus === 'taken') {
      Alert.alert('Taken', 'That Hunter ID is already in use.');
      return;
    }

    setSaving(true);
    try {
      const uid = auth.currentUser.uid;
      const lowerNew = trimmed.toLowerCase();
      const lowerOld = (profile?.hunterId || '').toLowerCase();

      // Double-check availability
      const snap = await getDoc(doc(db, 'hunterIds', lowerNew));
      if (snap.exists() && snap.data()?.uid !== uid) {
        Alert.alert('Taken', 'Someone just claimed that ID.');
        setHunterIdStatus('taken');
        setSaving(false);
        return;
      }

      // Remove old reservation if changing
      if (lowerOld && lowerOld !== lowerNew) {
        try { await deleteDoc(doc(db, 'hunterIds', lowerOld)); } catch {}
      }

      // Reserve new
      await setDoc(doc(db, 'hunterIds', lowerNew), {
        uid,
        displayId: trimmed,
        claimedAt: serverTimestamp(),
      });

      // Update profile + user doc
      const updated = { ...(profile || {}), hunterId: trimmed };
      await saveData(PROFILE_KEY, SYNC_DOCS.PROFILE, updated);
      await updateDoc(doc(db, 'users', uid), { hunterId: trimmed });
      setProfile(updated);
      setEditingHunterId(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save Hunter ID.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = { ...(profile || {}), displayName: trimmed };
      await saveData(PROFILE_KEY, SYNC_DOCS.PROFILE, updated);
      setProfile(updated);
      setEditingName(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save name.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAge = async () => {
    const result = await saveField('Age', age, 3, false);
    if (result !== false) { setAge(String(result)); }
  };

  const handleSaveWeight = async () => {
    const result = await saveField('Weight', weight, 6, true);
    if (result !== false) { setWeight(String(result)); setEditingWeight(false); }
  };

  const handleSaveHeight = async () => {
    const result = await saveField('Height', height, 6, true);
    if (result !== false) { setHeight(String(result)); setEditingHeight(false); }
  };

  const handleSaveSex = async (value) => {
    setSex(value);
    try {
      const updated = { ...(profile || {}), sex: value };
      await saveData(PROFILE_KEY, SYNC_DOCS.PROFILE, updated);
      setProfile(updated);
    } catch (e) {
      Alert.alert('Error', 'Could not save sex. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigation.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
  };

  const email = auth.currentUser?.email || 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
          </Pressable>

          <Text style={styles.title}>PROFILE</Text>

          <Pressable onPress={handleSignOut} style={styles.headerBtn}>
            <MaterialIcons name="logout" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {loading ? (
            <View style={[styles.panel, { alignItems: 'center', paddingVertical: spacing.xl }]}>
              <ActivityIndicator />
              <Text style={{ color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.md, marginTop: spacing.sm }}>
                Loading profile...
              </Text>
            </View>
          ) : (
            <>
              {/* Identity Panel */}
              <View style={styles.panel}>
                <Text style={styles.panelLabel}>Hunter ID</Text>
                {editingHunterId ? (
                  <View style={styles.fieldEditRow}>
                    <TextInput
                      style={[styles.fieldInput, { flex: 1 }]}
                      value={hunterId}
                      onChangeText={(v) => setHunterId(v.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
                      placeholder="UNIQUE_NAME"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={16}
                      autoFocus
                      editable={!saving}
                    />
                    {hunterIdStatus === 'checking' && <ActivityIndicator size="small" color={colors.textLabel} style={{ marginLeft: spacing.sm }} />}
                    {hunterIdStatus === 'available' && <MaterialIcons name="check-circle" size={20} color={colors.success} style={{ marginLeft: spacing.sm }} />}
                    {hunterIdStatus === 'taken' && <MaterialIcons name="cancel" size={20} color={colors.error} style={{ marginLeft: spacing.sm }} />}
                    <Pressable onPress={handleSaveHunterId} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable onPress={() => { setEditingHunterId(false); setHunterId(profile?.hunterId || ''); setHunterIdStatus('idle'); }} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.fieldHeader}>
                    <Text style={[styles.panelValue, { textTransform: 'uppercase' }]}>{hunterId || 'Not set'}</Text>
                    <Pressable onPress={() => setEditingHunterId(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color={colors.textLabel} />
                    </Pressable>
                  </View>
                )}

                <Text style={styles.panelLabel}>Name</Text>
                {editingName ? (
                  <View style={styles.fieldEditRow}>
                    <TextInput
                      style={[styles.fieldInput, { flex: 1 }]}
                      value={name}
                      onChangeText={setName}
                      placeholder="ENTER NAME"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="words"
                      autoFocus
                      editable={!saving}
                    />
                    <Pressable onPress={handleSaveName} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable onPress={() => { setEditingName(false); setName(profile?.displayName || ''); }} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.fieldHeader}>
                    <Text style={styles.panelValue}>{name || 'Rookie Hunter'}</Text>
                    <Pressable onPress={() => setEditingName(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color={colors.textLabel} />
                    </Pressable>
                  </View>
                )}

                <Text style={styles.panelLabel}>Email</Text>
                <Text
                  style={[styles.panelValue, { textTransform: 'uppercase' }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  selectable
                >
                  {email}
                </Text>

                <Text style={styles.panelLabel}>Guild Rank</Text>
                <Text style={styles.panelValue}>E-CLASS</Text>
              </View>

              {/* DOB / Age (read-only — set during onboarding) */}
              <View style={styles.panel}>
                <Text style={styles.panelLabel}>Date of Birth</Text>
                <Text style={styles.panelValue}>{dob || 'Not set'}</Text>
                <Text style={styles.panelLabel}>Age</Text>
                <Text style={styles.panelValue}>{age ? `${age} yrs` : 'Not set'}</Text>
                <Text style={styles.fieldHint}>Calculated from date of birth</Text>
              </View>
              {/* Weight */}
              <View style={styles.panel}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.panelLabel}>Weight</Text>
                  {!editingWeight && (
                    <Pressable onPress={() => setEditingWeight(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color={colors.textLabel} />
                    </Pressable>
                  )}
                </View>
                {editingWeight ? (
                  <View style={styles.fieldEditRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={weight}
                      onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, '').slice(0, 6))}
                      placeholder="Enter weight (kg)"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                      maxLength={6}
                      autoFocus
                      editable={!saving}
                    />
                    <Pressable onPress={handleSaveWeight} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable onPress={() => setEditingWeight(false)} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.panelValue}>{weight ? `${weight} kg` : 'Not set'}</Text>
                )}
                <Text style={styles.fieldHint}>Used for fitness calculations</Text>
              </View>

              {/* Height */}
              <View style={styles.panel}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.panelLabel}>Height</Text>
                  {!editingHeight && (
                    <Pressable onPress={() => setEditingHeight(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color={colors.textLabel} />
                    </Pressable>
                  )}
                </View>
                {editingHeight ? (
                  <View style={styles.fieldEditRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={height}
                      onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, '').slice(0, 6))}
                      placeholder="Enter height (cm)"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                      maxLength={6}
                      autoFocus
                      editable={!saving}
                    />
                    <Pressable onPress={handleSaveHeight} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable onPress={() => setEditingHeight(false)} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.panelValue}>{height ? `${height} cm` : 'Not set'}</Text>
                )}
                <Text style={styles.fieldHint}>Used for fitness calculations</Text>
              </View>

              {/* Sex / Gender */}
              <View style={styles.panel}>
                <Text style={styles.panelLabel}>Sex</Text>
                <View style={styles.chipRow}>
                  {['Male', 'Female', 'Other'].map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => handleSaveSex(option)}
                      style={[styles.chip, sex === option && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, sex === option && styles.chipTextActive]}>
                        {option.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldHint}>Used for personalized recommendations</Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.accentStrong, fontSize: typography.size.lg, fontFamily: typography.family.pixel },
  content: { padding: spacing.base, paddingBottom: spacing.xl, gap: spacing.base },

  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    gap: spacing.sm,
  },
  panelLabel: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  panelValue: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl, marginBottom: spacing.sm },

  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  fieldInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
  },
  fieldSaveBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCancelBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textTertiary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  fieldHint: {
    color: colors.textTertiary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
    marginTop: spacing.valueLabelGap,
  },
});

export default ProfileScreen;