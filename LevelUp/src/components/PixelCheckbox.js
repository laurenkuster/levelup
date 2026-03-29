import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const PixelCheckbox = ({ value, onValueChange, label }) => {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={styles.row}
    >
      <View style={[styles.box, value && styles.boxChecked]}>
        {value ? <Text style={styles.check}>X</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.md,
  },
  box: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
    elevation: 3,
  },
  boxChecked: {
    backgroundColor: colors.error,
  },
  check: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: 'bold',
  },
  label: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

export default PixelCheckbox;
