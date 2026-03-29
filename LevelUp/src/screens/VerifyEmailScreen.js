import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { mapAuthError, reloadUser, resendVerificationEmail, signOutUser } from '../services/authService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const RESEND_COOLDOWN_SEC = 30;

const VerifyEmailScreen = ({ navigation }) => {
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const email = useMemo(() => auth.currentUser?.email || 'Unknown email', []);

  const tickCooldown = () => {
    let remaining = RESEND_COOLDOWN_SEC;
    setCooldown(remaining);
    const timerId = setInterval(() => {
      remaining -= 1;
      setCooldown(remaining);
      if (remaining <= 0) {
        clearInterval(timerId);
      }
    }, 1000);
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      await resendVerificationEmail();
      tickCooldown();
      Alert.alert('Verification sent', 'Please check your inbox for a verification email.');
    } catch (error) {
      Alert.alert('Error', mapAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleIHaveVerified = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const user = await reloadUser();
      if (user?.emailVerified) {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      } else {
        Alert.alert('Not verified yet', 'Your email is not verified yet. Please try again after verifying.');
      }
    } catch (error) {
      Alert.alert('Error', mapAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      Alert.alert('Error', mapAuthError(error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>VERIFY EMAIL</Text>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{email}</Text>
        <Text style={styles.meta}>Please verify your email address to continue into the app.</Text>

        <Pressable
          onPress={handleResend}
          disabled={cooldown > 0 || busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.btnPressed,
            (cooldown > 0 || busy) && styles.btnDisabled,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleIHaveVerified}
          disabled={busy}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed, busy && styles.btnDisabled]}
        >
          <Text style={styles.secondaryBtnText}>I've verified</Text>
        </Pressable>

        <Pressable onPress={handleSignOut} disabled={busy} style={({ pressed }) => [styles.linkBtn, pressed && styles.btnPressed]}>
          <Text style={styles.linkBtnText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  title: {
    color: colors.accentStrong,
    fontFamily: typography.family.pixel,
    fontSize: 12,
    marginBottom: 8,
  },
  label: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: 10,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: typography.family.mono,
    fontSize: 20,
  },
  meta: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: 18,
    marginBottom: 8,
  },
  primaryBtn: {
    minWidth: 180,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.7)',
    alignItems: 'center',
  },
  secondaryBtn: {
    minWidth: 180,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryBtnText: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: 9,
  },
  secondaryBtnText: {
    color: colors.textChip,
    fontFamily: typography.family.pixel,
    fontSize: 9,
  },
  linkBtnText: {
    color: colors.textLabel,
    fontFamily: typography.family.pixel,
    fontSize: 9,
    textDecorationLine: 'underline',
  },
});

export default VerifyEmailScreen;
