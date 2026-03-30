import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { loadPlans, deletePlan, updatePlan } from '../services/savedPlanService';
import { logStrSession } from '../services/strService';
import { logDexSession } from '../services/dexService';
import { EXERCISE_MAP } from '../config/strConstants';
import { STRETCH_MAP } from '../config/dexConstants';

const PLAN_ICONS = {
  workout: 'dumbbell',
  stretch: 'yoga',
  meal: 'food-apple',
};
const PLAN_COLORS = {
  workout: colors.accent,
  stretch: '#f97316',
  meal: '#22c55e',
};

const SavedPlanScreen = ({ navigation }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [checked, setChecked] = useState({}); // { [planId]: Set<index> }
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    loadPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleItem = (planId, index) => {
    setChecked((prev) => {
      const set = new Set(prev[planId] || []);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      return { ...prev, [planId]: set };
    });
  };

  const handleDelete = (planId) => {
    Alert.alert('Delete Plan', 'Remove this saved plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlan(planId);
          setPlans((prev) => prev.filter((p) => p.id !== planId));
          if (expandedId === planId) setExpandedId(null);
        },
      },
    ]);
  };

  const handleLogSelected = async (plan) => {
    const sel = checked[plan.id];
    if (!sel || sel.size === 0) {
      Alert.alert('Nothing selected', 'Check the items you want to log.');
      return;
    }

    const items = plan.items.filter((_, i) => sel.has(i) && !plan.items[i].logged);
    if (items.length === 0) {
      Alert.alert('Already logged', 'All selected items are already logged.');
      return;
    }

    setLogging(true);
    try {
      // Workout items → logStrSession
      const workoutItems = items.filter((item) => item.exerciseId);
      if (workoutItems.length > 0) {
        const sets = [];
        workoutItems.forEach((item) => {
          const numSets = item.sets || 1;
          for (let i = 0; i < numSets; i++) {
            sets.push({
              exerciseId: item.exerciseId,
              weight: item.weight || 0,
              reps: item.reps || 0,
            });
          }
        });
        await logStrSession(sets);
      }

      // Stretch items → logDexSession
      const stretchItems = items.filter((item) => item.stretchId);
      if (stretchItems.length > 0) {
        const entries = stretchItems.map((item) => ({
          stretchId: item.stretchId,
          duration: item.duration || 0,
          reps: item.reps || 0,
        }));
        await logDexSession(entries);
      }

      // Mark items logged
      const updatedItems = plan.items.map((item, i) =>
        sel.has(i) ? { ...item, logged: true } : item,
      );
      await updatePlan(plan.id, { items: updatedItems });
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, items: updatedItems } : p)),
      );
      setChecked((prev) => ({ ...prev, [plan.id]: new Set() }));

      const logged = workoutItems.length + stretchItems.length;
      const mealItems = items.filter((item) => !item.exerciseId && !item.stretchId);
      Alert.alert(
        'Logged!',
        `${logged} exercise${logged !== 1 ? 's' : ''} logged.${mealItems.length ? ` ${mealItems.length} meal item(s) marked done.` : ''}`,
      );
    } catch (e) {
      console.error('[SavedPlan] log error:', e);
      Alert.alert('Error', 'Failed to log items. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle}>SAVED PLANS</Text>
        <View style={styles.headerBtn} />
      </View>

      {plans.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bookmark-off-outline" size={48} color={colors.disabled} />
          <Text style={styles.emptyTitle}>NO SAVED PLANS</Text>
          <Text style={styles.emptyText}>
            Ask the Coach to generate a workout or meal plan, then save it.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {plans.map((plan) => {
            const expanded = expandedId === plan.id;
            const accent = PLAN_COLORS[plan.type] || colors.accent;
            const icon = PLAN_ICONS[plan.type] || 'file-document-outline';
            const loggedCount = plan.items.filter((i) => i.logged).length;
            const progress = plan.items.length > 0 ? loggedCount / plan.items.length : 0;
            const sel = checked[plan.id] || new Set();

            return (
              <View key={plan.id} style={[styles.card, { borderColor: `${accent}40` }]}>
                {/* Card header */}
                <Pressable style={styles.cardHeader} onPress={() => toggleExpand(plan.id)}>
                  <MaterialCommunityIcons name={icon} size={20} color={accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: accent }]}>{plan.title}</Text>
                    <Text style={styles.cardMeta}>
                      {plan.items.length} items · {plan.type.toUpperCase()} · {formatDate(plan.createdAt)}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={24}
                    color={colors.placeholder}
                  />
                </Pressable>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
                </View>

                {/* Expanded items */}
                {expanded && (
                  <View style={styles.itemList}>
                    {plan.items.map((item, idx) => {
                      const isChecked = sel.has(idx);
                      const isLogged = item.logged;
                      const name = item.exerciseId
                        ? EXERCISE_MAP[item.exerciseId]?.name || item.name
                        : item.stretchId
                          ? STRETCH_MAP[item.stretchId]?.name || item.name
                          : item.name;

                      let detail = '';
                      if (item.exerciseId) {
                        detail = `${item.sets || 1}×${item.reps || 0}${item.weight ? ` @ ${item.weight} lbs` : ''}`;
                      } else if (item.stretchId) {
                        detail = item.duration ? `${item.duration}s hold` : `${item.reps} reps`;
                      } else {
                        detail = `${item.calories || 0} kcal · P${item.protein || 0}g C${item.carbs || 0}g F${item.fat || 0}g`;
                      }

                      return (
                        <Pressable
                          key={idx}
                          style={[styles.itemRow, isLogged && styles.itemRowLogged]}
                          onPress={() => !isLogged && toggleItem(plan.id, idx)}
                          disabled={isLogged}
                        >
                          <MaterialIcons
                            name={isLogged ? 'check-circle' : isChecked ? 'check-box' : 'check-box-outline-blank'}
                            size={20}
                            color={isLogged ? colors.success : isChecked ? accent : colors.textTertiary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemName, isLogged && styles.itemNameLogged]}>
                              {name}
                            </Text>
                            <Text style={[styles.itemDetail, isLogged && styles.itemDetailLogged]}>
                              {detail}
                            </Text>
                          </View>
                          {isLogged && (
                            <Text style={styles.loggedBadge}>LOGGED</Text>
                          )}
                        </Pressable>
                      );
                    })}

                    {/* Actions */}
                    <View style={styles.actions}>
                      {plan.items.some((i) => !i.logged) && (
                        <Pressable
                          style={[styles.logBtn, { backgroundColor: accent }, logging && { opacity: 0.5 }]}
                          onPress={() => handleLogSelected(plan)}
                          disabled={logging}
                        >
                          <MaterialIcons name="fitness-center" size={16} color={colors.textPrimary} />
                          <Text style={styles.logBtnText}>
                            {logging ? 'LOGGING...' : `LOG SELECTED (${sel.size})`}
                          </Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.deleteBtn} onPress={() => handleDelete(plan.id)}>
                        <MaterialIcons name="delete-outline" size={16} color={colors.error} />
                        <Text style={styles.deleteBtnText}>DELETE</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
  },
  headerBtn: { width: 34, alignItems: 'center' },
  headerTitle: { color: colors.accent, fontFamily: typography.family.pixel, fontSize: typography.size.sm, letterSpacing: 1 },

  emptyTitle: { color: colors.placeholder, fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  emptyText: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.xl, textAlign: 'center' },

  listContent: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderRadius: 4, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
  },
  cardTitle: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  cardMeta: { color: colors.placeholder, fontFamily: typography.family.mono, fontSize: typography.size.lg, marginTop: spacing.valueLabelGap },

  progressBar: {
    height: 3, backgroundColor: 'rgba(148,163,184,0.15)', marginHorizontal: spacing.md,
  },
  progressFill: { height: 3, borderRadius: 2 },

  itemList: { padding: spacing.sm, gap: spacing.xs },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  itemRowLogged: { opacity: 0.55 },
  itemName: { color: colors.textSoft, fontFamily: typography.family.mono, fontSize: typography.size.xl },
  itemNameLogged: { textDecorationLine: 'line-through' },
  itemDetail: { color: colors.textMuted, fontFamily: typography.family.mono, fontSize: typography.size.lg },
  itemDetailLogged: { textDecorationLine: 'line-through' },
  loggedBadge: { color: colors.success, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, justifyContent: 'flex-end' },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 2, flex: 1, justifyContent: 'center',
  },
  logBtnText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 2,
  },
  deleteBtnText: { color: colors.error, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
});

export default SavedPlanScreen;
