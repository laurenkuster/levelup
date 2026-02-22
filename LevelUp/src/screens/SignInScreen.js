import React, { useEffect, useState } from 'react';
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
import { FontAwesome, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { mapAuthError, signIn, signInWithGoogleIdToken } from '../services/authService';

WebBrowser.maybeCompleteAuthSession();

// Build redirect URI from reversed iOS client ID – works in Expo Go
// via ASWebAuthenticationSession (no Info.plist registration needed).
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosRedirectUri = iosClientId
  ? `${iosClientId.split('.').reverse().join('.')}:/oauthredirect`
  : undefined;

const SignInScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ...(Platform.OS === 'ios' && iosRedirectUri ? { redirectUri: iosRedirectUri } : {}),
  });

  const resetToTarget = (target) => {
    const rootNav = navigation.getParent();
    if (rootNav) {
      rootNav.reset({ index: 0, routes: [{ name: target }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: target }] });
    }
  };

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') {
      setGoogleBusy(false);
      return;
    }

    const idToken =
      googleResponse.authentication?.idToken ||
      googleResponse.params?.id_token;

    if (!idToken) {
      Alert.alert('Error', 'Google sign-in failed. Missing token.');
      setGoogleBusy(false);
      return;
    }

    (async () => {
      try {
        const credential = await signInWithGoogleIdToken(idToken);
        resetToTarget(credential.user.emailVerified ? 'AppStack' : 'VerifyEmail');
      } catch (error) {
        Alert.alert('Error', mapAuthError(error));
      } finally {
        setGoogleBusy(false);
      }
    })();
  }, [googleResponse]);

  const handleStartGame = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setChecking(true);

    try {
      const credential = await signIn(email, password);
      resetToTarget(credential.user.emailVerified ? 'AppStack' : 'VerifyEmail');
    } catch (error) {
      Alert.alert('Error', mapAuthError(error));
    } finally {
      setChecking(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (checking || googleBusy || !googleRequest) return;
    setGoogleBusy(true);
    try {
      await promptGoogleSignIn();
    } catch (error) {
      setGoogleBusy(false);
      Alert.alert('Error', mapAuthError(error));
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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.panel}>
              <View style={styles.scanlines} />
              <View style={styles.panelContent}>
                <View style={styles.headerSection}>
                  <View style={styles.iconGlow}>
                    <View style={styles.iconFrame}>
                      <MaterialCommunityIcons
                        name="sword-cross"
                        size={44}
                        color="#3B82F6"
                        style={styles.iconRotate}
                      />
                    </View>
                  </View>
                  <Text style={styles.title}>
                    <Text style={styles.titleAccent}>Level</Text>UP
                  </Text>
                  <Text style={styles.subtitle}>System Initializing...</Text>
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
                    <Text style={styles.label}>Secret Code (Password)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••"
                      placeholderTextColor="#4B5563"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <Pressable
                    onPress={handleStartGame}
                    disabled={checking}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.primaryButtonPressed,
                      checking && styles.primaryButtonDisabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Start Game</Text>
                    <MaterialIcons
                      name="play-arrow"
                      size={20}
                      color="#FFFFFF"
                      style={styles.primaryButtonIcon}
                    />
                  </Pressable>

                  <Pressable onPress={() => navigation.navigate('SignUp', { email })}>
                    <Text style={styles.footerLink}>New player? Create account</Text>
                  </Pressable>
                </View>

                <View style={styles.dividerSection}>
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerLabelWrap}>
                    <Text style={styles.dividerLabel}>Select Character Class</Text>
                  </View>
                </View>

                <View style={styles.classGrid}>
                  <Pressable
                    style={[styles.classButton, (googleBusy || !googleRequest) && styles.classButtonDisabled]}
                    onPress={handleGoogleSignIn}
                    disabled={googleBusy || !googleRequest}
                  >
                    <FontAwesome name="google" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Pressable style={styles.classButton}>
                    <FontAwesome name="apple" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View style={styles.footerSection}>
                  <Text style={styles.footerText}>
                    [SYSTEM MESSAGE]{'\n'}By clicking start, you accept the{' '}
                    <Text style={styles.footerLink}>Rules of Play</Text> and{' '}
                    <Text style={styles.footerLink}>Privacy Protocol</Text>.
                  </Text>
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
    gap: 24,
  },
  headerSection: {
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  iconGlow: {
    padding: 10,
    borderRadius: 56,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  iconFrame: {
    width: 96,
    height: 96,
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
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'PressStart2P',
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  titleAccent: {
    color: '#3B82F6',
  },
  subtitle: {
    fontSize: 20,
    color: '#D1D5DB',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
    paddingBottom: 4,
    fontFamily: 'VT323',
  },
  formSection: {
    gap: 20,
  },
  fieldGroup: {
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
    height: 56,
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 22,
    letterSpacing: 1.5,
    fontFamily: 'VT323',
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
  primaryButtonIcon: {
    marginTop: 1,
  },
  dividerSection: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    borderTopWidth: 2,
    borderTopColor: '#374151',
    borderStyle: 'dashed',
  },
  dividerLabelWrap: {
    backgroundColor: '#242636',
    paddingHorizontal: 12,
  },
  dividerLabel: {
    fontSize: 16,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontFamily: 'VT323',
  },
  classGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  classButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
    elevation: 4,
  },
  classButtonDisabled: {
    opacity: 0.5,
  },
  footerSection: {
    marginTop: 'auto',
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    lineHeight: 18,
    fontFamily: 'VT323',
  },
  footerLink: {
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
});

export default SignInScreen;
