import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const CustomButton = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const variantStyles = VARIANTS[variant] || VARIANTS.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variantStyles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.loaderColor} />
      ) : (
        <Text style={[styles.buttonText, variantStyles.text, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
};

const VARIANTS = {
  primary: {
    button: {
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: 'rgba(37,123,244,0.7)',
    },
    text: { color: colors.textPrimary },
    loaderColor: colors.textPrimary,
  },
  secondary: {
    button: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    text: { color: colors.accent },
    loaderColor: colors.accent,
  },
  text: {
    button: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.sm,
    },
    text: { color: colors.accent },
    loaderColor: colors.accent,
  },
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default CustomButton;
