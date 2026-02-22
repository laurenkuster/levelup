import React, { useState, useCallback, useEffect } from 'react';
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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useFocusEffect } from '@react-navigation/native';
import { signOutUser } from '../services/authService';
import { auth, db } from '../services/firebase';

const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [age, setAge] = useState('');
  const [editingAge, setEditingAge] = useState(false);

  const [uidState, setUidState] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingAge, setSavingAge] = useState(false);

  // ✅ FIX: auth.currentUser can be null on first focus (session restore).
  // Listen for auth changes and trigger reload when uid becomes available.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUidState(user?.uid ?? null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadData = async () => {
        // If auth isn't ready yet, show loading (prevents "fails to load")
        if (!authReady) {
          setLoading(true);
          return;
        }

        // If auth is ready but no user, stop loading and show defaults
        if (!uidState) {
          setProfile(null);
          setAge('');
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const userRef = doc(db, 'users', uidState);
          const snap = await getDoc(userRef);

          if (!mounted) return;

          if (snap.exists()) {
            const data = snap.data();
            setProfile(data);
            setAge(data?.age !== undefined && data?.age !== null ? String(data.age) : '');
          } else {
            // optional: if user doc doesn't exist yet, still show defaults
            setProfile(null);
            setAge('');
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
    }, [authReady, uidState])
  );

  const handleSaveAge = async () => {
    const cleaned = String(age).replace(/[^0-9]/g, '').slice(0, 3);
    const n = Number(cleaned);

    if (!cleaned || !Number.isFinite(n) || n <= 0) {
      Alert.alert('Invalid Age', 'Please enter a valid age greater than 0.');
      return;
    }

    if (!uidState) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }

    setSavingAge(true);
    try {
      // ✅ More robust than updateDoc: creates doc if missing (merge:true)
      await setDoc(doc(db, 'users', uidState), { age: n }, { merge: true });

      // ✅ Immediate UI update
      setAge(String(n));
      setProfile((prev) => ({ ...(prev || {}), age: n }));
      setEditingAge(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save age. Please try again.');
    } finally {
      setSavingAge(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigation.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
  };

  const uid = uidState || 'Unknown';
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

              <View style={styles.panel}>
                <View style={styles.ageHeader}>
                  <Text style={styles.panelLabel}>Age</Text>
                  {!editingAge && (
                    <Pressable onPress={() => setEditingAge(true)} hitSlop={8}>
                      <MaterialIcons name="edit" size={18} color="#7aaef8" />
                    </Pressable>
                  )}
                </View>

                {editingAge ? (
                  <View style={styles.ageEditRow}>
                    <TextInput
                      style={styles.ageInput}
                      value={age}
                      onChangeText={(v) => setAge(String(v).replace(/[^0-9]/g, '').slice(0, 3))}
                      placeholder="Enter age"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      maxLength={3}
                      autoFocus
                      editable={!savingAge}
                    />

                    <Pressable
                      onPress={handleSaveAge}
                      style={[styles.ageSaveBtn, savingAge && { opacity: 0.6 }]}
                      disabled={savingAge}
                    >
                      <MaterialIcons name="check" size={20} color="#FFFFFF" />
                    </Pressable>

                    <Pressable
                      onPress={() => setEditingAge(false)}
                      style={[styles.ageCancelBtn, savingAge && { opacity: 0.6 }]}
                      disabled={savingAge}
                    >
                      <MaterialIcons name="close" size={20} color="#f87171" />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.panelValue}>{age || 'Not set'}</Text>
                )}

                <Text style={styles.ageHint}>Used to calculate recommended sleep hours</Text>
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

  ageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ageEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ageInput: {
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
  ageSaveBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#257bf4',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageCancelBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#1f2937',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageHint: {
    color: '#64748b',
    fontFamily: 'VT323',
    fontSize: 14,
    marginTop: 2,
  },
});

export default ProfileScreen;