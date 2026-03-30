import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { FLEX_ZONES, STRETCHES, STRETCH_MAP } from '../config/dexConstants';
import { logDexSession, calcSessionDexScore, calcDexXP } from '../services/dexService';
import { trackDexSession } from '../services/trackingService';

const ACCENT = '#f97316';
const FAV_KEY = 'levelup_dex_favorites_v1';

const FILTER_TABS = [
  { key: 'ALL', label: 'ALL' },
  ...FLEX_ZONES.map((z) => ({ key: z.key, label: z.label.toUpperCase(), color: z.color })),
];

const LogDexEntryScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1: select, 2: log metrics, 3: review
  const [selectedStretch, setSelectedStretch] = useState(null);
  const [entries, setEntries] = useState([]); // [{ stretchId, duration, reps }]
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [saving, setSaving] = useState(false);

  // Metric inputs for step 2
  const [duration, setDuration] = useState('');
  const [reps, setReps] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then((raw) => {
      if (raw) setFavorites(JSON.parse(raw));
    });
  }, []);

  const toggleFavorite = async (id) => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(next);
    await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  // Filtered + sorted stretches
  const filteredStretches = STRETCHES
    .filter((s) => filter === 'ALL' || s.primary === filter)
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      return aFav - bFav || a.name.localeCompare(b.name);
    });

  // ── STEP 1: Select Stretch ──
  const handleSelectStretch = (stretch) => {
    setSelectedStretch(stretch);
    setDuration('');
    setReps('');
    setStep(2);
  };

  // ── STEP 2: Add Entry ──
  const handleAddEntry = () => {
    if (!selectedStretch) return;
    const isDynamic = selectedStretch.type === 'dynamic';
    const val = isDynamic ? parseInt(reps, 10) : parseInt(duration, 10);
    if (!val || val <= 0) {
      Alert.alert('Missing data', isDynamic ? 'Enter reps performed.' : 'Enter hold duration in seconds.');
      return;
    }

    setEntries((prev) => [
      ...prev,
      {
        stretchId: selectedStretch.id,
        duration: isDynamic ? 0 : val,
        reps: isDynamic ? val : 0,
      },
    ]);
    setSelectedStretch(null);
    setStep(1);
  };

  // ── STEP 3: Save Session ──
  const handleSave = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await logDexSession(entries);
      trackDexSession({ totalXp: previewXP.totalXp, stretchCount: entries.length });
      navigation.goBack();
    } catch (e) {
      console.error('[LogDex] save error:', e);
      Alert.alert('Error', 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  // Preview stats
  const previewScore = calcSessionDexScore(entries);
  const previewXP = calcDexXP(entries);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { if (step > 1 && step < 3) setStep(step - 1); else navigation.goBack(); }} style={styles.headerBtn}>
          <MaterialIcons name={step > 1 ? 'arrow-back' : 'close'} size={22} color={ACCENT} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 1 ? 'SELECT STRETCH' : step === 2 ? 'LOG METRICS' : 'REVIEW SESSION'}
        </Text>
        {entries.length > 0 && step === 1 ? (
          <Pressable onPress={() => setStep(3)} style={[styles.headerBtn, { backgroundColor: `${ACCENT}20` }]}>
            <Text style={[styles.headerBtnText, { color: ACCENT }]}>DONE ({entries.length})</Text>
          </Pressable>
        ) : <View style={styles.headerBtn} />}
      </View>

      {/* ═══ STEP 1: Stretch List ═══ */}
      {step === 1 && (
        <>
          {/* Filter Tabs */}
          <View style={styles.tabBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabScroll}
            >
              {FILTER_TABS.map((tab) => {
                const active = filter === tab.key;
                const activeColor = tab.color || ACCENT;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setFilter(tab.key)}
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

          {/* Search */}
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={18} color={colors.placeholder} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search stretches..."
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Stretch List */}
          <ScrollView contentContainerStyle={styles.listContent}>
            {filteredStretches.map((stretch) => {
              const zone = FLEX_ZONES.find((z) => z.key === stretch.primary);
              const isFav = favorites.includes(stretch.id);
              const typeBadge = stretch.type === 'dynamic' ? 'DYNAMIC' : stretch.type === 'yoga' ? 'YOGA' : 'STATIC';
              return (
                <Pressable key={stretch.id} style={styles.stretchRow} onPress={() => handleSelectStretch(stretch)}>
                  <View style={[styles.stretchDot, { backgroundColor: zone?.color || colors.placeholder }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stretchName}>{stretch.name}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.valueLabelGap }}>
                      <Text style={[styles.stretchType, { color: zone?.color || colors.placeholder }]}>{typeBadge}</Text>
                      <Text style={styles.stretchDiff}>{'*'.repeat(stretch.difficulty)}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => toggleFavorite(stretch.id)} hitSlop={12}>
                    <MaterialIcons name={isFav ? 'star' : 'star-border'} size={22} color={isFav ? '#eab308' : colors.placeholder} />
                  </Pressable>
                  <MaterialIcons name="chevron-right" size={22} color={colors.placeholder} />
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* ═══ STEP 2: Log Metrics ═══ */}
      {step === 2 && selectedStretch && (
        <ScrollView contentContainerStyle={styles.metricsContent}>
          <View style={styles.metricsCard}>
            <Text style={styles.metricsTitle}>{selectedStretch.name.toUpperCase()}</Text>
            <Text style={styles.metricsSubtitle}>
              {selectedStretch.type === 'dynamic' ? 'Dynamic — enter reps' : 'Hold — enter duration in seconds'}
            </Text>
            <Text style={styles.metricsDiff}>
              Difficulty: {'*'.repeat(selectedStretch.difficulty)}{'  '}({selectedStretch.difficulty}/5)
            </Text>

            {selectedStretch.type === 'dynamic' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REPS</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={reps}
                  onChangeText={setReps}
                  placeholder="e.g. 15"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>HOLD (SECONDS)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g. 30"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            )}

            <Pressable style={styles.addBtn} onPress={handleAddEntry}>
              <MaterialIcons name="add" size={20} color={colors.textPrimary} />
              <Text style={styles.addBtnText}>ADD STRETCH</Text>
            </Pressable>
          </View>

          {/* Already added */}
          {entries.length > 0 && (
            <View style={styles.addedPanel}>
              <Text style={styles.addedTitle}>ADDED ({entries.length})</Text>
              {entries.map((e, i) => {
                const s = STRETCH_MAP[e.stretchId];
                return (
                  <View key={i} style={styles.addedRow}>
                    <Text style={styles.addedName}>{s?.name || e.stretchId}</Text>
                    <Text style={styles.addedVal}>
                      {e.reps > 0 ? `${e.reps} reps` : `${e.duration}s`}
                    </Text>
                    <Pressable onPress={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                      <MaterialIcons name="close" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ═══ STEP 3: Review & Save ═══ */}
      {step === 3 && (
        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.reviewPanel}>
            <Text style={styles.reviewTitle}>SESSION SUMMARY</Text>

            <View style={styles.reviewStatsRow}>
              <View style={styles.reviewStat}>
                <Text style={styles.reviewStatVal}>{entries.length}</Text>
                <Text style={styles.reviewStatLabel}>STRETCHES</Text>
              </View>
              <View style={styles.reviewStat}>
                <Text style={styles.reviewStatVal}>{previewScore}</Text>
                <Text style={styles.reviewStatLabel}>DEX SCORE</Text>
              </View>
              <View style={styles.reviewStat}>
                <Text style={[styles.reviewStatVal, { color: ACCENT }]}>+{previewXP.totalXp}</Text>
                <Text style={styles.reviewStatLabel}>XP</Text>
              </View>
            </View>

            {entries.map((e, i) => {
              const s = STRETCH_MAP[e.stretchId];
              const zone = FLEX_ZONES.find((z) => z.key === s?.primary);
              return (
                <View key={i} style={styles.reviewRow}>
                  <View style={[styles.stretchDot, { backgroundColor: zone?.color || colors.placeholder }]} />
                  <Text style={styles.reviewName}>{s?.name || e.stretchId}</Text>
                  <Text style={styles.reviewVal}>
                    {e.reps > 0 ? `${e.reps} reps` : `${e.duration}s hold`}
                  </Text>
                </View>
              );
            })}
          </View>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <MaterialCommunityIcons name="yoga" size={20} color={colors.textPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'SAVE SESSION'}</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(249,115,22,0.35)',
    backgroundColor: colors.header,
  },
  headerBtn: { width: 60, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: 2 },
  headerBtnText: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  headerTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm, flex: 1, textAlign: 'center' },

  /* tabs */
  tabBar: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.header,
  },
  tabScroll: { paddingHorizontal: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { color: colors.textTertiary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  /* search */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.md, marginVertical: spacing.sm, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.disabled, paddingHorizontal: spacing.sm, height: 38,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  /* stretch list */
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 100, gap: spacing.valueLabelGap },
  stretchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.4)',
  },
  stretchDot: { width: 8, height: 8, borderRadius: 4 },
  stretchName: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  stretchType: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  stretchDiff: { color: '#eab308', fontFamily: typography.family.mono, fontSize: typography.size.lg },

  /* metrics (step 2) */
  metricsContent: { padding: spacing.base, gap: spacing.md },
  metricsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    padding: spacing.base, gap: spacing.md,
  },
  metricsTitle: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  metricsSubtitle: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  metricsDiff: { color: '#eab308', fontFamily: typography.family.mono, fontSize: typography.size.lg },
  inputGroup: { gap: spacing.xs },
  inputLabel: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.placeholder,
    color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xl, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, textAlign: 'center',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: ACCENT, paddingVertical: spacing.md, borderRadius: 2,
  },
  addBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  addedPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
  addedTitle: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addedName: { flex: 1, color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  addedVal: { color: ACCENT, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  /* review (step 3) */
  reviewContent: { padding: spacing.base, gap: spacing.md },
  reviewPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.base, gap: spacing.sm },
  reviewTitle: { color: ACCENT, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  reviewStatsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  reviewStat: { alignItems: 'center', gap: spacing.valueLabelGap },
  reviewStatVal: { color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.xxl },
  reviewStatLabel: { color: colors.textSecondary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.3)',
  },
  reviewName: { flex: 1, color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  reviewVal: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.lg },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: ACCENT, paddingVertical: spacing.md, borderRadius: 2,
  },
  saveBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
});

export default LogDexEntryScreen;
