import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const PixelInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5B6476"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#60A5FA',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 18,
    letterSpacing: 1.5,
  },
  inputFocused: {
    borderColor: '#3B82F6',
  },
  inputDisabled: {
    backgroundColor: '#1F2937',
    color: '#9CA3AF',
  },
});

export default PixelInput;
