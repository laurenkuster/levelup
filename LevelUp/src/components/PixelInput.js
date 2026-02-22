import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const PixelInput = ({
  size = 'md',
  style,
  placeholderTextColor = colors.placeholder,
  ...props
}) => {
  return (
    <TextInput
      style={[styles.base, styles[size], style]}
      placeholderTextColor={placeholderTextColor}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: typography.family.mono,
  },
  sm: {
    fontSize: typography.size.lg,
  },
  md: {
    fontSize: typography.size.xl,
  },
});

export default PixelInput;
