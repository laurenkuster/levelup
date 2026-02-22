import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { mapAuthError, signIn } from '../services/authService';

const ExistingLoginScreen = ({ route, navigation }) => {
  const { email = 'HERO@MAIL.COM' } = route?.params || {};
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);

  const handleConfirmLogin = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your secret code');
      return;
    }

    setChecking(true);

    try {
      const credential = await signIn(email, password);
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
      setChecking(false);
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
                        name="lock"
                        size={28}
                        color="#3B82F6"
                        style={styles.iconRotate}
                      />
                    </View>
                  </View>

                  <View style={styles.statusBox}>
                    <Text style={styles.statusLabel}>Player ID Identified</Text>
                    <Text style={styles.statusValue}>[ {email.toUpperCase()} ]</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Secret Code (Password)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••"
                      placeholderTextColor="#4B5563"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.actionSection}>
                  <Pressable
                    onPress={handleConfirmLogin}
                    disabled={checking}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.primaryButtonPressed,
                      checking && styles.primaryButtonDisabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Confirm Login</Text>
                    <MaterialIcons name="key" size={18} color="#FFFFFF" />
                  </Pressable>

                  <Pressable
                    onPress={() => Alert.alert('Forgot Secret Code', 'Coming soon!')}
                  >
                    <Text style={styles.forgotLink}>Forgot Secret Code?</Text>
                  </Pressable>
                </View>

                <View style={styles.footerSection}>
                  <View style={styles.dotRow}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                  <Text style={styles.footerText}>
                    [SECURE CONNECTION ESTABLISHED]{'\n'}v.2.4.1
                  </Text>
                  <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.backLink}>Change player ID</Text>
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
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 12,
    gap: 24,
  },
  iconGlow: {
    padding: 8,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  iconFrame: {
    width: 64,
    height: 64,
    backgroundColor: '#1A1B26',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  iconRotate: {
    transform: [{ rotate: '-45deg' }],
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#111827',
    padding: 16,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 10,
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontFamily: 'PressStart2P',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: 1.6,
    fontFamily: 'VT323',
  },
  fieldGroup: {
    width: '100%',
    gap: 12,
  },
  label: {
    fontSize: 12,
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'PressStart2P',
  },
  input: {
    height: 64,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: 'VT323',
  },
  actionSection: {
    gap: 16,
    paddingBottom: 8,
  },
  primaryButton: {
    height: 64,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1E3A8A',
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
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'PressStart2P',
  },
  forgotLink: {
    textAlign: 'center',
    fontSize: 10,
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textDecorationLine: 'underline',
    fontFamily: 'PressStart2P',
  },
  footerSection: {
    alignItems: 'center',
    gap: 12,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: '#4B5563',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    lineHeight: 18,
    fontFamily: 'VT323',
  },
  backLink: {
    fontSize: 10,
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textDecorationLine: 'underline',
    fontFamily: 'PressStart2P',
  },
});

export default ExistingLoginScreen;
