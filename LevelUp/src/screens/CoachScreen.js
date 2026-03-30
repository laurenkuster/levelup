import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coachSession } from '../services/coachService';
import { savePlan } from '../services/savedPlanService';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { trackCoachMessage, trackPlanSaved } from '../services/trackingService';

/* ── Plan data parser ── */
function parsePlanData(text) {
  const start = text.indexOf(':::PLAN_DATA:::');
  const end = text.indexOf(':::END_PLAN:::');
  if (start === -1 || end === -1) return { displayText: text, planData: null };

  const displayText = text.substring(0, start).trim();
  const jsonStr = text.substring(start + ':::PLAN_DATA:::'.length, end).trim();

  try {
    const planData = JSON.parse(jsonStr);
    if (planData && planData.type && Array.isArray(planData.items) && planData.items.length > 0) {
      return { displayText, planData };
    }
  } catch { /* parse failed — treat as normal text */ }

  return { displayText: text, planData: null };
}

const PLAN_ICONS = {
  workout: 'dumbbell',
  stretch: 'yoga',
  meal: 'food-apple',
};
const PLAN_COLORS = {
  workout: colors.accent,
  stretch: '#f97316',
  meal: colors.success,
};

const CoachScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedMsgIds, setSavedMsgIds] = useState(new Set());
  const scrollViewRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const initChat = async () => {
      setLoading(true);
      try {
        await coachSession.initialize();
        if (mounted) {
          setMessages([
            {
              id: 'msg-welcome',
              sender: 'coach',
              text: 'SYSTEM ONLINE: Coach initialized. Ask about nutrition, sleep, training, or INT study plans. Try "generate a push day workout" to get a saveable plan.',
            },
          ]);
        }
      } catch {
        if (mounted) {
          setMessages([
            { id: 'msg-error', sender: 'coach', text: 'Error connecting to Coach servers.' },
          ]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initChat();
    return () => { mounted = false; };
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    setInputText('');
    const userMsg = { id: `msg-${Date.now()}-u`, sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    trackCoachMessage();
    setLoading(true);

    try {
      const response = await coachSession.sendMessage(text);
      const { displayText, planData } = parsePlanData(response);
      const coachMsg = {
        id: `msg-${Date.now()}-c`,
        sender: 'coach',
        text: displayText,
        planData,
      };
      setMessages((prev) => [...prev, coachMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `msg-${Date.now()}-e`, sender: 'coach', text: 'Coach systems are currently overloaded. Please try again later.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (msg) => {
    if (!msg.planData) return;
    try {
      await savePlan(msg.planData);
      trackPlanSaved(msg.planData.type);
      setSavedMsgIds((prev) => new Set([...prev, msg.id]));
    } catch {
      Alert.alert('Error', 'Failed to save plan.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBtn}>
          <MaterialCommunityIcons name="account-tie" size={24} color={colors.accent} />
        </View>
        <Text style={styles.headerTitle}>AI COACH</Text>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('SavedPlans')}>
          <MaterialIcons name="bookmark" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View key={msg.id}>
              <View
                style={[
                  styles.messageBubble,
                  msg.sender === 'user' ? styles.messageUser : styles.messageCoach,
                ]}
              >
                {msg.sender === 'coach' && (
                  <View style={styles.coachAvatar}>
                    <MaterialCommunityIcons name="robot" size={16} color={colors.accent} />
                  </View>
                )}
                <View style={styles.messageTextContainer}>
                  <Text style={styles.messageText}>{msg.text}</Text>
                </View>
              </View>

              {/* Plan card */}
              {msg.planData && (
                <View style={[styles.planCard, { borderColor: `${PLAN_COLORS[msg.planData.type] || colors.accent}50` }]}>
                  <View style={styles.planHeader}>
                    <MaterialCommunityIcons
                      name={PLAN_ICONS[msg.planData.type] || 'file-document-outline'}
                      size={18}
                      color={PLAN_COLORS[msg.planData.type] || colors.accent}
                    />
                    <Text style={[styles.planTitle, { color: PLAN_COLORS[msg.planData.type] || colors.accent }]}>
                      {msg.planData.title}
                    </Text>
                  </View>
                  <Text style={styles.planMeta}>
                    {msg.planData.items.length} items · {msg.planData.type.toUpperCase()}
                  </Text>
                  {msg.planData.items.slice(0, 4).map((item, i) => (
                    <Text key={i} style={styles.planItem}>
                      {'  '}• {item.name}
                      {item.sets ? ` ${item.sets}×${item.reps}` : ''}
                      {item.duration ? ` ${item.duration}s` : ''}
                    </Text>
                  ))}
                  {msg.planData.items.length > 4 && (
                    <Text style={styles.planMore}>+{msg.planData.items.length - 4} more...</Text>
                  )}
                  <Pressable
                    onPress={() => handleSavePlan(msg)}
                    style={[
                      styles.savePlanBtn,
                      { backgroundColor: savedMsgIds.has(msg.id) ? colors.success : (PLAN_COLORS[msg.planData.type] || colors.accent) },
                    ]}
                    disabled={savedMsgIds.has(msg.id)}
                  >
                    <MaterialIcons
                      name={savedMsgIds.has(msg.id) ? 'bookmark' : 'bookmark-border'}
                      size={16}
                      color={colors.textPrimary}
                    />
                    <Text style={styles.savePlanText}>
                      {savedMsgIds.has(msg.id) ? 'SAVED' : 'SAVE PLAN'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, styles.messageCoach]}>
              <View style={styles.coachAvatar}>
                <MaterialCommunityIcons name="robot" size={16} color={colors.accent} />
              </View>
              <View style={styles.messageTextContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about food, stats, or what to study..."
            placeholderTextColor={colors.placeholder}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed, loading && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={loading || !inputText.trim()}
          >
            <MaterialIcons name="send" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: colors.accent, fontSize: typography.size.md, fontFamily: typography.family.pixel, letterSpacing: 2,
  },

  keyboardView: { flex: 1, marginBottom: 64 },
  scrollContent: { padding: spacing.base, paddingBottom: spacing.xl, gap: spacing.base },

  messageBubble: {
    flexDirection: 'row', maxWidth: '85%', alignItems: 'flex-start', gap: spacing.sm,
  },
  messageUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  messageCoach: { alignSelf: 'flex-start' },
  coachAvatar: {
    width: 32, height: 32, borderRadius: 4,
    backgroundColor: colors.accentSoft,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs,
  },
  messageTextContainer: {
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8,
    borderWidth: 1, borderColor: colors.skeletonSoft,
  },
  messageText: { fontFamily: typography.family.mono, fontSize: typography.size.lg, color: colors.textPrimary, lineHeight: typography.size.lg * typography.lineHeight.normal },

  /* Plan card */
  planCard: {
    marginLeft: 40, marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderRadius: 6, padding: spacing.md, gap: spacing.xs,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planTitle: { fontFamily: typography.family.pixel, fontSize: typography.size.xs },
  planMeta: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.sm, marginBottom: spacing.xs },
  planItem: { color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.md },
  planMore: { color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.sm, fontStyle: 'italic' },
  savePlanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderRadius: 3, marginTop: spacing.sm,
  },
  savePlanText: { color: colors.textPrimary, fontFamily: typography.family.pixel, fontSize: typography.size.xs },

  /* Input */
  inputArea: {
    flexDirection: 'row', padding: spacing.md,
    backgroundColor: colors.header, borderTopWidth: 1,
    borderTopColor: colors.borderSoft, gap: spacing.sm,
  },
  input: {
    flex: 1, height: 48, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.accentOutline,
    borderRadius: 4, paddingHorizontal: spacing.md,
    color: colors.textPrimary, fontFamily: typography.family.mono, fontSize: typography.size.lg,
  },
  sendBtn: {
    width: 44, height: 44, backgroundColor: colors.accent,
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnPressed: { opacity: 0.8 },
});

export default CoachScreen;
