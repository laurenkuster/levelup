import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { STATUS_ATTRIBUTE_CARDS } from '../config/navigationData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { levelFromTotalXP, levelProgress } from '../utils/xpSystem';
import { loadData, SYNC_DOCS } from '../services/firestoreSync';
import { computeBMR, bmrBurnedSoFar } from '../utils/bmr';
import { loadStrXP } from '../services/strService';
import { loadDexXP } from '../services/dexService';
import { loadSpdXP } from '../services/spdService';
import { loadStmXP } from '../services/stmService';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/typography';
import { useStaggerFadeIn, useFadeIn } from '../hooks/useAnimations';

const SLEEP_MP_KEY = 'levelup_sleep_mp_v1';
const INT_XP_KEY = 'levelup_int_xp_v1';
const FOOD_LOG_KEY = 'levelup_food_log_v1';
const PROFILE_KEY = 'levelup_profile_v1';

const renderStatIcon = ({ family, name }) => {
  if (family === 'community') {
    return <MaterialCommunityIcons name={name} size={18} color={colors.accent} />;
  }

  return <MaterialIcons name={name} size={18} color={colors.accent} />;
};

const StatusScreen = ({ navigation, route }) => {
  const user = route?.params?.user;
  const parentNavigation = navigation.getParent();
  const [mpSummary, setMpSummary] = useState(null);
  const [intXP, setIntXP] = useState({ totalXp: 0, level: 1 });
  const [strXP, setStrXP] = useState({ totalXp: 0 });
  const [dexXP, setDexXP] = useState({ totalXp: 0 });
  const [spdXP, setSpdXP] = useState({ totalXp: 0 });
  const [stmXP, setStmXP] = useState({ totalXp: 0 });
  const [todayCal, setTodayCal] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [todayCarbs, setTodayCarbs] = useState(0);
  const [bodyWeight, setBodyWeight] = useState(0);
  const [dailyBMR, setDailyBMR] = useState(0);
  const [burned, setBurned] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      const [mpData, xpData, foodData, profileData, strData, dexData, spdData, stmData] = await Promise.all([
        loadData(SLEEP_MP_KEY, SYNC_DOCS.SLEEP_SUMMARY),
        loadData(INT_XP_KEY, SYNC_DOCS.INT_XP),
        loadData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS),
        loadData(PROFILE_KEY, SYNC_DOCS.PROFILE),
        loadStrXP(),
        loadDexXP(),
        loadSpdXP(),
        loadStmXP(),
      ]);
      if (!mounted) return;

      if (mpData) setMpSummary(mpData);
      if (xpData) setIntXP(xpData);
      if (strData) setStrXP(strData);
      if (dexData) setDexXP(dexData);
      if (spdData) setSpdXP(spdData);
      if (stmData) setStmXP(stmData);

      // BMR from profile
      const bmr = computeBMR(profileData);
      setDailyBMR(bmr);
      setBurned(bmrBurnedSoFar(bmr));
      if (profileData?.weight) setBodyWeight(Number(profileData.weight));

      // Calculate today's total calories & macros
      if (foodData && Array.isArray(foodData)) {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayLogs = foodData.filter((l) => l.date === todayStr);
        const cal = todayLogs.reduce((sum, l) => sum + (l.calories || 0), 0);
        const prot = todayLogs.reduce((sum, l) => sum + (l.protein || 0), 0);
        const carb = todayLogs.reduce((sum, l) => sum + (l.carbs || 0), 0);
        setTodayCal(cal);
        setTodayProtein(prot);
        setTodayCarbs(carb);
      }
    };

    const unsubscribe = navigation.addListener('focus', loadSummary);
    loadSummary();

    // Update BMR burn every 60s so HP drains in real-time
    const burnTimer = setInterval(() => {
      if (mounted) setBurned(bmrBurnedSoFar(dailyBMR));
    }, 60_000);

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
      clearInterval(burnTimer);
    };
  }, [navigation, dailyBMR]);

  const intLevel = levelFromTotalXP(intXP.totalXp);
  const intProg = Math.round(levelProgress(intXP.totalXp) * 100);

  const strLevel = levelFromTotalXP(strXP.totalXp || 0);
  const strProg = Math.round(levelProgress(strXP.totalXp || 0) * 100);

  const dexLevel = levelFromTotalXP(dexXP.totalXp || 0);
  const dexProg = Math.round(levelProgress(dexXP.totalXp || 0) * 100);

  const spdLevel = levelFromTotalXP(spdXP.totalXp || 0);
  const spdProg = Math.round(levelProgress(spdXP.totalXp || 0) * 100);

  const stmLevel = levelFromTotalXP(stmXP.totalXp || 0);
  const stmProg = Math.round(levelProgress(stmXP.totalXp || 0) * 100);

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

  // ── HP: normalized to a 1-100 scale ──
  // HP% = normalized intake progress, clamped to [1, 100]
  const hpGoal = dailyBMR || 2000; // fallback if profile incomplete
  const hpNet = Math.round(todayCal - burned);
  const hpPercent = hpGoal > 0 ? Math.max(1, Math.min(100, Math.round((todayCal / hpGoal) * 100))) : 1;
  const hpLabel = `${hpPercent} / 100`;

  // ── Dynamic active effects ──
  const effects = [];

  // Sleep-based effects
  if (mpPercent >= 80) {
    effects.push({ type: 'buff', title: 'Well Rested', desc: '+10% All Stats Recovery', icon: 'sleep' });
  } else if (mpPercent >= 50) {
    effects.push({ type: 'buff', title: 'Rested', desc: '+5% Focus & Recovery', icon: 'coffee' });
  } else if (mpPercent < 20) {
    effects.push({ type: 'debuff', title: 'Exhausted', desc: '-15% All Stats Performance', icon: 'sleep' });
  } else if (mpPercent < 40) {
    effects.push({ type: 'debuff', title: 'Sleep Deprived', desc: '-5% Intelligence & Focus', icon: 'sleep' });
  }

  // HP / Nutrition-based effects
  if (hpPercent >= 80) {
    effects.push({ type: 'buff', title: 'Well Fed', desc: '+10% Stamina & Recovery', icon: 'food-apple' });
  } else if (hpPercent < 20 && dailyBMR > 0) {
    effects.push({ type: 'debuff', title: 'Starving', desc: '-20% STR & STM Performance', icon: 'food-off' });
  } else if (hpPercent < 40 && dailyBMR > 0) {
    effects.push({ type: 'debuff', title: 'Hungry', desc: '-10% Physical Stats', icon: 'food-off' });
  }

  // Protein-based effects (g per kg of body weight)
  // ≥ 2.0 g/kg = excellent, ≥ 1.6 g/kg = good, ≥ 0.8 g/kg = adequate, < 0.8 = low
  const proteinPerKg = bodyWeight > 0 ? todayProtein / bodyWeight : 0;
  const proteinGoal = bodyWeight > 0 ? Math.round(bodyWeight * 1.6) : 0;
  if (proteinPerKg >= 2.0) {
    effects.push({ type: 'buff', title: 'Max Protein', desc: `+15% Muscle Recovery (${proteinPerKg.toFixed(1)}g/kg)`, icon: 'food-steak' });
  } else if (proteinPerKg >= 1.6) {
    effects.push({ type: 'buff', title: 'High Protein', desc: `+10% STR Growth (${proteinPerKg.toFixed(1)}g/kg)`, icon: 'food-steak' });
  } else if (proteinPerKg >= 0.8) {
    effects.push({ type: 'buff', title: 'Protein OK', desc: `+5% Recovery (${proteinPerKg.toFixed(1)}g/kg — goal: ${proteinGoal}g)`, icon: 'food-steak' });
  } else if (bodyWeight > 0 && todayProtein > 0) {
    effects.push({ type: 'debuff', title: 'Low Protein', desc: `−5% STR (${proteinPerKg.toFixed(1)}g/kg — need ${proteinGoal}g)`, icon: 'food-steak' });
  }

  // Carb-based effects
  if (todayCarbs >= 200) {
    effects.push({ type: 'buff', title: 'Carb Loaded', desc: '+10% Endurance & SPD', icon: 'lightning-bolt' });
  }

  // INT-based effects
  if (intLevel >= 10) {
    effects.push({ type: 'buff', title: 'Scholar', desc: '+15% XP Gain Rate', icon: 'school' });
  } else if (intLevel >= 5) {
    effects.push({ type: 'buff', title: 'Studious', desc: '+5% Quiz Accuracy', icon: 'book-open-variant' });
  }

  // Recent study streak (if XP gained today)
  const todayXpHistory = (intXP.history || []).filter((h) => {
    if (!h.date) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return h.date === todayStr;
  });
  if (todayXpHistory.length > 0) {
    effects.push({ type: 'buff', title: 'Brain Active', desc: '+5% INT from today\'s study', icon: 'brain' });
  }

  // No effects fallback
  if (effects.length === 0) {
    effects.push({ type: 'neutral', title: 'No Active Effects', desc: 'Eat, sleep, and study to gain buffs!', icon: 'information' });
  }

  const cardAnims = useStaggerFadeIn(STATUS_ATTRIBUTE_CARDS.length, 80);
  const vitalsAnim = useFadeIn(STATUS_ATTRIBUTE_CARDS.length * 80 + 100);
  const effectsAnim = useFadeIn(STATUS_ATTRIBUTE_CARDS.length * 80 + 200);

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
        <Text style={styles.sectionTitle}>ATTRIBUTES</Text>

        <View style={styles.grid}>
          {STATUS_ATTRIBUTE_CARDS.map((card, index) => {
            const isInt = card.key === 'INT';
            const isStr = card.key === 'STR';
            const isDex = card.key === 'DEX';
            const isSpd = card.key === 'SPD';
            const isStm = card.key === 'STM';
            const displayValue = isInt ? intLevel : isStr ? strLevel : isDex ? dexLevel : isSpd ? spdLevel : isStm ? stmLevel : card.value;
            const displayProgress = isInt ? `${intProg}%` : isStr ? `${strProg}%` : isDex ? `${dexProg}%` : isSpd ? `${spdProg}%` : isStm ? `${stmProg}%` : card.progress;
            const displayDelta = isInt
              ? `+${intXP.totalXp} XP (${intProg}%)`
              : isStr
                ? `+${strXP.totalXp || 0} XP (${strProg}%)`
                : isDex
                  ? `+${dexXP.totalXp || 0} XP (${dexProg}%)`
                  : isSpd
                    ? `+${spdXP.totalXp || 0} XP (${spdProg}%)`
                    : isStm
                      ? `+${stmXP.totalXp || 0} XP (${stmProg}%)`
                      : card.delta;

            return (
              <Animated.View key={card.key} style={{ opacity: cardAnims[index]?.opacity, transform: [{ translateY: cardAnims[index]?.translateY }] }}>
                <Pressable
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
              </Animated.View>
            );
          })}
        </View>

        <Animated.View style={{ opacity: vitalsAnim }}>
          <View style={styles.vitalsCard}>
            <Text style={styles.sectionTitle}>VITALS</Text>

            <View style={styles.vitalRow}>
              <Pressable onPress={() => parentNavigation?.navigate('StatHP')} style={{ flex: 1 }}>
                <View style={styles.vitalHeader}><Text style={styles.vitalName}>HP</Text><Text style={styles.vitalValue}>{hpLabel}</Text></View>
                <View style={styles.vitalTrack}><View style={[styles.vitalFill, hpPercent < 30 && { backgroundColor: '#ef4444' }, hpPercent >= 30 && hpPercent < 60 && { backgroundColor: '#f59e0b' }, { width: `${hpPercent}%` }]} /></View>
                <Text style={{ color: colors.textMuted, fontFamily: typography.family.mono, fontSize: 15, marginTop: 2 }}>
                  Intake: {todayCal} / {hpGoal} kcal  |  Net: {hpNet >= 0 ? `+${hpNet}` : hpNet} kcal
                </Text>
              </Pressable>
            </View>

            <View style={styles.vitalRow}>
              <View style={styles.vitalHeader}><Text style={styles.vitalName}>MP</Text><Text style={styles.vitalValue}>{mpLabel}</Text></View>
              <View style={styles.vitalTrack}><View style={[styles.vitalFillAlt, { width: `${mpPercent}%` }]} /></View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: effectsAnim }}>
          <View style={styles.effectsCard}>
            <Text style={styles.sectionTitle}>ACTIVE EFFECTS</Text>
            {effects.map((fx, i) => (
              <View
                key={i}
                style={fx.type === 'buff' ? styles.effectBuff : fx.type === 'debuff' ? styles.effectDebuff : styles.effectNeutral}
              >
                <View style={styles.effectRow}>
                  <MaterialCommunityIcons
                    name={fx.icon}
                    size={16}
                    color={fx.type === 'buff' ? '#0bda5e' : fx.type === 'debuff' ? '#ff4757' : '#94a3b8'}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.effectTitle}>{fx.title}</Text>
                    <Text style={fx.type === 'buff' ? styles.effectDesc : fx.type === 'debuff' ? styles.effectDescRed : styles.effectDescNeutral}>
                      {fx.desc}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.header,
  },
  levelBadge: {
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelText: { color: colors.accent, fontSize: typography.size.sm, fontFamily: typography.family.pixel },
  title: {
    color: colors.accentStrong,
    fontSize: typography.size.lg,
    fontFamily: typography.family.pixel,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textLabel,
    fontSize: typography.size.md,
    fontFamily: typography.family.mono,
    textTransform: 'uppercase',
  },
  content: {
    padding: spacing.base,
    paddingBottom: 100,
    gap: spacing.base,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentOutline,
    padding: spacing.base,
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
    color: colors.textMuted,
    fontSize: typography.size.sm,
    fontFamily: typography.family.pixel,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontFamily: typography.family.mono,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  statDelta: {
    color: '#0bda5e',
    fontSize: typography.size.sm,
    fontFamily: typography.family.mono,
  },
  vitalsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
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
    color: colors.accent,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
  },
  vitalValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: typography.family.mono,
  },
  vitalTrack: {
    height: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: '#334155',
  },
  vitalFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  vitalFillAlt: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  effectsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
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
  effectNeutral: {
    borderLeftWidth: 3,
    borderLeftColor: colors.placeholder,
    backgroundColor: '#64748b1a',
    padding: 10,
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  effectTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontFamily: typography.family.pixel,
    marginBottom: 2,
  },
  effectDesc: {
    color: '#0bda5e',
    fontSize: 15,
    fontFamily: typography.family.mono,
  },
  effectDescRed: {
    color: '#ff4757',
    fontSize: 15,
    fontFamily: typography.family.mono,
  },
  effectDescNeutral: {
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: typography.family.mono,
  },
});

export default StatusScreen;
