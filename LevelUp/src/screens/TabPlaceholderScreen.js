import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { POST_LOGIN_TABS } from '../config/navigationData';

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
    backgroundColor: '#1A1B26',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826',
  },
  title: {
    color: '#3B82F6',
    fontSize: 18,
    fontFamily: 'PressStart2P',
  },
  subtitle: {
    color: '#7aaef8',
    fontSize: 12,
    fontFamily: 'VT323',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  panel: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.35)',
    padding: 18,
    minHeight: 180,
    justifyContent: 'center',
    gap: 8,
  },
  panelTitle: {
    color: '#ffffff',
    fontFamily: 'PressStart2P',
    fontSize: 12,
  },
  panelText: {
    color: '#cbd5e1',
    fontFamily: 'VT323',
    fontSize: 18,
  },
});

export default TabPlaceholderScreen;
