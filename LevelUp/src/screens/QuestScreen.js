import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import PostLoginBottomNav from '../components/PostLoginBottomNav';
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#257bf4" />
          <Text style={styles.loadingText}>
            {generating ? 'GENERATING QUEST BOARD...' : 'LOADING QUESTS...'}
          </Text>
        </View>
        <PostLoginBottomNav navigation={navigation} activeTab="Quests" />
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

        {/* Quest Cards */}
        {quests.map((quest) => {
          const meta = CATEGORY_META[quest.category] || {};
          const isCompleted = quest.status === 'completed';
          const isSkipped = quest.status === 'skipped';
          const isDone = isCompleted || isSkipped;
          const isUpdating = updatingId === quest.id;

          return (
            <View
              key={quest.id}
              style={[
                styles.questCard,
                isCompleted && styles.questCardCompleted,
                isSkipped && styles.questCardSkipped,
              ]}
            >
              {/* Category color accent */}
              <View style={[styles.cardAccent, { backgroundColor: meta.color || '#257bf4' }]} />

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
                <Text style={[styles.questDesc, isDone && styles.textDone]}>
                  {quest.description}
                </Text>

                {/* Completion criteria */}
                {quest.completionCriteria && (
                  <Text style={styles.criteria}>
                    {quest.completionCriteria}
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
                        <MaterialIcons name="quiz" size={16} color="#fff" />
                        <Text style={styles.completeBtnText}>TAKE QUIZ</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleComplete(quest.id)}
                        disabled={isUpdating}
                        style={[styles.completeBtn, isUpdating && { opacity: 0.5 }]}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MaterialIcons name="check" size={16} color="#fff" />
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
                      color={isCompleted ? '#22c55e' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isCompleted ? '#22c55e' : '#64748b' },
                      ]}
                    >
                      {isCompleted ? 'COMPLETED' : 'SKIPPED'}
                      {isCompleted ? ` (+${quest.xpReward} XP)` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
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

      <PostLoginBottomNav navigation={navigation} activeTab="Quests" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1B26' },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#7aaef8',
    fontFamily: 'PressStart2P',
    fontSize: 10,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#3B82F6',
    fontFamily: 'PressStart2P',
    fontSize: 18,
  },
  subtitle: {
    color: '#7aaef8',
    fontFamily: 'VT323',
    fontSize: 14,
    marginTop: 2,
  },
  ratingBadge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.3)',
  },
  ratingText: {
    fontFamily: 'PressStart2P',
    fontSize: 20,
  },

  scrollContent: { padding: 16, gap: 12 },

  /* Progress card */
  progressCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.4)',
    padding: 16,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#7aaef8',
    fontFamily: 'PressStart2P',
    fontSize: 9,
  },
  progressCount: {
    color: '#FFFFFF',
    fontFamily: 'PressStart2P',
    fontSize: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.3)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#257bf4',
  },
  xpTotal: {
    color: '#22c55e',
    fontFamily: 'VT323',
    fontSize: 16,
  },

  /* Quest card */
  questCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.35)',
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
    padding: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardCategory: {
    fontFamily: 'PressStart2P',
    fontSize: 9,
  },
  tierBadge: {
    backgroundColor: 'rgba(37,123,244,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.3)',
  },
  tierText: {
    color: '#7aaef8',
    fontFamily: 'PressStart2P',
    fontSize: 7,
  },
  xpBadge: {
    color: '#22c55e',
    fontFamily: 'PressStart2P',
    fontSize: 8,
  },
  questTitle: {
    color: '#FFFFFF',
    fontFamily: 'PressStart2P',
    fontSize: 10,
    lineHeight: 16,
  },
  questDesc: {
    color: '#cbd5e1',
    fontFamily: 'VT323',
    fontSize: 18,
    lineHeight: 22,
  },
  criteria: {
    color: '#64748b',
    fontFamily: 'VT323',
    fontSize: 15,
    fontStyle: 'italic',
  },
  textDone: {
    opacity: 0.5,
  },

  /* Actions */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  quizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PressStart2P',
    fontSize: 8,
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.4)',
  },
  skipBtnText: {
    color: '#64748b',
    fontFamily: 'PressStart2P',
    fontSize: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    fontFamily: 'PressStart2P',
    fontSize: 8,
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.35)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#7aaef8',
    fontFamily: 'PressStart2P',
    fontSize: 10,
  },
  emptyHint: {
    color: '#64748b',
    fontFamily: 'VT323',
    fontSize: 16,
  },

  /* XP Flash */
  xpFlashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.4)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  xpFlashText: {
    color: '#facc15',
    fontFamily: 'PressStart2P',
    fontSize: 12,
  },
  xpFlashLabel: {
    color: '#fde68a',
    fontFamily: 'VT323',
    fontSize: 18,
  },
});

export default QuestScreen;
