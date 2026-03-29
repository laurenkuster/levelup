import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { POST_LOGIN_TABS } from '../config/navigationData';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const TabPlaceholderScreen = ({ route }) => {
  const activeTab = route.name;
  const tabMeta = POST_LOGIN_TABS.find((tab) => tab.route === activeTab);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{tabMeta?.title || 'TAB'}</Text>
        <Text style={styles.subtitle}>{tabMeta?.subtitle || 'Coming soon'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>COMING SOON</Text>
          <Text style={styles.panelText}>This module is wired and ready for feature data.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
  },
  title: {
    color: colors.accentStrong,
    fontSize: 18,
    fontFamily: typography.family.pixel,
  },
  subtitle: {
    color: colors.textLabel,
    fontSize: 12,
    fontFamily: typography.family.mono,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 18,
    minHeight: 180,
    justifyContent: 'center',
    gap: 8,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontFamily: typography.family.pixel,
    fontSize: 12,
  },
  panelText: {
    color: colors.textSecondary,
    fontFamily: typography.family.mono,
    fontSize: 18,
  },
});

export default TabPlaceholderScreen;
