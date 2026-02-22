import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

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
          <MaterialIcons name="arrow-back" size={22} color="#257bf4" />
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
    backgroundColor: '#1A1B26',
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 34,
    alignItems: 'center',
  },
  title: {
    color: '#3B82F6',
    fontSize: 12,
    fontFamily: 'PressStart2P',
    textTransform: 'uppercase',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.4)',
    padding: 18,
    alignItems: 'center',
    shadowColor: '#257bf4',
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PressStart2P',
    marginBottom: 8,
  },
  panelBody: {
    color: '#cbd5e1',
    fontSize: 20,
    fontFamily: 'VT323',
  },
});

export default LogEntryPlaceholderScreen;
