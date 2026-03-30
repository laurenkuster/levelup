import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import PostLoginBottomNav from '../components/PostLoginBottomNav';
import { LOG_TRAINING_ACTIONS } from '../config/navigationData';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const renderIcon = ({ family, name }) => {
  if (family === 'community') {
    return <MaterialCommunityIcons name={name} size={24} color={colors.accent} />;
  }

  return <MaterialIcons name={name} size={24} color={colors.accent} />;
};

const LogScreen = ({ navigation }) => {
  const parentNavigation = navigation.getParent();

  const handleOpenEntry = (routeName) => {
    if (parentNavigation?.navigate) {
      parentNavigation.navigate(routeName);
      return;
    }

    navigation.navigate(routeName);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LOG</Text>
        <Text style={styles.subtitle}>Choose what to train</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {LOG_TRAINING_ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => handleOpenEntry(action.route)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardLeft}>
              <View style={styles.iconWrap}>
                {renderIcon({ family: action.iconFamily, name: action.iconName })}
              </View>

              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{action.title}</Text>
                <Text style={styles.cardDescription}>{action.description}</Text>
              </View>
            </View>

            <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>

      <PostLoginBottomNav navigation={navigation} activeTab="Log" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
  },
  title: {
    color: colors.accentStrong,
    fontSize: typography.size.lg,
    fontFamily: typography.family.pixel,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textLabel,
    fontSize: typography.size.lg,
    fontFamily: typography.family.mono,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.base,
    paddingBottom: 100,
    gap: spacing.md,
  },
  card: {
    width: '100%',
    minHeight: 84,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flexShrink: 1,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.sm,
    fontFamily: typography.family.pixel,
    marginBottom: spacing.valueLabelGap,
  },
  cardDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.lg,
    fontFamily: typography.family.mono,
  },
});

export default LogScreen;
