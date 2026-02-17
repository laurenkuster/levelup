import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

const PixelCheckbox = ({ value, onValueChange, label }) => {
  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.row}>
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
    gap: 12,
  },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
    elevation: 3,
  },
  boxChecked: {
    backgroundColor: '#EF4444',
  },
  check: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  label: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

export default PixelCheckbox;
