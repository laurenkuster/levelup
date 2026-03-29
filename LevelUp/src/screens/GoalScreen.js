import React, { useState, useEffect } from 'react';
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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { saveData, loadData, SYNC_DOCS } from '../services/firestoreSync';
import {
  QUEST_CATEGORIES,
  CATEGORY_META,
  DEFAULT_TIERS,
  PRIORITY_OPTIONS,
  QUEST_KEYS,
} from '../config/questConstants';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const GoalScreen = ({ navigation, route }) => {
  const isInApp = route?.params?.inApp === true;

  const [goals, setGoals] = useState(() => {
    const initial = {};
    QUEST_CATEGORIES.forEach((cat) => {
      initial[cat] = { goal: '', priority: 'medium' };
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isInApp);

  // In edit mode, pre-populate existing goals
  useEffect(() => {
    if (!isInApp) return;
    let mounted = true;
    (async () => {
      const existing = await loadData(QUEST_KEYS.GOALS, SYNC_DOCS.GOALS);
      if (!mounted || !existing) { setLoading(false); return; }
      const merged = {};
      QUEST_CATEGORIES.forEach((cat) => {
        merged[cat] = {
          goal: existing[cat]?.goal || '',
          priority: existing[cat]?.priority || 'medium',
        };
      });
      setGoals(merged);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [isInApp]);

  const updateGoal = (cat, field, value) => {
    setGoals((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], [field]: value },
    }));
  };

  const filledCount = QUEST_CATEGORIES.filter((c) => goals[c].goal.trim()).length;

  const handleSubmit = async () => {
    if (filledCount < 3) {
      Alert.alert('More Goals Needed', 'Fill in at least 3 category goals to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const uid = auth.currentUser.uid;

      // Save goals
      const goalsData = {};
      QUEST_CATEGORIES.forEach((cat) => {
        goalsData[cat] = {
          goal: goals[cat].goal.trim(),
          priority: goals[cat].priority,
        };
      });
      goalsData.updatedAt = new Date().toISOString();
      await saveData(QUEST_KEYS.GOALS, SYNC_DOCS.GOALS, goalsData);

      // Initialize default tiers only if they don't exist yet (preserve progress on re-goal)
      const existingTiers = await loadData(QUEST_KEYS.TIERS, SYNC_DOCS.QUEST_TIERS);
      if (!existingTiers) {
        await saveData(QUEST_KEYS.TIERS, SYNC_DOCS.QUEST_TIERS, {
          ...DEFAULT_TIERS,
          lastUpdated: new Date().toISOString(),
        });
      }

      // Mark goals complete on user doc
      await setDoc(doc(db, 'users', uid), { goalsComplete: true }, { merge: true });

      // Navigate
      if (isInApp) {
        navigation.goBack();
      } else {
        const rootNav = navigation.getParent?.() || navigation;
        rootNav.reset({ index: 0, routes: [{ name: 'AppStack' }] });
      }
    } catch (e) {
      console.error('GoalScreen error:', e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderIcon = (cat) => {
    const meta = CATEGORY_META[cat];
    const IconComp = meta.iconFamily === 'community' ? MaterialCommunityIcons : MaterialIcons;
    return <IconComp name={meta.iconName} size={20} color={meta.color} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.header}>
          {isInApp && (
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={22} color={colors.textLabel} />
            </Pressable>
          )}
          <Text style={styles.title}>SET YOUR{'\n'}GOALS</Text>
          <Text style={styles.subtitle}>Define your quest objectives</Text>
          <Text style={styles.counter}>{filledCount}/7 goals set (min 3)</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {QUEST_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <View key={cat} style={styles.section}>
                <View style={styles.sectionHeader}>
                  {renderIcon(cat)}
                  <Text style={[styles.label, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder={`e.g., ${getPlaceholder(cat)}`}
                  placeholderTextColor={colors.placeholder}
                  value={goals[cat].goal}
                  onChangeText={(v) => updateGoal(cat, 'goal', v)}
                  autoCapitalize="sentences"
                  multiline
                />

                <View style={styles.chipRow}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => updateGoal(cat, 'priority', p)}
                      style={[
                        styles.chip,
                        goals[cat].priority === p && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          goals[cat].priority === p && styles.chipTextActive,
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.submitText}>
                {isInApp ? 'UPDATE GOALS' : 'ACCEPT QUESTS'}
              </Text>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function getPlaceholder(cat) {
  const map = {
    STR: 'Do 50 push-ups in one set',
    SPD: 'Run a 5K in under 25 minutes',
    STM: 'Complete a half marathon',
    INT: 'Study for AWS certification',
    DEX: 'Improve typing speed to 100 WPM',
    HP:  'Hit 2000 kcal daily with balanced macros',
    MP:  'Sleep 7.5 hours consistently',
  };
  return map[cat] || 'Set your goal...';
}

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
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 28,
  },
  title: {
    color: colors.accentStrong,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.base,
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    color: colors.placeholder,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
    marginTop: 6,
  },
  counter: {
    color: colors.success,
    fontFamily: typography.family.mono,
    fontSize: typography.size.base,
    marginTop: 4,
  },
  scrollContent: { padding: spacing.lg, gap: spacing.base },

  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.base,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { fontFamily: typography.family.pixel, fontSize: typography.size.sm },
  input: {
    minHeight: 48,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.placeholder, fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  chipTextActive: { color: colors.textPrimary },

  submitBtn: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.md },
});

export default GoalScreen;
