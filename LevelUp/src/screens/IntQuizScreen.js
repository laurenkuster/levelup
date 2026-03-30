import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PixelButton from '../components/PixelButton';
import PixelCard from '../components/PixelCard';
import StatChip from '../components/StatChip';
import { calcQuizXP, levelFromTotalXP, xpToReachLevel, xpForNextLevel, rankForLevel } from '../utils/xpSystem';
import { saveData, SYNC_DOCS } from '../services/firestoreSync';
import { updateQuestStatus } from '../services/questService';
import { getStatXpMultiplier } from '../services/crossStatEngine';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const INT_LOG_KEY = 'levelup_int_log_v1';
const INT_SCORE_KEY = 'levelup_int_score_v1';
const INT_XP_KEY = 'levelup_int_xp_v1';

const IntQuizScreen = ({ navigation, route }) => {
  const { quiz, topic, questId } = route?.params || {};
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [saved, setSaved] = useState(false);
  const [xpEarned, setXpEarned] = useState(null);
  const [levelUp, setLevelUp] = useState(null); // { from, to } when a level-up occurs

  const questionCount = quiz?.questions?.length || 0;
  const difficulty = quiz?.difficulty || 3;
  const timeLimit = useMemo(() => {
    if (difficulty <= 1) {
      return 15 * 60;
    }
    if (difficulty === 2) {
      return 10 * 60;
    }
    return 5 * 60;
  }, [difficulty]);

  function handleSelect(questionId, index) {
    if (submitted) {
      return;
    }
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
  }

  function handleSubmit(auto = false) {
    if (submitted) {
      return;
    }
    const timeTaken = timeLimit - (auto ? 0 : Math.max(0, remaining));
    setSubmitted(true);
    setFinalScore(computedScore);
    if (auto) {
      setRemaining(0);
    }

    // Calculate XP
    const xp = calcQuizXP({
      score: computedScore,
      total: questionCount,
      difficulty,
      timeTaken,
      timeLimit,
    });
    setXpEarned(xp);
  }

  /* ── persist quiz result + XP to AsyncStorage ── */
  useEffect(() => {
    if (!submitted || saved || finalScore === null || xpEarned === null) return;
    const persist = async () => {
      try {
        const entry = {
          id: `${Date.now()}`,
          topic: topic || quiz?.topic || 'Unknown',
          difficulty,
          score: finalScore,
          total: questionCount,
          percent: questionCount > 0 ? Math.round((finalScore / questionCount) * 100) : 0,
          correct: correctCount,
          wrong: wrongCount,
          unanswered: unansweredCount,
          xp: xpEarned,
          date: new Date().toISOString(),
        };

        // Append to quiz log
        const raw = await AsyncStorage.getItem(INT_LOG_KEY);
        let logs = [];
        try { logs = raw ? JSON.parse(raw) : []; } catch (_) { /* ignore */ }
        logs = [entry, ...logs].slice(0, 100);
        await saveData(INT_LOG_KEY, SYNC_DOCS.QUIZ_LOGS, logs);

        // Recalculate INT score (avg percent of last 10 quizzes)
        const recent = logs.slice(0, 10);
        const avgPercent = Math.round(recent.reduce((s, l) => s + l.percent, 0) / recent.length);
        await saveData(INT_SCORE_KEY, SYNC_DOCS.INT_SCORE, {
          score: avgPercent,
          quizCount: logs.length,
          lastQuiz: entry.date,
        });

        // ── XP persistence (with cross-stat modifier) ──
        const crossMult = await getStatXpMultiplier('INT');
        const adjustedXp = Math.round(xpEarned * crossMult);

        const xpRaw = await AsyncStorage.getItem(INT_XP_KEY);
        let xpData = { totalXp: 0, level: 1, history: [] };
        try { if (xpRaw) xpData = JSON.parse(xpRaw); } catch (_) { /* ignore */ }

        const prevLevel = xpData.level;
        xpData.totalXp += adjustedXp;
        xpData.level = levelFromTotalXP(xpData.totalXp);
        xpData.history = [
          { id: entry.id, xp: adjustedXp, date: entry.date },
          ...(xpData.history || []),
        ].slice(0, 200);

        await saveData(INT_XP_KEY, SYNC_DOCS.INT_XP, xpData);

        if (xpData.level > prevLevel) {
          setLevelUp({ from: prevLevel, to: xpData.level });
        }

        // Auto-complete the linked quest if this quiz came from the quest board
        if (questId) {
          try {
            await updateQuestStatus(questId, 'completed');
          } catch (e) {
            console.warn('Failed to complete linked quest:', e.message);
          }
        }

        setSaved(true);
      } catch (err) {
        console.warn('Failed to save quiz result:', err);
      }
    };
    persist();
  }, [submitted, saved, finalScore, xpEarned, questId]);

  function handleStart() {
    if (started) {
      return;
    }
    setStarted(true);
    setSubmitted(false);
    setFinalScore(null);
    setXpEarned(null);
    setLevelUp(null);
    setRemaining(timeLimit);
  }

  useEffect(() => {
    if (!started) {
      setRemaining(timeLimit);
    }
  }, [timeLimit]);

  useEffect(() => {
    setAnswers({});
    setStarted(false);
    setSubmitted(false);
    setFinalScore(null);
    setRemaining(timeLimit);
  }, [quiz, timeLimit]);

  useEffect(() => {
    if (!started || submitted || timeLimit === 0) {
      return undefined;
    }
    if (remaining <= 0) {
      handleSubmit(true);
      return undefined;
    }
    const timerId = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [remaining, started, submitted, timeLimit]);

  const { correctCount, wrongCount, unansweredCount } = useMemo(() => {
    if (!quiz?.questions) {
      return { correctCount: 0, wrongCount: 0, unansweredCount: 0 };
    }
    return quiz.questions.reduce(
      (acc, question) => {
        const selected = answers[question.id];
        if (selected === undefined) {
          acc.unansweredCount += 1;
        } else if (selected === question.correct_index) {
          acc.correctCount += 1;
        } else {
          acc.wrongCount += 1;
        }
        return acc;
      },
      { correctCount: 0, wrongCount: 0, unansweredCount: 0 }
    );
  }, [answers, quiz]);

  const computedScore = useMemo(() => {
    return correctCount;
  }, [correctCount]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            INT QUIZ
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <PixelCard style={styles.panel}>
            <Text style={styles.label}>Topic</Text>
            <Text style={styles.value}>{topic || quiz?.topic || 'Quiz'}</Text>
            <Text style={styles.metaText}>Questions: {questionCount}</Text>
            <Text style={styles.metaText}>Time limit: {Math.floor(timeLimit / 60)} min</Text>
            <Text style={styles.metaText}>
              Time left: {started ? Math.max(0, remaining) : timeLimit}s
            </Text>
            {submitted ? (
              <>
                <Text style={styles.metaText}>
                  Score: {finalScore}/{questionCount}
                </Text>
                <Text style={styles.metaText}>
                  Correct: {correctCount} • Wrong: {wrongCount} • Unanswered: {unansweredCount}
                </Text>
                {xpEarned != null && (
                  <Text style={styles.xpText}>+{xpEarned} XP earned!</Text>
                )}
                {levelUp && (
                  <Text style={styles.levelUpText}>
                    LEVEL UP! {levelUp.from} → {levelUp.to}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.metaText}>Score: Submit to view results</Text>
            )}
          </PixelCard>

          {!started ? (
            <PixelButton
              onPress={handleStart}
              title="Start Quiz"
              variant="success"
              style={styles.primaryBtn}
            />
          ) : null}

          {quiz?.questions?.map((question, index) => {
            const selected = answers[question.id];
            return (
              <PixelCard key={`q-${question.id}-${index}`} style={styles.questionCard} variant="deep">
                <Text style={styles.questionTitle} numberOfLines={3} ellipsizeMode="tail">
                  {index + 1}. {question.question}
                </Text>
                <View style={styles.tagRow}>
                  <StatChip label={question.difficulty_tag.toUpperCase()} variant="tag" />
                </View>
                {question.options.map((option, optionIndex) => {
                  const isSelected = selected === optionIndex;
                  const isCorrect = optionIndex === question.correct_index;
                  const isWrongSelected = submitted && isSelected && !isCorrect;
                  const showCorrect = submitted && isCorrect;
                  return (
                    <Pressable
                      key={`opt-${question.id}-${optionIndex}`}
                      onPress={() => handleSelect(question.id, optionIndex)}
                      disabled={submitted || !started}
                      style={({ pressed }) => [
                        styles.optionBtn,
                        isSelected && styles.optionSelected,
                        showCorrect && styles.optionCorrect,
                        isWrongSelected && styles.optionWrong,
                        pressed && !submitted && started && styles.optionPressed,
                      ]}
                    >
                      <Text style={styles.optionText}>{option}</Text>
                    </Pressable>
                  );
                })}
                {submitted && selected !== undefined ? (
                  <Text style={styles.rationaleText}>Rationale: {question.rationale}</Text>
                ) : null}
              </PixelCard>
            );
          })}

          <PixelButton
            onPress={() => handleSubmit(false)}
            disabled={submitted || !started}
            title={submitted ? 'Quiz Submitted' : 'Submit Quiz'}
            style={styles.primaryBtn}
          />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  headerBtn: {
    width: 34,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accentStrong,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
    flexShrink: 1,
    marginHorizontal: spacing.sm,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  panel: {
    gap: 6,
  },
  label: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  questionCard: {
    gap: spacing.sm,
    padding: spacing.base,
  },
  questionTitle: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: typography.size.xl,
  },
  tagRow: {
    flexDirection: 'row',
  },
  optionBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.accent,
  },
  optionCorrect: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderColor: 'rgba(34,197,94,0.6)',
  },
  optionWrong: {
    backgroundColor: 'rgba(248,113,113,0.2)',
    borderColor: 'rgba(248,113,113,0.6)',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionText: {
    color: colors.textSoft,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  rationaleText: {
    color: colors.textMuted,
    fontFamily: typography.family.mono,
    fontSize: typography.size.lg,
  },
  primaryBtn: {
    alignSelf: 'center',
  },
  xpText: {
    color: colors.success,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },
  levelUpText: {
    color: '#facc15',
    fontFamily: typography.family.pixel,
    fontSize: typography.size.md,
    marginTop: spacing.valueLabelGap,
  },
});

export default IntQuizScreen;
