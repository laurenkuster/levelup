import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  SafeAreaView,
  TextInput,
  Pressable,
  ImageBackground,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { mapAuthError, signUp } from '../services/authService';

const SignUpScreen = ({ navigation, route }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(route?.params?.email || '');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your player name');
      return;
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Error', 'Secret code must be at least 6 characters');
      return;
    }

    if (!accepted) {
      Alert.alert('Error', 'Please accept the terms to continue');
      return;
    }

    setSubmitting(true);

    try {
      const credential = await signUp(email, password, name);
      const target = credential.user.emailVerified ? 'AppStack' : 'VerifyEmail';
      const rootNav = navigation.getParent();
      if (rootNav) {
        rootNav.reset({ index: 0, routes: [{ name: target }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: target }] });
      }
    } catch (error) {
      Alert.alert('Error', mapAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={{
          uri: 'https://www.transparenttextures.com/patterns/dark-matter.png',
        }}
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.panel}>
              <View style={styles.scanlines} />
              <View style={styles.panelContent}>
                <View style={styles.headerSection}>
                  <View style={styles.iconGlow}>
                    <View style={styles.iconFrame}>
                      <MaterialIcons
                        name="person-add"
                        size={34}
                        color="#3B82F6"
                        style={styles.iconRotate}
                      />
                    </View>
                  </View>
  <Text style={styles.title}>
    NEW PLAYER {'\n'}
  </Text>
                  <Text style={styles.subtitle}>Enter Character Details</Text>
                </View>

                <View style={styles.formSection}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Player ID (Email)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="HERO@MAIL.COM"
                      placeholderTextColor="#4B5563"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Player Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ENTER NAME"
                      placeholderTextColor="#4B5563"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Create Secret Code</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="******"
                      placeholderTextColor="#4B5563"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  <Pressable
                    onPress={() => setAccepted((prev) => !prev)}
                    style={styles.checkboxRow}
                  >
                    <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                      {accepted ? (
                        <MaterialIcons name="favorite" size={12} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I accept the{' '}
                      <Text style={styles.checkboxLink}>Terms</Text> &{' '}
                      <Text style={styles.checkboxLink}>Conditions</Text> to join the guild.
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSignUp}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.primaryButtonPressed,
                      submitting && styles.primaryButtonDisabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Initialize Character</Text>
                    <MaterialIcons name="keyboard-double-arrow-right" size={20} color="#0B0F1A" />
                  </Pressable>
                </View>

                <View style={styles.footerSection}>
                  <Text style={styles.footerText}>
                    [SYSTEM MESSAGE]{'\n'}By initializing, you confirm your stats are accurate. No rerolls allowed.
                  </Text>
                  <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.footerLink}>Return to login</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1B26',
  },
  background: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  backgroundImage: {
    opacity: 0.6,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#242636',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
    elevation: 6,
    minHeight: 800,
    overflow: 'hidden',
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  headerSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  iconGlow: {
    padding: 10,
    borderRadius: 56,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  iconFrame: {
    width: 80,
    height: 80,
    backgroundColor: '#1A1B26',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  iconRotate: {
    transform: [{ rotate: '-45deg' }],
  },
  title: {
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: 'PressStart2P',
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#D1D5DB',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
    paddingBottom: 4,
    fontFamily: 'VT323',
  },
  formSection: {
    gap: 16,
  },
  fieldGroup: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'PressStart2P',
  },
  input: {
    height: 56,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 22,
    letterSpacing: 1.5,
    fontFamily: 'VT323',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
  },
  checkboxChecked: {
    backgroundColor: '#EF4444',
  },
  checkboxLabel: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    lineHeight: 18,
    fontFamily: 'VT323',
  },
  checkboxLink: {
    color: '#3B82F6',
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
  },
  primaryButton: {
    height: 64,
    backgroundColor: '#4ADE80',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#15803D',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 0,
    elevation: 6,
  },
  primaryButtonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 12,
    color: '#0B0F1A',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'PressStart2P',
  },
  footerSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingBottom: 12,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'VT323',
  },
  footerLink: {
    fontSize: 10,
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textDecorationLine: 'underline',
    fontFamily: 'PressStart2P',
  },
});

export default SignUpScreen;
