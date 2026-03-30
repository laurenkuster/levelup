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
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

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
                        color={colors.accentStrong}
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
                      placeholderTextColor={colors.placeholder}
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
                      placeholderTextColor={colors.placeholder}
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
                      color={colors.textPrimary}
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
                    <FontAwesome name="google" size={20} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable style={styles.classButton}>
                    <FontAwesome name="apple" size={20} color={colors.textPrimary} />
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
    backgroundColor: colors.background,
  },
  background: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
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
    overflow: 'hidden',
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  iconGlow: {
    padding: spacing.sm,
    borderRadius: 56,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  iconFrame: {
    width: 96,
    height: 96,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  iconRotate: {
    transform: [{ rotate: '-45deg' }],
  },
  title: {
    fontSize: typography.size.xxl,
    color: colors.textPrimary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: typography.family.pixel,
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  titleAccent: {
    color: colors.accentStrong,
  },
  subtitle: {
    fontSize: typography.size.xl,
    color: colors.textSecondary,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    borderBottomWidth: 2,
    borderBottomColor: colors.accentStrong,
    paddingBottom: 4,
    fontFamily: typography.family.mono,
  },
  formSection: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.md,
  },
  label: {
    fontSize: typography.size.md,
    color: colors.accentStrong,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: typography.family.pixel,
  },
  input: {
    height: 56,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    fontSize: typography.size.xxl,
    letterSpacing: 1.5,
    fontFamily: typography.family.mono,
  },
  primaryButton: {
    height: 64,
    backgroundColor: colors.accentStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
    fontSize: typography.size.md,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: typography.family.pixel,
  },
  primaryButtonIcon: {
    marginTop: 1,
  },
  dividerSection: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
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
    paddingHorizontal: spacing.md,
  },
  dividerLabel: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontFamily: typography.family.mono,
  },
  classGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  classButton: {
    flex: 1,
    height: 56,
    backgroundColor: colors.surfaceAlt,
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
    paddingBottom: spacing.base,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    lineHeight: 18,
    fontFamily: typography.family.mono,
  },
  footerLink: {
    color: colors.accentStrong,
    textDecorationLine: 'underline',
  },
});

export default SignInScreen;
