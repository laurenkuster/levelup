import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { POST_LOGIN_TABS } from '../config/navigationData';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';

const renderIcon = ({ iconFamily, iconName, color }) => {
  if (iconFamily === 'community') {
    return <MaterialCommunityIcons name={iconName} size={22} color={color} />;
  }

  return <MaterialIcons name={iconName} size={22} color={color} />;
};

const PostLoginBottomNav = ({ navigation, activeTab }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {POST_LOGIN_TABS.map((tab) => {
        const active = tab.key === activeTab;
        const iconColor = active ? colors.accent : colors.textMuted;

        return (
          <Pressable
            key={tab.key}
            onPress={() => navigation.navigate(tab.route)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
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
    backgroundColor: colors.composerBg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingTop: 10,
    paddingHorizontal: spacing.xs,
    gap: 3,
  },
  navItemActive: {
    backgroundColor: colors.accentSoft,
  },
  navItemPressed: {
    backgroundColor: '#0b1220',
  },
  activeTopLine: {
    position: 'absolute',
    top: 0,
    left: spacing.sm,
    right: spacing.sm,
    height: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  navText: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontFamily: typography.family.pixel,
    textAlign: 'center',
  },
  navTextActive: {
    color: colors.accent,
  },
});

export default PostLoginBottomNav;
