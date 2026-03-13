import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { POST_LOGIN_TABS } from '../config/navigationData';

const { width: SCREEN_W } = Dimensions.get('window');
// Scale font: 8px base at 390pt width, min 6, max 9
const TAB_FONT = Math.max(6, Math.min(9, Math.round((SCREEN_W / 390) * 8)));

const renderIcon = ({ iconFamily, iconName, color }) => {
  if (iconFamily === 'community') {
    return <MaterialCommunityIcons name={iconName} size={22} color={color} />;
  }

  return <MaterialIcons name={iconName} size={22} color={color} />;
};

const PostLoginBottomNav = ({ navigation, activeTab }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {POST_LOGIN_TABS.map((tab) => {
        const active = tab.key === activeTab;
        const iconColor = active ? '#257bf4' : '#94a3b8';

        return (
          <Pressable
            key={tab.key}
            onPress={() => navigation.navigate(tab.route)}
            style={({ pressed }) => [
              styles.navItem,
              active && styles.navItemActive,
              pressed && !active && styles.navItemPressed,
            ]}
          >
            {active ? <View style={styles.activeTopLine} /> : null}
            {renderIcon({ iconFamily: tab.iconFamily, iconName: tab.iconName, color: iconColor })}
            <Text
              style={[styles.navText, active && styles.navTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    backgroundColor: '#101823',
    borderTopWidth: 1,
    borderTopColor: 'rgba(37,123,244,0.35)',
    flexDirection: 'row',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingHorizontal: 4,
    gap: 3,
  },
  navItemActive: {
    backgroundColor: 'rgba(37,123,244,0.10)',
  },
  navItemPressed: {
    backgroundColor: '#0b1220',
  },
  activeTopLine: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: '#257bf4',
    shadowColor: '#257bf4',
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  navText: {
    color: '#94a3b8',
    fontSize: TAB_FONT,
    fontFamily: 'PressStart2P',
    textAlign: 'center',
  },
  navTextActive: {
    color: '#257bf4',
  },
});

export default PostLoginBottomNav;
