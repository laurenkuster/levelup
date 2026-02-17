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
} from 'react-native';
import PixelButton from '../components/PixelButton';
import PixelInput from '../components/PixelInput';

const SignInScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignIn = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // TODO: Implement actual sign-in logic with your API
      // Example: await signIn(email, password);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      console.log('Signing in with:', email);
      Alert.alert('Success', 'Sign in successful!');
      
      // Navigate to main app after successful sign-in
      // navigation.replace('Home');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // TODO: Navigate to forgot password screen
    Alert.alert('Forgot Password', 'Password reset functionality coming soon!');
  };

  const handleSignUp = () => {
    navigation.navigate('SignUp');
  };

  return (
    <SafeAreaView style={styles.container}>
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
                    <Text style={styles.iconText}>LOCK</Text>
                  </View>
                </View>
                <Text style={styles.title}>
                  <Text style={styles.titleAccent}>Level</Text>UP
                </Text>
                <Text style={styles.subtitle}>Secure login sequence</Text>
              </View>

              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Player id identified</Text>
                <Text style={styles.statusValue}>[ HERO@MAIL.COM ]</Text>
              </View>

              <View style={styles.formSection}>
                <PixelInput
                  label="Player id (email)"
                  placeholder="HERO@MAIL.COM"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <PixelInput
                  label="Secret code (password)"
                  placeholder="******"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <PixelButton
                  title={loading ? 'Confirming...' : 'Confirm login'}
                  onPress={handleSignIn}
                  disabled={loading}
                />
                <Text style={styles.link} onPress={handleForgotPassword}>
                  Forgot secret code?
                </Text>
              </View>

              <View style={styles.footerSection}>
                <View style={styles.dotRow}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
                <Text style={styles.footerText}>
                  [Secure connection established]
                </Text>
                <Text style={styles.footerTextSmall}>v.2.4.1</Text>
                <Text style={styles.footerLink} onPress={handleSignUp}>
                  Create new player
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1B26',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  panel: {
    flex: 1,
    backgroundColor: '#242636',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 0,
    elevation: 6,
    minHeight: 720,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    gap: 12,
  },
  iconGlow: {
    padding: 8,
    borderRadius: 48,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  iconFrame: {
    width: 72,
    height: 72,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#1A1B26',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
  },
  iconText: {
    color: '#60A5FA',
    fontSize: 10,
    letterSpacing: 1.8,
    transform: [{ rotate: '-45deg' }],
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titleAccent: {
    color: '#60A5FA',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusBox: {
    marginTop: 24,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#4B5563',
    padding: 16,
  },
  statusLabel: {
    fontSize: 10,
    color: '#60A5FA',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  formSection: {
    marginTop: 32,
    gap: 16,
  },
  link: {
    color: '#60A5FA',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 16,
  },
  footerSection: {
    alignItems: 'center',
    gap: 6,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: '#4B5563',
  },
  footerText: {
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerTextSmall: {
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerLink: {
    fontSize: 12,
    color: '#60A5FA',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
});

export default SignInScreen;
