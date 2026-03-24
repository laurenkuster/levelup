import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
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

const CoachScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  // Initialize and load welcome message
  useEffect(() => {
    let mounted = true;
    const initChat = async () => {
      setLoading(true);
      try {
        await coachSession.initialize();
        if (mounted) {
          setMessages([
            { id: 'msg-welcome', sender: 'coach', text: 'SYSTEM ONLINE: Coach initialized. Ask about nutrition, sleep, training, or INT study plans (e.g., software developer skills).' }
          ]);
        }
      } catch (e) {
        if (mounted) {
          setMessages([
            { id: 'msg-error', sender: 'coach', text: 'Error connecting to Coach servers.' }
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
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await coachSession.sendMessage(text);
      const coachMsg = { id: `msg-${Date.now()}-c`, sender: 'coach', text: response };
      setMessages(prev => [...prev, coachMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: `msg-${Date.now()}-e`, sender: 'coach', text: 'Coach systems are currently overloaded. Please try again later.' }]);
    } finally {
      setLoading(false);
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
        <View style={styles.headerBtn} />
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
          {messages.map(msg => (
            <View 
              key={msg.id} 
              style={[
                styles.messageBubble, 
                msg.sender === 'user' ? styles.messageUser : styles.messageCoach
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
  container: {
    flex: 1,
    backgroundColor: '#1A1B26',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 32,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#257bf4',
    fontSize: 14,
    fontFamily: 'PressStart2P',
    letterSpacing: 2,
  },
  keyboardView: {
    flex: 1,
    marginBottom: 64, // Leave space for bottom nav
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  messageBubble: {
    flexDirection: 'row',
    maxWidth: '85%',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  messageCoach: {
    alignSelf: 'flex-start',
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: 'rgba(37,123,244,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  messageTextContainer: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  messageText: {
    fontFamily: 'VT323',
    fontSize: 18,
    color: '#e2e8f0',
    lineHeight: 24,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#161826',
    borderTopWidth: 1,
    borderTopColor: 'rgba(37,123,244,0.3)',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)',
    borderRadius: 4,
    paddingHorizontal: 12,
    color: '#fff',
    fontFamily: 'VT323',
    fontSize: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#257bf4',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {
    opacity: 0.8,
  },
});

export default CoachScreen;
