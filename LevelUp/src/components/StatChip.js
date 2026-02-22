import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const StatChip = ({ label, variant = 'pill', onPress, style, textStyle }) => {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  pillText: {
    color: colors.textChip,
    fontFamily: typography.family.mono,
    fontSize: typography.size.base,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.tagBg,
  },
  tagText: {
    color: colors.textTag,
    fontFamily: typography.family.pixel,
    fontSize: typography.size.xs,
  },
  difficulty: {
    minWidth: 44,
    height: 34,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  difficultyText: {
    color: colors.accent,
    fontFamily: typography.family.pixel,
    fontSize: 9,
  },
  textBase: {
    textAlign: 'center',
  },
});

export default StatChip;
