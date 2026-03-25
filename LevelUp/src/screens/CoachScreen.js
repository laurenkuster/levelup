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
  workout: '#257bf4',
  stretch: '#f97316',
  meal: '#22c55e',
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
          <MaterialCommunityIcons name="account-tie" size={24} color="#257bf4" />
        </View>
        <Text style={styles.headerTitle}>AI COACH</Text>
        <Pressable style={styles.headerBtn} onPress={() => navigation.navigate('SavedPlans')}>
          <MaterialIcons name="bookmark" size={22} color="#257bf4" />
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
                    <MaterialCommunityIcons name="robot" size={16} color="#257bf4" />
                  </View>
                )}
                <View style={styles.messageTextContainer}>
                  <Text style={styles.messageText}>{msg.text}</Text>
                </View>
              </View>

              {/* Plan card */}
              {msg.planData && (
                <View style={[styles.planCard, { borderColor: `${PLAN_COLORS[msg.planData.type] || '#257bf4'}50` }]}>
                  <View style={styles.planHeader}>
                    <MaterialCommunityIcons
                      name={PLAN_ICONS[msg.planData.type] || 'file-document-outline'}
                      size={18}
                      color={PLAN_COLORS[msg.planData.type] || '#257bf4'}
                    />
                    <Text style={[styles.planTitle, { color: PLAN_COLORS[msg.planData.type] || '#257bf4' }]}>
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
                      { backgroundColor: savedMsgIds.has(msg.id) ? '#22c55e' : (PLAN_COLORS[msg.planData.type] || '#257bf4') },
                    ]}
                    disabled={savedMsgIds.has(msg.id)}
                  >
                    <MaterialIcons
                      name={savedMsgIds.has(msg.id) ? 'bookmark' : 'bookmark-border'}
                      size={16}
                      color="#fff"
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
                <MaterialCommunityIcons name="robot" size={16} color="#257bf4" />
              </View>
              <View style={styles.messageTextContainer}>
                <ActivityIndicator size="small" color="#257bf4" />
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
            placeholderTextColor="#64748b"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed, loading && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={loading || !inputText.trim()}
          >
            <MaterialIcons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1B26' },

  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  headerBtn: { width: 32, alignItems: 'center' },
  headerTitle: {
    color: '#257bf4', fontSize: 14, fontFamily: 'PressStart2P', letterSpacing: 2,
  },

  keyboardView: { flex: 1, marginBottom: 64 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 16 },

  messageBubble: {
    flexDirection: 'row', maxWidth: '85%', alignItems: 'flex-start', gap: 8,
  },
  messageUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  messageCoach: { alignSelf: 'flex-start' },
  coachAvatar: {
    width: 32, height: 32, borderRadius: 4,
    backgroundColor: 'rgba(37,123,244,0.15)',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.4)',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  messageTextContainer: {
    backgroundColor: '#111827', padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)',
  },
  messageText: { fontFamily: 'VT323', fontSize: 18, color: '#e2e8f0', lineHeight: 24 },

  /* Plan card */
  planCard: {
    marginLeft: 40, marginTop: 8,
    backgroundColor: '#0f172a', borderWidth: 1, borderRadius: 6, padding: 12, gap: 4,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { fontFamily: 'PressStart2P', fontSize: 8 },
  planMeta: { color: '#64748b', fontFamily: 'VT323', fontSize: 16, marginBottom: 4 },
  planItem: { color: '#cbd5e1', fontFamily: 'VT323', fontSize: 17 },
  planMore: { color: '#64748b', fontFamily: 'VT323', fontSize: 16, fontStyle: 'italic' },
  savePlanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 3, marginTop: 8,
  },
  savePlanText: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 8 },

  /* Input */
  inputArea: {
    flexDirection: 'row', padding: 12,
    backgroundColor: '#161826', borderTopWidth: 1,
    borderTopColor: 'rgba(37,123,244,0.3)', gap: 8,
  },
  input: {
    flex: 1, height: 44, backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: 'rgba(37,123,244,0.45)',
    borderRadius: 4, paddingHorizontal: 12,
    color: '#fff', fontFamily: 'VT323', fontSize: 20,
  },
  sendBtn: {
    width: 44, height: 44, backgroundColor: '#257bf4',
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnPressed: { opacity: 0.8 },
});

export default CoachScreen;
