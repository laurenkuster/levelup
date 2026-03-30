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
import { typography, spacing } from '../theme/typography';
import { BODY_PARTS, EXERCISES, EXERCISES_BY_BODY_PART, EXERCISE_MAP, epley1RM } from '../config/strConstants';
import { logStrSession } from '../services/strService';
import { trackStrSession } from '../services/trackingService';

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
      trackStrSession({ totalXp: result.totalXp, setsCount: sets.length, strengthScore: result.strengthScore });
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
            <MaterialIcons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={colors.textSecondary} />
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
                      color={isFav ? '#f59e0b' : colors.textSecondary}
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
                  <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
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
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 34, alignItems: 'center' },
  title: { color: colors.accentStrong, fontSize: typography.size.md, fontFamily: typography.family.pixel },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    backgroundColor: 'rgba(37,123,244,0.08)',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, flex: 1 },
  summaryAction: { color: colors.accent, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  /* search */
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl },

  /* filter tabs */
  tabBar: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.header,
  },
  tabScroll: { paddingHorizontal: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: {
    color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs,
  },

  /* exercise list */
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 100, gap: spacing.xs },
  exerciseCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  cardPressed: { opacity: 0.8 },
  starBtn: { padding: spacing.valueLabelGap },
  exerciseDot: { width: 8, height: 8, borderRadius: 4 },
  exerciseName: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  exerciseMeta: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  emptyWrap: { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyText: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.xl },

  /* sets entry */
  setsContent: { padding: spacing.base, gap: spacing.md, paddingBottom: 100 },
  exerciseInfoPanel: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: spacing.base, alignItems: 'center', gap: spacing.xs,
  },
  exerciseInfoName: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  exerciseInfoType: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  inputPanel: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: spacing.base,
  },
  inputGroup: { flex: 1, gap: spacing.xs },
  inputLabel: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  numInput: {
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt, color: colors.textPrimary,
    fontFamily: typography.family.mono, fontSize: typography.size.xxl, textAlign: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
  },
  oneRMValue: {
    color: colors.accent, fontFamily: typography.family.mono, fontSize: typography.size.xxl,
    textAlign: 'center', paddingVertical: spacing.sm,
  },

  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.accent, paddingVertical: spacing.md,
  },
  addSetText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },

  setsListPanel: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.sm,
  },
  setsListTitle: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  setRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.15)',
  },
  setNum: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs, width: 24 },
  setDetail: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  set1RM: { color: colors.accent, fontFamily: typography.family.mono, fontSize: typography.size.lg, flex: 1, textAlign: 'right' },
  setRemove: { padding: spacing.xs },

  doneExerciseBtn: {
    alignItems: 'center', paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  doneExerciseText: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  reviewBtn: {
    alignItems: 'center', paddingVertical: spacing.md,
    backgroundColor: colors.success, marginTop: spacing.sm,
  },
  reviewBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },

  /* review step */
  reviewContent: { padding: spacing.base, gap: spacing.md, paddingBottom: 100 },
  reviewTitle: { color: colors.textLabel, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  reviewExercise: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.xs,
  },
  reviewExHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewExName: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl, flex: 1 },
  reviewExSets: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  reviewSetRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, paddingLeft: spacing.base,
  },
  reviewSetNum: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg, width: 40 },
  reviewSetDetail: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  reviewSet1RM: { color: colors.accent, fontFamily: typography.family.mono, fontSize: typography.size.lg, flex: 1, textAlign: 'right' },

  reviewStats: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  reviewStatLabel: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.xl },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.success, paddingVertical: spacing.base,
  },
  saveBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
});

export default LogStrEntryScreen;
