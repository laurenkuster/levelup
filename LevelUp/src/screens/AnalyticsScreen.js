/**
 * AnalyticsScreen -- Multi-tab analytics dashboard.
 *
 * Internal tabs: ENERGY | INT | STR | DEX | SPD | STM | RECOVERY | TRENDS
 *
 * This file is the thin coordinator; individual views live in ./Analytics/.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { computeDailyMetrics } from '../services/analyticsService';
import { computeIntMetrics } from '../services/intService';
import { computeStrMetrics } from '../services/strAnalyticsService';
import { computeDexMetrics } from '../services/dexAnalyticsService';
import { computeSpdMetrics } from '../services/spdAnalyticsService';
import { computeStmMetrics } from '../services/stmAnalyticsService';
import { computeCrossStatAnalysis } from '../services/crossStatEngine';
import { colors } from '../theme/colors';
import s from './Analytics/analyticsStyles';

import EnergyView from './Analytics/EnergyView';
import IntView from './Analytics/IntView';
import StrView from './Analytics/StrView';
import DexView from './Analytics/DexView';
import SpdView from './Analytics/SpdView';
import StmView from './Analytics/StmView';
import RecoveryView from './Analytics/RecoveryView';
import TrendsView from './Analytics/TrendsView';

const TABS = ['ENERGY', 'INT', 'STR', 'DEX', 'SPD', 'STM', 'RECOVERY', 'TRENDS'];

const TabSwitcher = ({ active, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
    {TABS.map((t) => (
      <Pressable key={t} onPress={() => onChange(t)}
        style={[s.tab, active === t && s.tabActive]}>
        <Text style={[s.tabText, active === t && s.tabTextActive]}>{t}</Text>
      </Pressable>
    ))}
  </ScrollView>
);

/** Map each tab to its fetcher function. */
const TAB_FETCHERS = {
  ENERGY: computeDailyMetrics,
  INT: computeIntMetrics,
  STR: computeStrMetrics,
  DEX: computeDexMetrics,
  SPD: computeSpdMetrics,
  STM: computeStmMetrics,
  RECOVERY: computeCrossStatAnalysis,
};

const AnalyticsScreen = ({ navigation }) => {
  const [tab, setTab] = useState('ENERGY');
  const [tabLoading, setTabLoading] = useState(true);
  const cache = useRef({});
  const mountedRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      cache.current = {};
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
    }, [])
  );

  useEffect(() => {
    let cancelled = false;

    const loadTab = async () => {
      if (tab === 'TRENDS') {
        const needed = ['ENERGY', 'INT', 'STR', 'DEX', 'SPD', 'STM'].filter((k) => !cache.current[k]);
        if (needed.length > 0) {
          setTabLoading(true);
          try {
            const results = await Promise.all(needed.map((k) => TAB_FETCHERS[k]().catch(() => null)));
            if (cancelled) return;
            needed.forEach((k, i) => { cache.current[k] = results[i]; });
          } catch { /* ignore */ }
        }
        if (!cancelled) setTabLoading(false);
        return;
      }

      if (cache.current[tab]) { setTabLoading(false); return; }

      const fetcher = TAB_FETCHERS[tab];
      if (!fetcher) { setTabLoading(false); return; }

      setTabLoading(true);
      try {
        const data = await fetcher();
        if (!cancelled) { cache.current[tab] = data; }
      } catch { /* ignore */ }
      finally { if (!cancelled) setTabLoading(false); }
    };

    loadTab();
    return () => { cancelled = true; };
  }, [tab]);

  const d = cache.current;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>ANALYTICS</Text>
      </View>
      <TabSwitcher active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {tabLoading ? (
          <View style={[s.panel, s.centerPanel]}>
            <ActivityIndicator color={colors.accentStrong} />
            <Text style={s.loadingText}>Loading {tab.toLowerCase()}...</Text>
          </View>
        ) : tab === 'ENERGY' ? (
          <EnergyView energy={d.ENERGY} navigation={navigation} />
        ) : tab === 'INT' ? (
          <IntView data={d.INT} navigation={navigation} />
        ) : tab === 'STR' ? (
          <StrView data={d.STR} navigation={navigation} />
        ) : tab === 'DEX' ? (
          <DexView data={d.DEX} navigation={navigation} />
        ) : tab === 'SPD' ? (
          <SpdView data={d.SPD} navigation={navigation} />
        ) : tab === 'STM' ? (
          <StmView data={d.STM} navigation={navigation} />
        ) : tab === 'RECOVERY' ? (
          <RecoveryView data={d.RECOVERY} />
        ) : (
          <TrendsView energy={d.ENERGY} intData={d.INT} strData={d.STR} dexData={d.DEX} spdData={d.SPD} stmData={d.STM} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AnalyticsScreen;
