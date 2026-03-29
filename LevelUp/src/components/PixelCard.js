import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/typography';

const PixelCard = ({ variant = 'panel', style, children }) => {
  return <View style={[styles.base, styles[variant], style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderWidth: 1,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  panel: {},
  deep: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
  },
});

export default PixelCard;
