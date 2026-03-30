/**
 * AnalyticsScreen -- Multi-tab analytics dashboard with swipeable pages.
 *
 * Internal tabs: ENERGY | INT | STR | DEX | SPD | STM | RECOVERY | TRENDS
 *
 * This file is the thin coordinator; individual views live in ./Analytics/.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import { computeDailyMetrics } from '../services/analyticsService';
import { computeIntMetrics } from '../services/intService';
import { computeStrMetrics } from '../services/strAnalyticsService';
import { computeDexMetrics } from '../services/dexAnalyticsService';
import { computeSpdMetrics } from '../services/spdAnalyticsService';
import { computeStmMetrics } from '../services/stmAnalyticsService';
import { computeCrossStatAnalysis } from '../services/crossStatEngine';
import { colors } from '../theme/colors';
import { trackAnalyticsTabViewed } from '../services/trackingService';
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

const TabSwitcher = ({ active, onChange, scrollRef }) => (
  <ScrollView
    ref={scrollRef}
    horizontal
    showsHorizontalScrollIndicator={false}
    style={s.tabBar}
    contentContainerStyle={s.tabBarContent}
  >
    {TABS.map((t, i) => (
      <Pressable
        key={t}
        onPress={() => onChange(i)}
        style={[s.tab, active === i && s.tabActive]}
      >
        <Text style={[s.tabText, active === i && s.tabTextActive]}>{t}</Text>
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
  const [tabIndex, setTabIndex] = useState(0);
  const [loadingTabs, setLoadingTabs] = useState({});
  const cache = useRef({});
  const mountedRef = useRef(true);
  const pagerRef = useRef(null);
  const tabScrollRef = useRef(null);

  const tab = TABS[tabIndex];

  useFocusEffect(
    useCallback(() => {
      cache.current = {};
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
    }, [])
  );

  // Load data for a specific tab
  const loadTabData = useCallback(async (tabName) => {
    if (cache.current[tabName]) return;

    if (tabName === 'TRENDS') {
      const needed = ['ENERGY', 'INT', 'STR', 'DEX', 'SPD', 'STM'].filter((k) => !cache.current[k]);
      if (needed.length > 0) {
        setLoadingTabs((prev) => ({ ...prev, TRENDS: true }));
        try {
          const results = await Promise.all(needed.map((k) => TAB_FETCHERS[k]().catch(() => null)));
          if (!mountedRef.current) return;
          needed.forEach((k, i) => { cache.current[k] = results[i]; });
        } catch { /* ignore */ }
      }
      if (mountedRef.current) setLoadingTabs((prev) => ({ ...prev, TRENDS: false }));
      return;
    }

    const fetcher = TAB_FETCHERS[tabName];
    if (!fetcher) return;

    setLoadingTabs((prev) => ({ ...prev, [tabName]: true }));
    try {
      const data = await fetcher();
      if (mountedRef.current) cache.current[tabName] = data;
    } catch { /* ignore */ }
    finally { if (mountedRef.current) setLoadingTabs((prev) => ({ ...prev, [tabName]: false })); }
  }, []);

  // Load current tab data when tab changes
  useEffect(() => {
    loadTabData(tab);
    trackAnalyticsTabViewed(tab);
  }, [tab, loadTabData]);

  const onPageSelected = useCallback((e) => {
    const pos = e.nativeEvent.position;
    setTabIndex(pos);
    // Auto-scroll the tab bar to keep active tab visible
    if (tabScrollRef.current) {
      // Approximate: each tab is about 80px wide
      tabScrollRef.current.scrollTo({ x: Math.max(0, pos * 80 - 120), animated: true });
    }
  }, []);

  const handleTabPress = useCallback((idx) => {
    setTabIndex(idx);
    pagerRef.current?.setPage(idx);
  }, []);

  const d = cache.current;

  const renderTabContent = (tabName) => {
    const isLoading = loadingTabs[tabName] && !cache.current[tabName];
    if (isLoading) {
      return (
        <View style={[s.panel, s.centerPanel]}>
          <ActivityIndicator color={colors.accentStrong} />
          <Text style={s.loadingText}>Loading {tabName.toLowerCase()}...</Text>
        </View>
      );
    }

    switch (tabName) {
      case 'ENERGY': return <EnergyView energy={d.ENERGY} navigation={navigation} />;
      case 'INT': return <IntView data={d.INT} navigation={navigation} />;
      case 'STR': return <StrView data={d.STR} navigation={navigation} />;
      case 'DEX': return <DexView data={d.DEX} navigation={navigation} />;
      case 'SPD': return <SpdView data={d.SPD} navigation={navigation} />;
      case 'STM': return <StmView data={d.STM} navigation={navigation} />;
      case 'RECOVERY': return <RecoveryView data={d.RECOVERY} />;
      case 'TRENDS': return <TrendsView energy={d.ENERGY} intData={d.INT} strData={d.STR} dexData={d.DEX} spdData={d.SPD} stmData={d.STM} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>ANALYTICS</Text>
      </View>
      <TabSwitcher active={tabIndex} onChange={handleTabPress} scrollRef={tabScrollRef} />

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={onPageSelected}
        overdrag
        offscreenPageLimit={1}
      >
        {TABS.map((tabName) => (
          <ScrollView
            key={tabName}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {renderTabContent(tabName)}
          </ScrollView>
        ))}
      </PagerView>
    </SafeAreaView>
  );
};

export default AnalyticsScreen;
