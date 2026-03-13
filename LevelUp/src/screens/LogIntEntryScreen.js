import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PixelInput from '../components/PixelInput';
import StatChip from '../components/StatChip';
import { generateStudyPack } from '../services/openaiService';
import { loadData, SYNC_DOCS } from '../services/firestoreSync';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const INT_LOG_KEY = 'levelup_int_log_v1';
const INT_SCORE_KEY = 'levelup_int_score_v1';

const MessageBubble = ({ message, onPress }) => {
  const isUser = message.role === 'user';
  const isLinked = typeof onPress === 'function';

  const bubbleContent = (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.systemBubble, isLinked && styles.linkedBubble]}>
      <Text style={[styles.messageText, isUser ? styles.userText : styles.systemText]}>{message.text}</Text>
      {isLinked ? <Text style={styles.linkHint}>Tap to open study</Text> : null}
    </View>
  );

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowSystem]}>
      {isLinked ? (
        <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.linkedBubblePressed]}>
          {bubbleContent}
        </Pressable>
      ) : bubbleContent}
    </View>
  );
};

const fmtDate = (iso) => {
  const d = new Date(iso);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${mon} ${d.getDate()}`;
};

const LogIntEntryScreen = ({ navigation }) => {
  const scrollRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [quizHistory, setQuizHistory] = useState([]);
  const [intScore, setIntScore] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Reload quiz history each time screen is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [logData, scoreData] = await Promise.all([
            loadData(INT_LOG_KEY, SYNC_DOCS.QUIZ_LOGS),
            loadData(INT_SCORE_KEY, SYNC_DOCS.INT_SCORE),
          ]);
          setQuizHistory(logData || []);
          setIntScore(scoreData || null);
        } catch (_) { /* ignore */ }
      })();
    }, []),
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const canSend = useMemo(() => topic.trim().length > 0 && !loading, [topic, loading]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AppTabs', { screen: 'Log' });
  };

  const handleToggleDifficulty = () => {
    if (loading) {
      return;
    }
    setDifficulty((prev) => (prev >= 5 ? 1 : prev + 1));
  };

  const handleSend = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic || loading) {
      return;
    }

    const userMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      text: trimmedTopic,
    };

    const linkValue = link.trim() || undefined;

    const statusMessage = {
      id: `${Date.now()}-s`,
      role: 'system',
      text: `Generating materials for: ${trimmedTopic} (Difficulty ${difficulty})…`,
    };

    setMessages((prev) => [...prev, userMessage, statusMessage]);
    setLoading(true);
    setError(null);

    setTopic('');

    try {
      const studyPack = await generateStudyPack({
        topic: trimmedTopic,
        difficulty,
        link: linkValue,
      });

      const readyMessage = {
        id: `${Date.now()}-ready`,
        role: 'system',
        text: 'Study pack ready. Tap to open.',
        navigateTo: 'IntStudy',
        payload: {
          topic: trimmedTopic,
          difficulty,
          link: linkValue,
          studyPack,
        },
      };

      setMessages((prev) => [...prev, readyMessage]);
      navigation.navigate('IntStudy', readyMessage.payload);
    } catch (err) {
      const message = err?.message || 'Failed to generate study pack.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          role: 'system',
          text: 'Could not generate study pack. Try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.headerBtn}>
            <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            INT ENTRY
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.chatWrap}>
          {/* ── Quiz History Panel ── */}
          {quizHistory.length > 0 && (
            <View style={styles.historyPanel}>
              <Pressable
                onPress={() => setHistoryOpen((p) => !p)}
                style={styles.historyHeader}
              >
                <Text style={styles.historyHeaderText}>
                  QUIZ HISTORY ({quizHistory.length})
                </Text>
                {intScore != null && (
                  <Text style={styles.intScoreBadge}>
                    INT {Math.round(intScore.score)}%
                  </Text>
                )}
                <MaterialIcons
                  name={historyOpen ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={colors.accent}
                />
              </Pressable>

              {historyOpen && (
                <ScrollView style={styles.historyList} nestedScrollEnabled>
                  {[...quizHistory].reverse().map((q) => (
                    <View key={q.id} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTopic} numberOfLines={1}>
                          {q.topic}
                        </Text>
                        <Text style={styles.historyMeta}>
                          D{q.difficulty}  •  {fmtDate(q.date)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.historyScore,
                          q.percent >= 70
                            ? styles.scoreGood
                            : q.percent >= 40
                            ? styles.scoreOk
                            : styles.scoreBad,
                        ]}
                      >
                        {q.score}/{q.total} ({Math.round(q.percent)}%)
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ── Chat area ── */}
          {messages.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <Text style={styles.emptyTitle}>What would you like to learn today?</Text>
              <Text style={styles.emptySubtitle}>Type a topic, paste a link, or attach a PDF.</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onPress={
                    message.navigateTo
                      ? () => navigation.navigate(message.navigateTo, message.payload)
                      : undefined
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {showLinkInput ? (
          <View style={styles.linkRow}>
            <MaterialIcons name="link" size={18} color={colors.accent} />
            <PixelInput
              size="sm"
              style={styles.linkInput}
              value={link}
              editable={!loading}
              onChangeText={setLink}
              placeholder="Paste URL"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        <View style={styles.composerWrap}>
          <Pressable
            disabled={loading}
            onPress={() => Alert.alert('Attach PDF', 'Coming soon')}
            style={({ pressed }) => [styles.iconBtn, pressed && !loading && styles.iconBtnPressed]}
          >
            <MaterialIcons name="attach-file" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            disabled={loading}
            onPress={() => setShowLinkInput((prev) => !prev)}
            style={({ pressed }) => [styles.iconBtn, pressed && !loading && styles.iconBtnPressed]}
          >
            <MaterialIcons name="link" size={20} color={colors.textMuted} />
          </Pressable>

          <PixelInput
            style={styles.topicInput}
            value={topic}
            editable={!loading}
            onChangeText={setTopic}
            placeholder="Enter learning topic"
            autoCapitalize="sentences"
            autoCorrect={false}
          />

          <StatChip
            label={`D${difficulty}`}
            variant="difficulty"
            onPress={loading ? undefined : handleToggleDifficulty}
          />

          <Pressable
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && canSend && styles.sendBtnPressed,
            ]}
          >
            <MaterialIcons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
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
    fontSize: 12,
    fontFamily: typography.family.pixel,
    textTransform: 'uppercase',
    flexShrink: 1,
    marginHorizontal: 8,
    textAlign: 'center',
  },
  chatWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: typography.family.pixel,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 22,
    fontFamily: typography.family.mono,
    textAlign: 'center',
  },
  messagesContent: {
    paddingBottom: 12,
    gap: 10,
  },
  messageRow: {
    width: '100%',
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowSystem: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '86%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(37,123,244,0.6)',
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  systemBubble: {
    backgroundColor: colors.surfaceAlt,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  linkedBubble: {
    borderColor: 'rgba(37,123,244,0.5)',
  },
  linkedBubblePressed: {
    opacity: 0.82,
  },
  messageText: {
    fontFamily: typography.family.mono,
    fontSize: 20,
    lineHeight: 24,
  },
  userText: {
    color: colors.textPrimary,
  },
  systemText: {
    color: colors.textSecondary,
  },
  linkHint: {
    marginTop: 6,
    color: colors.textLabel,
    fontFamily: typography.family.mono,
    fontSize: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.errorBg,
    borderTopWidth: 1,
    borderTopColor: colors.errorBorder,
  },
  errorText: {
    color: colors.error,
    fontFamily: typography.family.mono,
    fontSize: 16,
  },
  linkInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  composerWrap: {
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.composerBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  iconBtnPressed: {
    opacity: 0.75,
  },
  topicInput: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sendBtnPressed: {
    opacity: 0.8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.disabled,
  },
  /* ── Quiz History ── */
  historyPanel: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  historyHeaderText: {
    flex: 1,
    fontFamily: typography.family.pixel,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  intScoreBadge: {
    fontFamily: typography.family.pixel,
    fontSize: 11,
    color: colors.accent,
    marginRight: 4,
  },
  historyList: {
    maxHeight: 200,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 8,
  },
  historyTopic: {
    fontFamily: typography.family.mono,
    fontSize: 14,
    color: colors.textPrimary,
  },
  historyMeta: {
    fontFamily: typography.family.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyScore: {
    fontFamily: typography.family.pixel,
    fontSize: 12,
  },
  scoreGood: { color: '#22c55e' },
  scoreOk: { color: '#eab308' },
  scoreBad: { color: '#ef4444' },
});

export default LogIntEntryScreen;
