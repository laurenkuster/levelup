import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { BODY_PARTS, EXERCISES, EXERCISES_BY_BODY_PART, EXERCISE_MAP, epley1RM } from '../config/strConstants';
import { logStrSession } from '../services/strService';

const FAVORITES_KEY = 'levelup_str_favorites_v1';

/* ── Tab labels — short forms so they never wrap ── */
const FILTER_TABS = [
  { key: null, label: 'ALL' },
  ...BODY_PARTS.map((bp) => ({ key: bp.key, label: bp.label.toUpperCase(), color: bp.color })),
];

/* ═══════════════════════════════════════════════════
   STEP FLOW: Select Exercise → Add Sets → Review & Save
   ═══════════════════════════════════════════════════ */

const LogStrEntryScreen = ({ navigation }) => {
  const [step, setStep] = useState('select'); // 'select' | 'sets' | 'review'
  const [selectedBodyPart, setSelectedBodyPart] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentExercise, setCurrentExercise] = useState(null);
  const [sets, setSets] = useState([]); // [{ exerciseId, weight, reps }]
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState({}); // { [exerciseId]: true }

  /* ── load favorites on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch (_) { /* ignore */ }
    })();
  }, []);

  const toggleFavorite = useCallback(async (exerciseId) => {
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[exerciseId]) delete next[exerciseId];
      else next[exerciseId] = true;
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /* ── search / filter exercises — favorites on top ── */
  const filteredExercises = useMemo(() => {
    let list = selectedBodyPart
      ? EXERCISES_BY_BODY_PART[selectedBodyPart] || []
      : EXERCISES;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    // Sort: favorites first, then alphabetical
    return [...list].sort((a, b) => {
      const aFav = favorites[a.id] ? 0 : 1;
      const bFav = favorites[b.id] ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.name.localeCompare(b.name);
    });
  }, [selectedBodyPart, searchQuery, favorites]);

  /* ── pick an exercise ── */
  const pickExercise = (exercise) => {
    setCurrentExercise(exercise);
    setWeight('');
    setReps('');
    setStep('sets');
  };

  /* ── add a set ── */
  const addSet = () => {
    const r = parseInt(reps, 10);
    if (!r || r <= 0) {
      Alert.alert('Invalid', 'Enter reps (> 0)');
      return;
    }
    const w = currentExercise.type === 'bodyweight' ? 0 : parseFloat(weight) || 0;
    setSets((prev) => [...prev, { exerciseId: currentExercise.id, weight: w, reps: r }]);
    setWeight('');
    setReps('');
  };

  /* ── remove a set ── */
  const removeSet = (idx) => {
    setSets((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── finish current exercise, go back to picker ── */
  const finishExercise = () => {
    setCurrentExercise(null);
    setStep('select');
  };

  /* ── save entire session ── */
  const saveSession = async () => {
    if (sets.length === 0) {
      Alert.alert('Empty', 'Add at least one set before saving.');
      return;
    }
    setSaving(true);
    try {
      const result = await logStrSession(sets);
      Alert.alert(
        'Workout Saved!',
        `+${result.totalXp} XP  |  Strength Score: ${result.strengthScore}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to save workout. Please try again.');
      console.error('[LogStr] save error:', e);
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════ RENDER ═══════════ */

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (step === 'sets') { finishExercise(); return; }
            if (step === 'review') { setStep('select'); return; }
            navigation.goBack();
          }}
          style={styles.headerBtn}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.title}>
          {step === 'select' ? 'STR ENTRY' : step === 'sets' ? currentExercise?.name?.toUpperCase() : 'REVIEW'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Session summary bar */}
      {sets.length > 0 && (
        <Pressable
          style={styles.summaryBar}
          onPress={() => setStep(step === 'review' ? 'select' : 'review')}
        >
          <MaterialCommunityIcons name="dumbbell" size={16} color={colors.accent} />
          <Text style={styles.summaryText}>
            {sets.length} set{sets.length !== 1 ? 's' : ''} logged
          </Text>
          <Text style={styles.summaryAction}>
            {step === 'review' ? '+ ADD MORE' : 'REVIEW'}
          </Text>
        </Pressable>
      )}

      {/* ── STEP: SELECT EXERCISE ── */}
      {step === 'select' && (
        <>
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Body part filter tabs */}
          <View style={styles.tabBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabScroll}
            >
              {FILTER_TABS.map((tab) => {
                const active = selectedBodyPart === tab.key;
                const activeColor = tab.color || colors.accent;
                return (
                  <Pressable
                    key={tab.key ?? '_all'}
                    onPress={() => setSelectedBodyPart(tab.key)}
                    style={[
                      styles.tab,
                      active && { borderBottomColor: activeColor },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.tabText,
                        active && { color: activeColor },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Exercise list */}
          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const bp = BODY_PARTS.find((b) => b.key === item.primary);
              const isFav = !!favorites[item.id];
              return (
                <Pressable
                  style={({ pressed }) => [styles.exerciseCard, pressed && styles.cardPressed]}
                  onPress={() => pickExercise(item)}
                >
                  <Pressable
                    onPress={() => toggleFavorite(item.id)}
                    hitSlop={8}
                    style={styles.starBtn}
                  >
                    <MaterialIcons
                      name={isFav ? 'star' : 'star-border'}
                      size={20}
                      color={isFav ? '#f59e0b' : colors.textMuted}
                    />
                  </Pressable>
                  <View style={[styles.exerciseDot, { backgroundColor: bp?.color || colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {bp?.label} · {item.subsections.map((s) => {
                        const sub = bp?.subsections.find((ss) => ss.key === s);
                        return sub?.label || s;
                      }).join(', ')}
                      {item.type === 'bodyweight' ? ' · Bodyweight' : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No exercises found</Text>
              </View>
            }
          />
        </>
      )}

      {/* ── STEP: ADD SETS ── */}
      {step === 'sets' && currentExercise && (
        <ScrollView contentContainerStyle={styles.setsContent}>
          <View style={styles.exerciseInfoPanel}>
            <Text style={styles.exerciseInfoName}>{currentExercise.name}</Text>
            <Text style={styles.exerciseInfoType}>
              {currentExercise.type === 'bodyweight' ? 'BODYWEIGHT' : 'WEIGHTED'} · {BODY_PARTS.find((b) => b.key === currentExercise.primary)?.label}
            </Text>
          </View>

          {/* Input row */}
          <View style={styles.inputPanel}>
            {currentExercise.type !== 'bodyweight' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>WEIGHT (lbs)</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REPS</Text>
              <TextInput
                style={styles.numInput}
                keyboardType="number-pad"
                value={reps}
                onChangeText={setReps}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            {currentExercise.type !== 'bodyweight' && weight && reps ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EST 1RM</Text>
                <Text style={styles.oneRMValue}>
                  {epley1RM(parseFloat(weight) || 0, parseInt(reps, 10) || 0)} lbs
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable style={styles.addSetBtn} onPress={addSet}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addSetText}>ADD SET</Text>
          </Pressable>

          {/* Sets for this exercise */}
          {sets.filter((s) => s.exerciseId === currentExercise.id).length > 0 && (
            <View style={styles.setsListPanel}>
              <Text style={styles.setsListTitle}>SETS LOGGED</Text>
              {sets.map((s, idx) => {
                if (s.exerciseId !== currentExercise.id) return null;
                return (
                  <View key={idx} style={styles.setRow}>
                    <Text style={styles.setNum}>#{sets.filter((ss, ii) => ss.exerciseId === currentExercise.id && ii <= idx).length}</Text>
                    {s.weight > 0 && <Text style={styles.setDetail}>{s.weight} lbs</Text>}
                    <Text style={styles.setDetail}>× {s.reps} reps</Text>
                    {s.weight > 0 && (
                      <Text style={styles.set1RM}>1RM: {epley1RM(s.weight, s.reps)}</Text>
                    )}
                    <Pressable onPress={() => removeSet(idx)} style={styles.setRemove}>
                      <MaterialIcons name="close" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          <Pressable style={styles.doneExerciseBtn} onPress={finishExercise}>
            <Text style={styles.doneExerciseText}>+ ADD ANOTHER EXERCISE</Text>
          </Pressable>

          {sets.length > 0 && (
            <Pressable style={styles.reviewBtn} onPress={() => setStep('review')}>
              <Text style={styles.reviewBtnText}>REVIEW & SAVE ({sets.length} sets)</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* ── STEP: REVIEW ── */}
      {step === 'review' && (
        <ScrollView contentContainerStyle={styles.reviewContent}>
          <Text style={styles.reviewTitle}>WORKOUT SUMMARY</Text>

          {/* Group sets by exercise */}
          {[...new Set(sets.map((s) => s.exerciseId))].map((exId) => {
            const exercise = EXERCISE_MAP[exId];
            const exSets = sets.filter((s) => s.exerciseId === exId);
            const bp = BODY_PARTS.find((b) => b.key === exercise?.primary);
            return (
              <View key={exId} style={styles.reviewExercise}>
                <View style={styles.reviewExHeader}>
                  <View style={[styles.exerciseDot, { backgroundColor: bp?.color || colors.accent }]} />
                  <Text style={styles.reviewExName}>{exercise?.name || exId}</Text>
                  <Text style={styles.reviewExSets}>{exSets.length} sets</Text>
                </View>
                {exSets.map((s, i) => (
                  <View key={i} style={styles.reviewSetRow}>
                    <Text style={styles.reviewSetNum}>Set {i + 1}</Text>
                    {s.weight > 0 && <Text style={styles.reviewSetDetail}>{s.weight} lbs</Text>}
                    <Text style={styles.reviewSetDetail}>× {s.reps}</Text>
                    {s.weight > 0 && <Text style={styles.reviewSet1RM}>1RM: {epley1RM(s.weight, s.reps)}</Text>}
                    <Pressable onPress={() => removeSet(sets.indexOf(s))} style={styles.setRemove}>
                      <MaterialIcons name="close" size={14} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}

          <View style={styles.reviewStats}>
            <Text style={styles.reviewStatLabel}>Total Sets: {sets.length}</Text>
            <Text style={styles.reviewStatLabel}>
              Exercises: {[...new Set(sets.map((s) => s.exerciseId))].length}
            </Text>
          </View>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={saveSession}
            disabled={saving}
          >
            <MaterialCommunityIcons name="check-bold" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'SAVE WORKOUT'}</Text>
          </Pressable>
        </ScrollView>
      )}
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
  title: { color: colors.accentStrong, fontSize: 12, fontFamily: 'PressStart2P' },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(37,123,244,0.08)',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryText: { color: colors.textSecondary, fontFamily: 'VT323', fontSize: 18, flex: 1 },
  summaryAction: { color: colors.accent, fontFamily: 'PressStart2P', fontSize: 8 },

  /* search */
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: 'VT323', fontSize: 20 },

  /* filter tabs */
  tabBar: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.header,
  },
  tabScroll: { paddingHorizontal: 4 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: {
    color: colors.textMuted, fontFamily: 'PressStart2P', fontSize: 8,
  },

  /* exercise list */
  listContent: { paddingHorizontal: 12, paddingBottom: 100, gap: 6 },
  exerciseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  cardPressed: { opacity: 0.8 },
  starBtn: { padding: 2 },
  exerciseDot: { width: 8, height: 8, borderRadius: 4 },
  exerciseName: { color: colors.textPrimary, fontFamily: 'VT323', fontSize: 22 },
  exerciseMeta: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 16 },
  emptyWrap: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 20 },

  /* sets entry */
  setsContent: { padding: 16, gap: 14, paddingBottom: 100 },
  exerciseInfoPanel: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: 16, alignItems: 'center', gap: 4,
  },
  exerciseInfoName: { color: colors.textPrimary, fontFamily: 'PressStart2P', fontSize: 11 },
  exerciseInfoType: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 18 },

  inputPanel: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-end',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: 16,
  },
  inputGroup: { flex: 1, gap: 6 },
  inputLabel: { color: colors.textLabel, fontFamily: 'PressStart2P', fontSize: 7 },
  numInput: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, color: colors.textPrimary,
    fontFamily: 'VT323', fontSize: 28, textAlign: 'center',
    paddingVertical: 10, paddingHorizontal: 8,
  },
  oneRMValue: {
    color: colors.accent, fontFamily: 'VT323', fontSize: 28,
    textAlign: 'center', paddingVertical: 10,
  },

  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, paddingVertical: 14,
  },
  addSetText: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 10 },

  setsListPanel: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: 12, gap: 8,
  },
  setsListTitle: { color: colors.textLabel, fontFamily: 'PressStart2P', fontSize: 8 },
  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  setNum: { color: colors.textMuted, fontFamily: 'PressStart2P', fontSize: 8, width: 24 },
  setDetail: { color: colors.textPrimary, fontFamily: 'VT323', fontSize: 20 },
  set1RM: { color: colors.accent, fontFamily: 'VT323', fontSize: 18, flex: 1, textAlign: 'right' },
  setRemove: { padding: 4 },

  doneExerciseBtn: {
    alignItems: 'center', paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  doneExerciseText: { color: colors.textLabel, fontFamily: 'PressStart2P', fontSize: 9 },

  reviewBtn: {
    alignItems: 'center', paddingVertical: 14,
    backgroundColor: colors.success, marginTop: 8,
  },
  reviewBtnText: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 10 },

  /* review step */
  reviewContent: { padding: 16, gap: 12, paddingBottom: 100 },
  reviewTitle: { color: colors.textLabel, fontFamily: 'PressStart2P', fontSize: 10 },
  reviewExercise: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: 12, gap: 6,
  },
  reviewExHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewExName: { color: colors.textPrimary, fontFamily: 'VT323', fontSize: 22, flex: 1 },
  reviewExSets: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 16 },
  reviewSetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 4, paddingLeft: 16,
  },
  reviewSetNum: { color: colors.textMuted, fontFamily: 'VT323', fontSize: 16, width: 40 },
  reviewSetDetail: { color: colors.textPrimary, fontFamily: 'VT323', fontSize: 18 },
  reviewSet1RM: { color: colors.accent, fontFamily: 'VT323', fontSize: 16, flex: 1, textAlign: 'right' },

  reviewStats: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  reviewStatLabel: { color: colors.textSecondary, fontFamily: 'VT323', fontSize: 20 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.success, paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 11 },
});

export default LogStrEntryScreen;
