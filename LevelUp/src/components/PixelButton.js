import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const PixelButton = ({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  textStyle,
}) => {
  const palette = styles.variants[variant] || styles.variants.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        palette.base,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.loader} size="small" />
      ) : (
        <Text style={[styles.text, palette.text, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minWidth: 200,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  text: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: colors.disabled,
  },
  variants: {
    primary: {
      base: {
        backgroundColor: colors.accent,
        borderColor: 'rgba(37,123,244,0.7)',
      },
      text: {
        color: colors.textPrimary,
      },
      loader: colors.textPrimary,
    },
    success: {
      base: {
        backgroundColor: colors.success,
        borderColor: colors.successBorder,
      },
      text: {
        color: colors.textDark,
      },
      loader: colors.textDark,
    },
  },
});

export default PixelButton;
