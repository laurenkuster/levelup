import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import {
  getTodayQuests,
  updateQuestStatus,
  computeDayRating,
  checkAndEvaluateTiers,
  hasGoals,
} from '../services/questService';
import { loadData, SYNC_DOCS } from '../services/firestoreSync';
import {
  CATEGORY_META,
  QUEST_RATINGS,
  QUEST_KEYS,
} from '../config/questConstants';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { useFadeIn } from '../hooks/useAnimations';
import AnimatedCard from '../components/AnimatedCard';

const QuestScreen = ({ navigation }) => {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dayRating, setDayRating] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [xpFlash, setXpFlash] = useState(null); // { xp, category }

  const loadQuests = useCallback(async () => {
    try {
      // Safety net: check if goals exist
      const goalsExist = await hasGoals();
      if (!goalsExist) {
        const parentNav = navigation.getParent?.() || navigation;
        parentNav.navigate('GoalSetup', { inApp: true });
        setLoading(false);
        return;
      }

      setLoading(quests.length === 0);
      setGenerating(quests.length === 0);

      // Run tier evaluation (once per day, no-op if already done)
      checkAndEvaluateTiers().catch((e) =>
        console.warn('[QuestScreen] tier eval error:', e.message)
      );

      const todayQuests = await getTodayQuests();
      const history = await loadData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY);
      const today = new Date().toISOString().slice(0, 10);

      setQuests(todayQuests);
      setDayRating(computeDayRating(history, today));
    } catch (e) {
      console.error('[QuestScreen] Load error:', e);
      Alert.alert('Quest Error', 'Failed to load quests. Check your connection and try again.');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [navigation, quests.length]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadQuests);
    loadQuests();
    return unsubscribe;
  }, [navigation, loadQuests]);

  const handleComplete = async (questId) => {
    setUpdatingId(questId);
    try {
      const quest = quests.find((q) => q.id === questId);
      const { xpAwarded } = await updateQuestStatus(questId, 'completed');
      // Update local state
      setQuests((prev) =>
        prev.map((q) => (q.id === questId ? { ...q, status: 'completed' } : q))
      );
      const today = new Date().toISOString().slice(0, 10);
      const history = await loadData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY);
      setDayRating(computeDayRating(history, today));

      // XP flash feedback
      setXpFlash({ xp: xpAwarded, category: quest?.category });
      setTimeout(() => setXpFlash(null), 2200);
    } catch (e) {
      console.error('[QuestScreen] Complete error:', e);
      Alert.alert('Error', 'Failed to complete quest. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSkip = async (questId) => {
    setUpdatingId(questId);
    try {
      await updateQuestStatus(questId, 'skipped');
      setQuests((prev) =>
        prev.map((q) => (q.id === questId ? { ...q, status: 'skipped' } : q))
      );
      const today = new Date().toISOString().slice(0, 10);
      const history = await loadData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY);
      setDayRating(computeDayRating(history, today));
    } catch (e) {
      console.error('[QuestScreen] Skip error:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const renderIcon = (cat, size = 20) => {
    const meta = CATEGORY_META[cat];
    if (!meta) return null;
    const IconComp = meta.iconFamily === 'community' ? MaterialCommunityIcons : MaterialIcons;
    return <IconComp name={meta.iconName} size={size} color={meta.color} />;
  };

  const completedCount = quests.filter((q) => q.status === 'completed').length;
  const progressPct = quests.length > 0 ? (completedCount / quests.length) * 100 : 0;
  const ratingInfo = dayRating?.rating ? QUEST_RATINGS[dayRating.rating] : QUEST_RATINGS.F;

  const progressFadeIn = useFadeIn(0, 400);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>
            {generating ? 'GENERATING QUEST BOARD...' : 'LOADING QUESTS...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>QUESTS</Text>
            <Text style={styles.subtitle}>Daily Quest Board</Text>
          </View>
          <View style={[styles.ratingBadge, { backgroundColor: ratingInfo.color + '22' }]}>
            <Text style={[styles.ratingText, { color: ratingInfo.color }]}>
              {dayRating?.rating || '-'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* XP Flash */}
        {xpFlash && (
          <View style={styles.xpFlashBanner}>
            <MaterialIcons name="bolt" size={18} color="#facc15" />
            <Text style={styles.xpFlashText}>
              +{xpFlash.xp} XP{xpFlash.category ? ` (${xpFlash.category})` : ''}
            </Text>
            <Text style={styles.xpFlashLabel}>QUEST COMPLETE!</Text>
          </View>
        )}

        {/* Progress Summary */}
        <Animated.View style={{ opacity: progressFadeIn }}>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>TODAY'S PROGRESS</Text>
              <Text style={styles.progressCount}>
                {completedCount}/{quests.length}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
            </View>
            {dayRating?.totalXp > 0 && (
              <Text style={styles.xpTotal}>+{dayRating.totalXp} XP earned today</Text>
            )}
          </View>
        </Animated.View>

        {/* Quest Cards */}
        {quests.map((quest, index) => {
          const meta = CATEGORY_META[quest.category] || {};
          const isCompleted = quest.status === 'completed';
          const isSkipped = quest.status === 'skipped';
          const isDone = isCompleted || isSkipped;
          const isUpdating = updatingId === quest.id;

          return (
            <AnimatedCard
              key={quest.id}
              index={index}
              style={[
                styles.questCard,
                isCompleted && styles.questCardCompleted,
                isSkipped && styles.questCardSkipped,
              ]}
            >
              {/* Category color accent */}
              <View style={[styles.cardAccent, { backgroundColor: meta.color || colors.accent }]} />

              <View style={styles.cardBody}>
                {/* Top row: icon, category, tier, XP */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardCategoryRow}>
                    {renderIcon(quest.category, 18)}
                    <Text style={[styles.cardCategory, { color: meta.color }]}>
                      {quest.category}
                    </Text>
                    <View style={styles.tierBadge}>
                      <Text style={styles.tierText}>T{quest.tier}</Text>
                    </View>
                  </View>
                  <Text style={styles.xpBadge}>+{quest.xpReward} XP</Text>
                </View>

                {/* Title & description */}
                <Text style={[styles.questTitle, isDone && styles.textDone]}>
                  {quest.title}
                </Text>
                {isDone ? (
                  quest.completionCriteria ? (
                    <Text style={[styles.questDesc, styles.textDone]}>
                      {quest.completionCriteria}
                    </Text>
                  ) : null
                ) : (
                  <Text style={styles.questDesc}>
                    {quest.description}
                  </Text>
                )}

                {/* Action buttons */}
                {!isDone ? (
                  <View style={styles.actionRow}>
                    {quest.category === 'INT' ? (
                      <Pressable
                        onPress={() => {
                          const parentNav = navigation.getParent?.() || navigation;
                          parentNav.navigate('IntStudy', {
                            topic: quest.title,
                            difficulty: quest.tier || 3,
                            questId: quest.id,
                          });
                        }}
                        disabled={isUpdating}
                        style={[styles.quizBtn, isUpdating && { opacity: 0.5 }]}
                      >
                        <MaterialIcons name="quiz" size={16} color={colors.textPrimary} />
                        <Text style={styles.completeBtnText}>TAKE QUIZ</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleComplete(quest.id)}
                        disabled={isUpdating}
                        style={[styles.completeBtn, isUpdating && { opacity: 0.5 }]}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color={colors.textPrimary} />
                        ) : (
                          <>
                            <MaterialIcons name="check" size={16} color={colors.textPrimary} />
                            <Text style={styles.completeBtnText}>COMPLETE</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => handleSkip(quest.id)}
                      disabled={isUpdating}
                      style={styles.skipBtn}
                    >
                      <Text style={styles.skipBtnText}>SKIP</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    <MaterialIcons
                      name={isCompleted ? 'check-circle' : 'remove-circle'}
                      size={18}
                      color={isCompleted ? colors.success : colors.placeholder}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isCompleted ? colors.success : colors.placeholder },
                      ]}
                    >
                      {isCompleted ? 'COMPLETED' : 'SKIPPED'}
                      {isCompleted ? ` (+${quest.xpReward} XP)` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedCard>
          );
        })}

        {quests.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No quests available.</Text>
            <Text style={styles.emptyHint}>Pull down to refresh or check your connection.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  loadingText: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
  },

  /* Header */
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.accentStrong,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
    marginTop: spacing.valueLabelGap,
  },
  ratingBadge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  ratingText: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xl,
  },

  scrollContent: { padding: spacing.base, gap: spacing.md },

  /* Progress card */
  progressCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  progressCount: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.md,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  xpTotal: {
    color: colors.success,
    fontFamily: typography.family.mono,
    fontSize: typography.size.sm,
  },

  /* Quest card */
  questCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  questCardCompleted: {
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  questCardSkipped: {
    borderColor: 'rgba(100,116,139,0.3)',
    opacity: 0.7,
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardCategory: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  tierBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.valueLabelGap,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tierText: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  xpBadge: {
    color: colors.success,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  questTitle: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  questDesc: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
    lineHeight: typography.size.xl * typography.lineHeight.normal,
  },
  criteria: {
    color: colors.textTertiary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
    lineHeight: typography.size.lg * typography.lineHeight.normal,
    fontStyle: 'italic',
  },
  textDone: {
    opacity: 0.5,
  },

  /* Actions */
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 4,
    minHeight: 44,
  },
  quizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 4,
    minHeight: 44,
  },
  completeBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.4)',
    minHeight: 44,
  },
  skipBtnText: {
    color: colors.textTertiary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusText: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
  },
  emptyHint: {
    color: colors.textTertiary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
  },

  /* XP Flash */
  xpFlashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.4)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  xpFlashText: {
    color: '#facc15',
    fontFamily: typography.family.pixel,
    fontSize: typography.size.md,
  },
  xpFlashLabel: {
    color: '#fde68a',
    fontFamily: typography.family.mono,
    fontSize: typography.size.sm,
  },
});

export default QuestScreen;
