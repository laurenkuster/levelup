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
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

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
      const target = credential.user.emailVerified ? 'Onboarding' : 'VerifyEmail';
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
                        color={colors.accentStrong}
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
                      placeholderTextColor={colors.placeholder}
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
                      placeholderTextColor={colors.placeholder}
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
                      placeholderTextColor={colors.placeholder}
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
                        <MaterialIcons name="favorite" size={12} color={colors.textPrimary} />
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
                    <MaterialIcons name="keyboard-double-arrow-right" size={20} color={colors.textDark} />
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
    minHeight: 800,
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
    gap: spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  iconGlow: {
    padding: spacing.sm,
    borderRadius: 56,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  iconFrame: {
    width: 80,
    height: 80,
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
    fontSize: typography.size.lg,
    color: colors.textPrimary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: typography.family.pixel,
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: typography.size.lg,
    color: colors.textSecondary,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    borderBottomWidth: 2,
    borderBottomColor: colors.accentStrong,
    paddingBottom: 4,
    fontFamily: typography.family.mono,
  },
  formSection: {
    gap: spacing.base,
  },
  fieldGroup: {
    gap: spacing.sm,
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
    paddingHorizontal: spacing.base,
    fontSize: typography.size.xxl,
    letterSpacing: 1.5,
    fontFamily: typography.family.mono,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.error,
  },
  checkboxLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    lineHeight: 18,
    fontFamily: typography.family.mono,
  },
  checkboxLink: {
    color: colors.accentStrong,
    borderBottomWidth: 1,
    borderBottomColor: colors.accentStrong,
  },
  primaryButton: {
    height: 64,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
    fontSize: typography.size.md,
    color: colors.textDark,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: typography.family.pixel,
  },
  footerSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  footerText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: typography.family.mono,
  },
  footerLink: {
    fontSize: typography.size.sm,
    color: colors.accentStrong,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textDecorationLine: 'underline',
    fontFamily: typography.family.pixel,
  },
});

export default SignUpScreen;
