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
import PixelCheckbox from '../components/PixelCheckbox';

const SignUpScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email] = useState('HERO@MAIL.COM');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);

  const handleSignUp = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your player name');
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

    Alert.alert('Success', 'Character initialized!');
  };

  return (
    <SafeAreaView style={styles.container}>
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
                    <Text style={styles.iconText}>NEW</Text>
                  </View>
                </View>
                <Text style={styles.title}>New player registration</Text>
                <Text style={styles.subtitle}>Enter character details</Text>
              </View>

              <View style={styles.formSection}>
                <PixelInput
                  label="Player id (email)"
                  value={email}
                  editable={false}
                />
                <PixelInput
                  label="Player name"
                  placeholder="ENTER NAME"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="characters"
                />
                <PixelInput
                  label="Create secret code"
                  placeholder="******"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <PixelCheckbox
                  value={accepted}
                  onValueChange={setAccepted}
                  label="I accept the terms and conditions to join the guild."
                />
                <PixelButton
                  title="Initialize character"
                  variant="green"
                  onPress={handleSignUp}
                />
              </View>

              <View style={styles.footerSection}>
                <Text style={styles.footerText}>
                  [System message]
                </Text>
                <Text style={styles.footerTextSmall}>
                  By initializing, you confirm your stats are accurate.
                </Text>
                <Text style={styles.footerLink} onPress={() => navigation.goBack()}>
                  Return to login
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
    minHeight: 760,
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
    width: 64,
    height: 64,
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
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  formSection: {
    marginTop: 24,
    gap: 16,
  },
  footerSection: {
    alignItems: 'center',
    gap: 6,
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
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 12,
    color: '#60A5FA',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
});

export default SignUpScreen;
