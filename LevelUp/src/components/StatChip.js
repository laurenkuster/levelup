import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const StatChip = ({ label, variant = 'pill', onPress, style, textStyle }) => {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.base,
          styles[variant],
          pressed && styles.pressed,
          style,
        ]}
      >
        <Text style={[styles.textBase, styles[`${variant}Text`], textStyle]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.base, styles[variant], style]}>
      <Text style={[styles.textBase, styles[`${variant}Text`], textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
    minHeight: 36,
  },
  pillText: {
    color: colors.textChip,
    fontFamily: typography.family.mono,
    fontSize: typography.size.md,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.tagBg,
    minHeight: 28,
  },
  tagText: {
    color: colors.textTag,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  difficulty: {
    minWidth: 48,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  difficultyText: {
    color: colors.accent,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  textBase: {
    textAlign: 'center',
  },
});

export default StatChip;
