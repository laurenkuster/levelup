import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const titleByRoute = {
  LogIntEntry: 'INT ENTRY',
  LogStrEntry: 'STR ENTRY',
  LogStmEntry: 'STM ENTRY',
  LogSpdEntry: 'SPD ENTRY',
  LogDexEntry: 'DEX ENTRY',
  LogFoodEntry: 'FOOD ENTRY',
  LogSleepEntry: 'SLEEP ENTRY',
};

const LogEntryPlaceholderScreen = ({ navigation, route }) => {
  const screenTitle = titleByRoute[route?.name] || 'LOG ENTRY';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.title}>{screenTitle}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.centerWrap}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{screenTitle}</Text>
          <Text style={styles.panelBody}>Coming soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 34,
    alignItems: 'center',
  },
  title: {
    color: colors.accentStrong,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
    textTransform: 'uppercase',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
    marginBottom: spacing.sm,
  },
  panelBody: {
    color: colors.textSecondary,
    fontSize: typography.size.xl,
    fontFamily: typography.family.mono,
  },
});

export default LogEntryPlaceholderScreen;
