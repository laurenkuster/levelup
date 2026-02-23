import React, { useState, useCallback } from 'react';
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
import { signOutUser } from '../services/authService';
import { auth } from '../services/firebase';

const PROFILE_KEY = 'levelup_profile_v1';

const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState('');
  const [editingAge, setEditingAge] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [editingHeight, setEditingHeight] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadData = async () => {
        setLoading(true);
        try {
          const raw = await AsyncStorage.getItem(PROFILE_KEY);
          if (!mounted) return;

          if (raw) {
            const data = JSON.parse(raw);
            setProfile(data);
            setAge(data?.age != null ? String(data.age) : '');
            setWeight(data?.weight != null ? String(data.weight) : '');
            setHeight(data?.height != null ? String(data.height) : '');
            setSex(data?.sex || '');
          } else {
            setProfile(null);
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

      loadData();

      return () => {
        mounted = false;
      };
    }, [])
  );

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
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      setProfile(updated);
      return n;
    } catch (e) {
      Alert.alert('Error', `Could not save ${field.toLowerCase()}. Please try again.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAge = async () => {
    const result = await saveField('Age', age, 3, false);
    if (result !== false) { setAge(String(result)); setEditingAge(false); }
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
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      setProfile(updated);
    } catch (e) {
      Alert.alert('Error', 'Could not save sex. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigation.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
  };

  const uid = auth.currentUser?.uid || 'Unknown';
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
            <MaterialIcons name="arrow-back" size={22} color="#257bf4" />
          </Pressable>

          <Text style={styles.title}>PROFILE</Text>

          <Pressable onPress={handleSignOut} style={styles.headerBtn}>
            <MaterialIcons name="logout" size={22} color="#94a3b8" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {loading ? (
            <View style={[styles.panel, { alignItems: 'center', paddingVertical: 24 }]}>
              <ActivityIndicator />
              <Text style={{ color: '#64748b', fontFamily: 'VT323', fontSize: 16, marginTop: 8 }}>
                Loading profile...
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.panel}>
                <Text style={styles.panelLabel}>UID</Text>
                <Text style={styles.panelValue} numberOfLines={1} ellipsizeMode="middle" selectable>
                  {uid}
                </Text>

                <Text style={styles.panelLabel}>Email</Text>
                <Text
                  style={[styles.panelValue, { textTransform: 'uppercase' }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  selectable
                >
                  {email}
                </Text>

                <Text style={styles.panelLabel}>Hunter ID</Text>
                <Text
                  style={[styles.panelValue, { textTransform: 'uppercase' }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                  selectable
                >
                  {email}
                </Text>

                <Text style={styles.panelLabel}>Name</Text>
                <Text style={styles.panelValue}>{profile?.displayName || 'Rookie Hunter'}</Text>

                <Text style={styles.panelLabel}>Guild Rank</Text>
                <Text style={styles.panelValue}>E-CLASS</Text>
              </View>

              {/* Age */}
              <View style={styles.panel}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.panelLabel}>Age</Text>
                  {!editingAge && (
                    <Pressable onPress={() => setEditingAge(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color="#7aaef8" />
                    </Pressable>
                  )}
                </View>
                {editingAge ? (
                  <View style={styles.fieldEditRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={age}
                      onChangeText={(v) => setAge(v.replace(/[^0-9]/g, '').slice(0, 3))}
                      placeholder="Enter age"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      maxLength={3}
                      autoFocus
                      editable={!saving}
                    />
                    <Pressable onPress={handleSaveAge} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color="#FFFFFF" />
                    </Pressable>
                    <Pressable onPress={() => setEditingAge(false)} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.panelValue}>{age ? `${age} yrs` : 'Not set'}</Text>
                )}
                <Text style={styles.fieldHint}>Used to calculate recommended sleep hours</Text>
              </View>

              {/* Weight */}
              <View style={styles.panel}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.panelLabel}>Weight</Text>
                  {!editingWeight && (
                    <Pressable onPress={() => setEditingWeight(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color="#7aaef8" />
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
                      placeholderTextColor="#64748b"
                      keyboardType="decimal-pad"
                      maxLength={6}
                      autoFocus
                      editable={!saving}
                    />
                    <Pressable onPress={handleSaveWeight} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color="#FFFFFF" />
                    </Pressable>
                    <Pressable onPress={() => setEditingWeight(false)} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
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
                      <MaterialIcons name="edit" size={18} color="#7aaef8" />
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
                      placeholderTextColor="#64748b"
                      keyboardType="decimal-pad"
                      maxLength={6}
                      autoFocus
                      editable={!saving}
                    />
                    <Pressable onPress={handleSaveHeight} style={[styles.fieldSaveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="check" size={20} color="#FFFFFF" />
                    </Pressable>
                    <Pressable onPress={() => setEditingHeight(false)} style={[styles.fieldCancelBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
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
  container: { flex: 1, backgroundColor: '#1A1B26' },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  title: { color: '#3B82F6', fontSize: 16, fontFamily: 'PressStart2P' },
  content: { padding: 16, paddingBottom: 24, gap: 14 },

  panel: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.35)',
    padding: 16,
    gap: 6,
  },
  panelLabel: { color: '#7aaef8', fontFamily: 'PressStart2P', fontSize: 10 },
  panelValue: { color: '#fff', fontFamily: 'VT323', fontSize: 22, marginBottom: 8 },

  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  fieldInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)',
    color: '#FFFFFF',
    paddingHorizontal: 10,
    fontFamily: 'VT323',
    fontSize: 20,
  },
  fieldSaveBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#257bf4',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCancelBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#1f2937',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  chip: {
    flex: 1,
    height: 40,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.3)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#257bf4',
    borderColor: '#257bf4',
  },
  chipText: {
    color: '#64748b',
    fontFamily: 'PressStart2P',
    fontSize: 9,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  fieldHint: {
    color: '#64748b',
    fontFamily: 'VT323',
    fontSize: 14,
    marginTop: 2,
  },
});

export default ProfileScreen;