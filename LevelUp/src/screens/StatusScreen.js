import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { STATUS_ATTRIBUTE_CARDS } from '../config/navigationData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { levelFromTotalXP, levelProgress } from '../utils/xpSystem';

const SLEEP_MP_KEY = 'levelup_sleep_mp_v1';
const INT_XP_KEY = 'levelup_int_xp_v1';

const renderStatIcon = ({ family, name }) => {
  if (family === 'community') {
    return <MaterialCommunityIcons name={name} size={18} color="#257bf4" />;
  }

  return <MaterialIcons name={name} size={18} color="#257bf4" />;
};

const StatusScreen = ({ navigation, route }) => {
  const user = route?.params?.user;
  const parentNavigation = navigation.getParent();
  const [mpSummary, setMpSummary] = useState(null);
  const [intXP, setIntXP] = useState({ totalXp: 0, level: 1 });

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      const [mpStored, xpStored] = await Promise.all([
        AsyncStorage.getItem(SLEEP_MP_KEY),
        AsyncStorage.getItem(INT_XP_KEY),
      ]);
      if (!mounted) return;

      if (mpStored) {
        try { setMpSummary(JSON.parse(mpStored)); } catch (_) { setMpSummary(null); }
      }
      if (xpStored) {
        try {
          const parsed = JSON.parse(xpStored);
          setIntXP(parsed);
        } catch (_) { /* ignore */ }
      }
    };

    const unsubscribe = navigation.addListener('focus', loadSummary);
    loadSummary();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [navigation]);

  const intLevel = levelFromTotalXP(intXP.totalXp);
  const intProg = Math.round(levelProgress(intXP.totalXp) * 100);

  // ── MP decay: drain linearly over 16 waking hours ──
  const WAKING_HOURS = 16;
  const basePercent = mpSummary?.percent ?? 20;
  let mpPercent = basePercent;
  const anchor = mpSummary?.wakeTime || mpSummary?.updatedAt;
  if (anchor) {
    const hoursSinceWake = (Date.now() - new Date(anchor).getTime()) / 3_600_000;
    if (hoursSinceWake > 0) {
      const drainFraction = Math.min(1, hoursSinceWake / WAKING_HOURS);
      mpPercent = Math.max(0, Math.round(basePercent * (1 - drainFraction)));
    }
  }
  const mpLabel = mpSummary
    ? `${Math.round((mpPercent / 100) * 1400)} / 1400`
    : '280 / 1400';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>STATUS</Text>
          <Text style={styles.subtitle}>SYSTEM ONLINE</Text>
        </View>
        <Pressable onPress={() => parentNavigation?.navigate('Profile', { user })} style={styles.levelBadge}>
          <Text style={styles.levelText}>PROFILE</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ATTRIBUTES</Text>
          <Text style={styles.pointsText}>5 POINTS AVAILABLE</Text>
        </View>

        <View style={styles.grid}>
          {STATUS_ATTRIBUTE_CARDS.map((card) => {
            const isInt = card.key === 'INT';
            const displayValue = isInt ? intLevel : card.value;
            const displayProgress = isInt ? `${intProg}%` : card.progress;
            const displayDelta = isInt
              ? `+${intXP.totalXp} XP (${intProg}%)`
              : card.delta;

            return (
              <Pressable
                key={card.key}
                style={[styles.statCard, card.wide && styles.statCardWide]}
                onPress={() => parentNavigation?.navigate(card.route)}
              >
                <View style={styles.statTopRow}>
                  <Text style={styles.statLabel}>{card.key}</Text>
                  {renderStatIcon({ family: card.iconFamily, name: card.iconName })}
                </View>
                <Text style={styles.statValue}>{displayValue}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: displayProgress }]} />
                </View>
                <Text style={styles.statDelta}>{displayDelta}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.vitalsCard}>
          <Text style={styles.sectionTitle}>VITALS</Text>

          <View style={styles.vitalRow}>
            <View style={styles.vitalHeader}><Text style={styles.vitalName}>HP</Text><Text style={styles.vitalValue}>2400 / 3000</Text></View>
            <View style={styles.vitalTrack}><View style={[styles.vitalFill, { width: '80%' }]} /></View>
          </View>

          <View style={styles.vitalRow}>
            <View style={styles.vitalHeader}><Text style={styles.vitalName}>MP</Text><Text style={styles.vitalValue}>{mpLabel}</Text></View>
            <View style={styles.vitalTrack}><View style={[styles.vitalFillAlt, { width: `${mpPercent}%` }]} /></View>
          </View>
        </View>

        <View style={styles.effectsCard}>
          <Text style={styles.sectionTitle}>ACTIVE EFFECTS</Text>
          <View style={styles.effectBuff}>
            <Text style={styles.effectTitle}>High Protein</Text>
            <Text style={styles.effectDesc}>+10% Muscle Recovery Speed</Text>
          </View>
          <View style={styles.effectDebuff}>
            <Text style={styles.effectTitle}>Sleep Deprived</Text>
            <Text style={styles.effectDescRed}>-5% Intelligence Stats</Text>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37,123,244,0.35)',
    backgroundColor: '#161826',
  },
  levelBadge: {
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.5)',
    backgroundColor: 'rgba(37,123,244,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelText: { color: '#257bf4', fontSize: 10, fontFamily: 'PressStart2P' },
  title: {
    color: '#3B82F6',
    fontSize: 18,
    fontFamily: 'PressStart2P',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#7aaef8',
    fontSize: 12,
    fontFamily: 'VT323',
    textTransform: 'uppercase',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PressStart2P',
  },
  pointsText: {
    color: '#257bf4',
    fontSize: 9,
    fontFamily: 'PressStart2P',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.45)',
    padding: 16,
    gap: 6,
  },
  statCardWide: {
    width: '100%',
  },
  statTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'PressStart2P',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'VT323',
  },
  barTrack: {
    height: 6,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#257bf4',
  },
  statDelta: {
    color: '#0bda5e',
    fontSize: 10,
    fontFamily: 'VT323',
  },
  vitalsCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.25)',
    padding: 14,
    gap: 12,
  },
  vitalRow: {
    gap: 6,
  },
  vitalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vitalName: {
    color: '#257bf4',
    fontSize: 12,
    fontFamily: 'PressStart2P',
  },
  vitalValue: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'VT323',
  },
  vitalTrack: {
    height: 10,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#334155',
  },
  vitalFill: {
    height: '100%',
    backgroundColor: '#257bf4',
  },
  vitalFillAlt: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  effectsCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(37,123,244,0.25)',
    padding: 14,
    gap: 10,
  },
  effectBuff: {
    borderLeftWidth: 3,
    borderLeftColor: '#0bda5e',
    backgroundColor: '#0bda5e1a',
    padding: 10,
  },
  effectDebuff: {
    borderLeftWidth: 3,
    borderLeftColor: '#ff4757',
    backgroundColor: '#ff47571a',
    padding: 10,
  },
  effectTitle: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'PressStart2P',
    marginBottom: 2,
  },
  effectDesc: {
    color: '#0bda5e',
    fontSize: 13,
    fontFamily: 'VT323',
  },
  effectDescRed: {
    color: '#ff4757',
    fontSize: 13,
    fontFamily: 'VT323',
  },
});

export default StatusScreen;
