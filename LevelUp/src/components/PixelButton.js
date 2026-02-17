import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';

const PixelButton = ({ title, onPress, variant = 'blue', style, textStyle, disabled }) => {
  const palette = variant === 'green' ? styles.green : styles.blue;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        palette.base,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.innerRow}>
        <Text style={[styles.text, palette.text, textStyle]}>{title}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 0,
    elevation: 6,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  pressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
    elevation: 3,
  },
  disabled: {
    opacity: 0.6,
  },
  blue: {
    base: {
      backgroundColor: '#3B82F6',
      shadowColor: '#1E3A8A',
    },
    text: {
      color: '#FFFFFF',
    },
  },
  green: {
    base: {
      backgroundColor: '#4ADE80',
      shadowColor: '#15803D',
    },
    text: {
      color: '#0F172A',
    },
  },
});

export default PixelButton;
