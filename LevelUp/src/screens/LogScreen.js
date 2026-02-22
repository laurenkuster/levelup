import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import PostLoginBottomNav from '../components/PostLoginBottomNav';
import { LOG_TRAINING_ACTIONS } from '../config/navigationData';

const renderIcon = ({ family, name }) => {
  if (family === 'community') {
    return <MaterialCommunityIcons name={name} size={24} color="#257bf4" />;
  }

  return <MaterialIcons name={name} size={24} color="#257bf4" />;
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

            <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
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
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#7aaef8',
    fontSize: 18,
    fontFamily: 'VT323',
    marginTop: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  card: {
    width: '100%',
    minHeight: 84,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#257bf4',
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
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)',
    backgroundColor: 'rgba(37,123,244,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flexShrink: 1,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'PressStart2P',
    marginBottom: 2,
  },
  cardDescription: {
    color: '#cbd5e1',
    fontSize: 18,
    fontFamily: 'VT323',
  },
});

export default LogScreen;
