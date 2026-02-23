/**
 * AnalyticsScreen — Multi-tab analytics dashboard.
 *
 * Internal tabs: ENERGY | INT | TRENDS
 *
 * Energy:  ML-powered energy prediction + 24h curve + recommendations
 * INT:     Quiz performance scoring + trend charts
 * Trends:  Combined Energy + INT overview
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Rect, Line, Text as SvgText, Circle } from 'react-native-svg';
import { computeDailyMetrics } from '../services/analyticsService';
import { computeIntMetrics } from '../services/intService';

const SW = Dimensions.get('window').width;
const CHART_W = 960;
const CH = 180;
const CP = { top: 10, right: 16, bottom: 30, left: 36 };

/* ═══════════════════════════════════════════════════
   TAB SWITCHER
   ═══════════════════════════════════════════════════ */

const TABS = ['ENERGY', 'INT', 'TRENDS'];

const TabSwitcher = ({ active, onChange }) => (
  <View style={s.tabBar}>
    {TABS.map((t) => (
      <Pressable key={t} onPress={() => onChange(t)}
        style={[s.tab, active === t && s.tabActive]}>
        <Text style={[s.tabText, active === t && s.tabTextActive]}>{t}</Text>
      </Pressable>
    ))}
  </View>
);

/* ═══════════════════════════════════════════════════
   ENERGY GRAPH (SVG)
   ═══════════════════════════════════════════════════ */

const EnergyGraph = ({ curve, recommendations, currentMinute }) => {
  if (!curve || curve.length === 0) return null;
  const pW = CHART_W - CP.left - CP.right;
  const pH = CH - CP.top - CP.bottom;
  const pts = curve.map((p, i) => {
    const x = CP.left + (i / (curve.length - 1)) * pW;
    const y = CP.top + pH - (p.energy / 100) * pH;
    return `${x},${y}`;
  }).join(' ');

  const zones = [];
  if (recommendations?.sleep?.startMinute != null) {
    const si = curve.findIndex((p) => p.minute >= recommendations.sleep.startMinute);
    if (si >= 0) {
      const sx = CP.left + (si / (curve.length - 1)) * pW;
      zones.push(<Rect key="slp" x={sx} y={CP.top} width={Math.max(pW-(sx-CP.left),40)} height={pH} fill="rgba(99,102,241,0.12)" />);
    }
  }
  if (recommendations?.deepStudy) {
    recommendations.deepStudy.forEach((w, i) => {
      const si = curve.findIndex((p) => p.minute >= w.startMinute);
      const ei = curve.findIndex((p) => p.minute >= w.endMinute);
      if (si >= 0 && ei >= 0) {
        const sx = CP.left + (si / (curve.length - 1)) * pW;
        const ex = CP.left + (ei / (curve.length - 1)) * pW;
        zones.push(<Rect key={`ds${i}`} x={sx} y={CP.top} width={Math.max(ex-sx,4)} height={pH} fill="rgba(34,197,94,0.10)" />);
      }
    });
  }
  if (recommendations?.workout?.startMinute != null) {
    const si = curve.findIndex((p) => p.minute >= recommendations.workout.startMinute);
    const ei = curve.findIndex((p) => p.minute >= recommendations.workout.endMinute);
    if (si >= 0 && ei >= 0) {
      const sx = CP.left + (si / (curve.length - 1)) * pW;
      const ex = CP.left + (ei / (curve.length - 1)) * pW;
      zones.push(<Rect key="wk" x={sx} y={CP.top} width={Math.max(ex-sx,4)} height={pH} fill="rgba(251,146,60,0.10)" />);
    }
  }

  const xLabels = [];
  for (let i = 0; i < curve.length; i += 12) {
    const x = CP.left + (i / (curve.length - 1)) * pW;
    const h = Math.floor(curve[i].minute / 60);
    const lbl = h === 0 ? '12A' : h === 12 ? '12P' : h < 12 ? `${h}A` : `${h-12}P`;
    xLabels.push(<SvgText key={`x${i}`} x={x} y={CH-4} fill="#64748b" fontSize={9} fontFamily="monospace" textAnchor="middle">{lbl}</SvgText>);
  }

  const yLabels = [0,25,50,75,100].map((v) => {
    const y = CP.top + pH - (v / 100) * pH;
    return (<React.Fragment key={`y${v}`}>
      <SvgText x={CP.left-6} y={y+3} fill="#475569" fontSize={9} fontFamily="monospace" textAnchor="end">{v}</SvgText>
      <Line x1={CP.left} y1={y} x2={CHART_W-CP.right} y2={y} stroke="rgba(71,85,105,0.2)" strokeWidth={0.5} />
    </React.Fragment>);
  });

  const mealMarkers = [];
  if (recommendations?.meals) {
    (Array.isArray(recommendations.meals) ? recommendations.meals : []).forEach((ml, i) => {
      const mi = curve.findIndex((p) => p.minute >= ml.minute);
      if (mi >= 0) {
        const x = CP.left + (mi / (curve.length - 1)) * pW;
        mealMarkers.push(<Line key={`m${i}`} x1={x} y1={CP.top} x2={x} y2={CP.top+pH} stroke="rgba(251,191,36,0.5)" strokeWidth={1} strokeDasharray="4,3" />);
      }
    });
  }

  let nowLine = null;
  if (currentMinute != null) {
    const ni = curve.findIndex((p) => p.minute >= currentMinute);
    if (ni >= 0) {
      const nx = CP.left + (ni / (curve.length - 1)) * pW;
      nowLine = (<>
        <Line x1={nx} y1={CP.top-2} x2={nx} y2={CP.top+pH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,3" />
        <SvgText x={nx} y={CP.top-4} fill="#ef4444" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">NOW</SvgText>
      </>);
    }
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chartScroll}>
      <Svg width={CHART_W} height={CH}>
        <Rect x={CP.left} y={CP.top} width={pW} height={pH} fill="rgba(15,23,42,0.6)" rx={2} />
        {zones}
        {yLabels}
        {mealMarkers}
        <Polyline points={pts} fill="none" stroke="#3B82F6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xLabels}
        {nowLine}
      </Svg>
    </ScrollView>
  );
};

/* ═══════════════════════════════════════════════════
   MINI LINE CHART (for INT + Trends)
   ═══════════════════════════════════════════════════ */

const MiniLineChart = ({ data, color = '#3B82F6', maxVal = 100, height = 120, label = '' }) => {
  if (!data || data.length === 0) return null;
  const w = SW - 64;
  const pad = { top: 16, right: 8, bottom: 24, left: 32 };
  const pW = w - pad.left - pad.right;
  const pH = height - pad.top - pad.bottom;

  const pts = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * pW;
    const y = pad.top + pH - (d.value / maxVal) * pH;
    return { x, y, ...d };
  });

  const polyStr = pts.map((p) => `${p.x},${p.y}`).join(' ');

  // Show every other label to avoid overlap
  const step = data.length > 7 ? 2 : 1;

  return (
    <View>
      {label ? <Text style={s.miniChartLabel}>{label}</Text> : null}
      <Svg width={w} height={height}>
        {/* Grid */}
        {[0, 25, 50, 75, 100].filter((v) => v <= maxVal).map((v) => {
          const y = pad.top + pH - (v / maxVal) * pH;
          return (<React.Fragment key={v}>
            <Line x1={pad.left} y1={y} x2={w-pad.right} y2={y} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} />
            <SvgText x={pad.left-4} y={y+3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{v}</SvgText>
          </React.Fragment>);
        })}
        {/* Line */}
        <Polyline points={polyStr} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {/* Dots + labels */}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={3} fill={color} />
            {i % step === 0 && <SvgText x={p.x} y={height-4} fill="#64748b" fontSize={7} fontFamily="monospace" textAnchor="middle">
              {p.label || ''}
            </SvgText>}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

const scoreColor = (s) => s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : s >= 25 ? '#f97316' : '#ef4444';
const scoreLabel = (s) => s >= 80 ? 'EXCELLENT' : s >= 60 ? 'GOOD' : s >= 40 ? 'MODERATE' : 'LOW';
const CONF_COLORS = { LOW: '#f97316', MEDIUM: '#f59e0b', HIGH: '#22c55e' };

const Badge = ({ confidence, method }) => (
  <View style={s.badgeRow}>
    <View style={[s.badge, { borderColor: CONF_COLORS[confidence] || '#64748b' }]}>
      <Text style={[s.badgeText, { color: CONF_COLORS[confidence] || '#64748b' }]}>{confidence}</Text>
    </View>
    <Text style={s.methodText}>{method?.toUpperCase()}</Text>
  </View>
);

const RecCard = ({ icon, iconFamily, label, time, color }) => (
  <View style={[s.recCard, { borderColor: color + '40' }]}>
    {iconFamily === 'community'
      ? <MaterialCommunityIcons name={icon} size={20} color={color} />
      : <MaterialIcons name={icon} size={20} color={color} />}
    <Text style={[s.recLabel, { color }]}>{label}</Text>
    <Text style={s.recTime}>{time}</Text>
  </View>
);

const Leg = ({ color, label }) => (
  <View style={s.legItem}><View style={[s.legDot, { backgroundColor: color }]} /><Text style={s.legText}>{label}</Text></View>
);

const getRecTime = (r) => r?.start && r?.end ? `${r.start}–${r.end}` : '';

/* ═══════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════ */

const AnalyticsScreen = ({ navigation }) => {
  const [tab, setTab] = useState('ENERGY');
  const [energy, setEnergy] = useState(null);
  const [intData, setIntData] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let m = true;
      const load = async () => {
        setLoading(true);
        try {
          const [e, i] = await Promise.all([computeDailyMetrics(), computeIntMetrics()]);
          if (m) { setEnergy(e); setIntData(i); }
        } catch { /* ignore */ }
        finally { if (m) setLoading(false); }
      };
      load();
      return () => { m = false; };
    }, [])
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>ANALYTICS</Text>
      </View>
      <TabSwitcher active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={[s.panel, s.centerPanel]}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={s.loadingText}>Loading analytics...</Text>
          </View>
        ) : tab === 'ENERGY' ? (
          <EnergyView energy={energy} navigation={navigation} />
        ) : tab === 'INT' ? (
          <IntView data={intData} navigation={navigation} />
        ) : (
          <TrendsView energy={energy} intData={intData} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* ═══════════════════════════════════════════════════
   ENERGY VIEW
   ═══════════════════════════════════════════════════ */

const EnergyView = ({ energy: m, navigation }) => {
  if (!m) return null;

  if (m.gating === 'incomplete_profile') return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="person-outline" size={40} color="#f97316" />
      <Text style={s.noTitle}>PROFILE INCOMPLETE</Text>
      <Text style={s.noText}>{m.message}</Text>
      <Pressable onPress={() => navigation.navigate('Profile')} style={s.cta}><Text style={s.ctaT}>SET UP PROFILE</Text></Pressable>
    </View>
  );
  if (m.gating === 'no_sleep_data') return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="bedtime" size={40} color="#7aaef8" />
      <Text style={s.noTitle}>NO SLEEP DATA</Text>
      <Text style={s.noText}>{m.message}</Text>
      <Pressable onPress={() => navigation.navigate('LogSleepEntry')} style={s.cta}><Text style={s.ctaT}>LOG SLEEP</Text></Pressable>
    </View>
  );
  if (!m.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="bedtime" size={40} color="#7aaef8" />
      <Text style={s.noTitle}>NO DATA</Text>
      <Text style={s.noText}>Set up your profile and log sleep to get started.</Text>
    </View>
  );

  return (<>
    {/* Energy Card */}
    <View style={[s.panel, s.energyCard]}>
      <View style={s.row}><Text style={s.sect}>TODAY'S ENERGY</Text><Badge confidence={m.confidence} method={m.method} /></View>
      <View style={s.scoreRow}>
        <Text style={[s.bigScore, { color: scoreColor(m.energyScore) }]}>{m.energyScore}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.energyLabel, { color: scoreColor(m.energyScore) }]}>{scoreLabel(m.energyScore)}</Text>
          <Text style={s.desc}>Based on BMR + last night's sleep</Text>
          {m.historyDays != null && <Text style={s.desc}>{m.historyDays} day{m.historyDays !== 1 ? 's' : ''} of data</Text>}
        </View>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${m.energyScore}%`, backgroundColor: scoreColor(m.energyScore) }]} /></View>
    </View>

    {/* Recovery */}
    <View style={s.panel}>
      <Text style={s.sect}>RECOVERY BREAKDOWN</Text>
      <View style={s.statsRow}>
        {[
          { v: m.features?.recovery_ratio != null ? `${Math.round(m.features.recovery_ratio*100)}%` : '—', l: 'RECOVERY' },
          { v: `${m.features?.last_night_hours || '—'}h`, l: 'LAST NIGHT' },
          { v: `${m.features?.required_hours || '—'}h`, l: 'NEEDED' },
          { v: `${m.features?.bmr || '—'}`, l: 'BMR' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
    </View>

    {/* Chart */}
    <View style={s.panel}>
      <Text style={s.sect}>24H ENERGY CURVE</Text>
      <Text style={s.hint}>← Scroll horizontally →</Text>
      <EnergyGraph curve={m.energyCurve} recommendations={m.recommendations} currentMinute={m.currentMinute} />
      <View style={s.legRow}>
        <Leg color="#3B82F6" label="Energy" /><Leg color="#ef4444" label="Now" />
        <Leg color="rgba(34,197,94,0.5)" label="Deep Study" /><Leg color="rgba(251,146,60,0.5)" label="Workout" />
        <Leg color="rgba(251,191,36,0.7)" label="Meals" /><Leg color="rgba(99,102,241,0.5)" label="Sleep" />
      </View>
    </View>

    {/* Recommendations */}
    {m.recommendations && (
      <View style={s.panel}>
        <Text style={s.sect}>RECOMMENDED SCHEDULE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
          {(m.recommendations.deepStudy||[]).slice(0,2).map((w,i) => <RecCard key={`d${i}`} icon="psychology" iconFamily="material" label="DEEP STUDY" time={getRecTime(w)} color="#22c55e" />)}
          {(m.recommendations.lightStudy||[]).slice(0,1).map((w,i) => <RecCard key={`l${i}`} icon="menu-book" iconFamily="material" label="LIGHT STUDY" time={getRecTime(w)} color="#38bdf8" />)}
          {m.recommendations.workout && <RecCard icon="fitness-center" iconFamily="material" label="WORKOUT" time={getRecTime(m.recommendations.workout)} color="#f97316" />}
          {(m.recommendations.meals||[]).map((ml,i) => <RecCard key={`ml${i}`} icon="restaurant" iconFamily="material" label={(ml.label||'MEAL').toUpperCase()} time={ml.t||''} color="#fbbf24" />)}
          {m.recommendations.sleep && <RecCard icon="bedtime" iconFamily="material" label="SLEEP" time={getRecTime(m.recommendations.sleep)} color="#818cf8" />}
        </ScrollView>
      </View>
    )}

    {/* Insights */}
    {m.insights?.length > 0 && (
      <View style={[s.panel, s.insightP]}>
        <View style={s.insightH}><MaterialIcons name="auto-awesome" size={18} color="#fbbf24" /><Text style={s.sect}>INSIGHTS</Text></View>
        {m.insights.map((t,i) => <Text key={i} style={s.insightT}>• {t}</Text>)}
      </View>
    )}
  </>);
};

/* ═══════════════════════════════════════════════════
   INT VIEW
   ═══════════════════════════════════════════════════ */

const IntView = ({ data, navigation }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="psychology" size={40} color="#818cf8" />
      <Text style={s.noTitle}>NO QUIZ DATA</Text>
      <Text style={s.noText}>Take a quiz to start tracking your cognitive performance.</Text>
      <Pressable onPress={() => navigation.navigate('LogIntEntry')} style={[s.cta, { backgroundColor: '#6366f1' }]}>
        <Text style={s.ctaT}>START STUDYING</Text>
      </Pressable>
    </View>
  );

  const trend = data.trend || [];
  const accData = trend.map((d) => ({ value: d.avgAccuracy, label: d.date.slice(5) }));
  const scoreData = trend.map((d) => ({ value: d.intScore, label: d.date.slice(5) }));
  const fc = data.forecast;

  return (<>
    {/* INT Score Card */}
    <View style={[s.panel, { borderColor: 'rgba(99,102,241,0.5)' }]}>
      <View style={s.row}><Text style={s.sect}>INT SCORE</Text>
        <View style={[s.badge, { borderColor: '#818cf8' }]}><Text style={[s.badgeText, { color: '#818cf8' }]}>QUIZ</Text></View>
      </View>
      <View style={s.scoreRow}>
        <Text style={[s.bigScore, { color: scoreColor(data.todayScore) }]}>{data.todayScore}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.energyLabel, { color: scoreColor(data.todayScore) }]}>{scoreLabel(data.todayScore)}</Text>
          <Text style={s.desc}>{data.todayAttempts} quiz{data.todayAttempts !== 1 ? 'zes' : ''} today</Text>
          <Text style={s.desc}>{data.totalQuizzes} total · {data.streak} day streak 🔥</Text>
        </View>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${data.todayScore}%`, backgroundColor: scoreColor(data.todayScore) }]} /></View>
    </View>

    {/* ── 7-DAY LEVEL FORECAST ── */}
    {fc && (
      <View style={[s.panel, { borderColor: 'rgba(168,85,247,0.5)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>7-DAY FORECAST</Text>
          <View style={[s.badge, { borderColor: '#a855f7' }]}>
            <Text style={[s.badgeText, { color: '#a855f7' }]}>ML</Text>
          </View>
        </View>

        {/* Current → Projected */}
        <View style={s.forecastRow}>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>NOW</Text>
            <Text style={[s.forecastLevel, { color: '#818cf8' }]}>LV {fc.currentLevel}</Text>
            <Text style={s.forecastRank}>{fc.currentRank}</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="trending-flat" size={28} color={
              fc.levelsGained > 0 ? '#22c55e' : fc.accTrend === 'declining' ? '#ef4444' : '#64748b'
            } />
            {fc.levelsGained > 0 && <Text style={s.forecastGain}>+{fc.levelsGained}</Text>}
          </View>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>IN 7 DAYS</Text>
            <Text style={[s.forecastLevel, { color: fc.levelsGained > 0 ? '#22c55e' : '#818cf8' }]}>
              LV {fc.projectedLevel}
            </Text>
            <Text style={s.forecastRank}>{fc.projectedRank}</Text>
          </View>
        </View>

        {/* XP Progress */}
        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.desc}>XP: {fc.xpInCurrentLevel} / {fc.xpToNextLevel}</Text>
            <Text style={s.desc}>{fc.avgXpPerDay} XP/day avg</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, (fc.xpInCurrentLevel / fc.xpToNextLevel) * 100)}%`, backgroundColor: '#a855f7' }]} />
          </View>
        </View>

        {/* Accuracy Trend */}
        <View style={[s.trendBadge, {
          borderColor: fc.accTrend === 'improving' ? '#22c55e40' : fc.accTrend === 'declining' ? '#ef444440' : '#64748b40',
          backgroundColor: fc.accTrend === 'improving' ? '#22c55e10' : fc.accTrend === 'declining' ? '#ef444410' : '#64748b10',
        }]}>
          <MaterialIcons name={
            fc.accTrend === 'improving' ? 'trending-up' : fc.accTrend === 'declining' ? 'trending-down' : 'trending-flat'
          } size={16} color={
            fc.accTrend === 'improving' ? '#22c55e' : fc.accTrend === 'declining' ? '#ef4444' : '#64748b'
          } />
          <Text style={[s.desc, { color: fc.accTrend === 'improving' ? '#22c55e' : fc.accTrend === 'declining' ? '#ef4444' : '#94a3b8' }]}>
            Accuracy {fc.accTrend}
          </Text>
        </View>

        {/* Forecast Graph */}
        {fc.projected?.length > 0 && (() => {
          const maxXp = Math.max(...fc.projected.map((p) => p.projectedXp), fc.totalXp);
          const minXp = fc.totalXp;
          const range = maxXp - minXp || 1;
          const fW = SW - 64;
          const fPad = { top: 20, right: 8, bottom: 24, left: 40 };
          const fpW = fW - fPad.left - fPad.right;
          const fpH = 100 - fPad.top - fPad.bottom;

          const pts = fc.projected.map((p, i) => {
            const x = fPad.left + (i / Math.max(fc.projected.length - 1, 1)) * fpW;
            const y = fPad.top + fpH - ((p.projectedXp - minXp) / range) * fpH;
            return { x, y, ...p };
          });
          const polyStr = pts.map((p) => `${p.x},${p.y}`).join(' ');

          return (
            <View style={{ marginTop: 4 }}>
              <Text style={s.miniChartLabel}>PROJECTED XP (7 DAYS)</Text>
              <Svg width={fW} height={100}>
                {/* Today baseline */}
                <Line x1={fPad.left} y1={fPad.top + fpH} x2={fW - fPad.right} y2={fPad.top + fpH} stroke="rgba(71,85,105,0.3)" strokeWidth={0.5} strokeDasharray="4,3" />
                <SvgText x={fPad.left - 4} y={fPad.top + fpH + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{minXp}</SvgText>
                <SvgText x={fPad.left - 4} y={fPad.top + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{maxXp}</SvgText>
                {/* Line */}
                <Polyline points={polyStr} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" />
                {/* Dots + labels */}
                {pts.map((p, i) => (
                  <React.Fragment key={i}>
                    <Circle cx={p.x} cy={p.y} r={3.5} fill="#a855f7" />
                    <SvgText x={p.x} y={100 - 4} fill="#64748b" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.dateLabel}</SvgText>
                    {p.level > (i > 0 ? pts[i-1].level : fc.currentLevel) && (
                      <SvgText x={p.x} y={p.y - 8} fill="#22c55e" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">LV{p.level}</SvgText>
                    )}
                  </React.Fragment>
                ))}
              </Svg>
            </View>
          );
        })()}

        {/* Nudges */}
        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>• {n}</Text>)}
          </View>
        )}
      </View>
    )}

    {/* Stats Row */}
    <View style={s.panel}>
      <Text style={s.sect}>PERFORMANCE</Text>
      <View style={s.statsRow}>
        {[
          { v: `${data.todayAccuracy}%`, l: 'ACCURACY' },
          { v: `${data.totalQuizzes}`, l: 'QUIZZES' },
          { v: `${data.streak}`, l: 'STREAK' },
          { v: `${data.overallAccuracy}%`, l: 'OVERALL' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
    </View>

    {/* INT Score Trend */}
    <View style={s.panel}>
      <MiniLineChart data={scoreData} color="#818cf8" label="INT SCORE TREND (14 DAYS)" />
    </View>

    {/* Accuracy Trend */}
    <View style={s.panel}>
      <MiniLineChart data={accData} color="#22c55e" label="ACCURACY TREND (14 DAYS)" />
    </View>
  </>);
};

/* ═══════════════════════════════════════════════════
   TRENDS VIEW
   ═══════════════════════════════════════════════════ */

const TrendsView = ({ energy, intData }) => {
  const hasEnergy = energy?.hasData;
  const hasInt = intData?.hasData;

  if (!hasEnergy && !hasInt) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="trending-up" size={40} color="#64748b" />
      <Text style={s.noTitle}>NO TREND DATA</Text>
      <Text style={s.noText}>Log sleep and take quizzes to see your trends.</Text>
    </View>
  );

  // Build combined 7-day view
  const intTrend = intData?.trend || [];
  const last7Int = intTrend.slice(-7);
  const scoreData = last7Int.map((d) => ({ value: d.intScore, label: d.date.slice(5) }));

  return (<>
    {/* Energy Summary */}
    {hasEnergy && (
      <View style={s.panel}>
        <Text style={s.sect}>ENERGY TODAY</Text>
        <View style={s.trendRow}>
          <View style={[s.trendCircle, { borderColor: scoreColor(energy.energyScore) }]}>
            <Text style={[s.trendVal, { color: scoreColor(energy.energyScore) }]}>{energy.energyScore}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.energyLabel, { color: scoreColor(energy.energyScore) }]}>{scoreLabel(energy.energyScore)}</Text>
            <Text style={s.desc}>Method: {energy.method?.toUpperCase()} · {energy.confidence}</Text>
            {energy.features?.last_night_hours && <Text style={s.desc}>Last night: {energy.features.last_night_hours}h sleep</Text>}
          </View>
        </View>
      </View>
    )}

    {/* INT Summary */}
    {hasInt && (
      <View style={s.panel}>
        <Text style={s.sect}>INT TODAY</Text>
        <View style={s.trendRow}>
          <View style={[s.trendCircle, { borderColor: scoreColor(intData.todayScore) }]}>
            <Text style={[s.trendVal, { color: scoreColor(intData.todayScore) }]}>{intData.todayScore}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.energyLabel, { color: scoreColor(intData.todayScore) }]}>{scoreLabel(intData.todayScore)}</Text>
            <Text style={s.desc}>Accuracy: {intData.overallAccuracy}% · {intData.streak} day streak</Text>
            <Text style={s.desc}>{intData.totalQuizzes} quizzes completed</Text>
          </View>
        </View>
      </View>
    )}

    {/* Combined Chart */}
    {hasInt && scoreData.length > 0 && (
      <View style={s.panel}>
        <MiniLineChart data={scoreData} color="#818cf8" label="INT SCORE (7 DAYS)" />
      </View>
    )}

    {/* Insight */}
    <View style={[s.panel, s.insightP]}>
      <View style={s.insightH}><MaterialIcons name="auto-awesome" size={18} color="#fbbf24" /><Text style={s.sect}>OVERVIEW</Text></View>
      {hasEnergy && <Text style={s.insightT}>• Energy: {energy.energyScore}/100 ({energy.confidence})</Text>}
      {hasInt && <Text style={s.insightT}>• INT: {intData.todayScore}/100 ({intData.streak} day streak)</Text>}
      <Text style={s.insightT}>• {hasEnergy && hasInt ? 'Both stats tracked — keep it up!' : 'Log more data to unlock combined insights.'}</Text>
    </View>
  </>);
};

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1B26' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: '#161826' },
  headerTitle: { color: '#3B82F6', fontSize: 16, fontFamily: 'PressStart2P' },
  content: { padding: 16, paddingBottom: 100, gap: 14 },

  /* Tabs */
  tabBar: { flexDirection: 'row', backgroundColor: '#111827', borderBottomWidth: 1, borderBottomColor: 'rgba(37,123,244,0.25)', paddingHorizontal: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  tabText: { color: '#475569', fontFamily: 'PressStart2P', fontSize: 9 },
  tabTextActive: { color: '#3B82F6' },

  /* Panels */
  panel: { backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(37,123,244,0.35)', padding: 16, gap: 8 },
  centerPanel: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  sect: { color: '#7aaef8', fontFamily: 'PressStart2P', fontSize: 9, letterSpacing: 1 },

  loadingText: { color: '#64748b', fontFamily: 'VT323', fontSize: 18 },
  noTitle: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 12, marginTop: 8 },
  noText: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 18, textAlign: 'center', paddingHorizontal: 20 },
  cta: { marginTop: 8, backgroundColor: '#257bf4', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4 },
  ctaT: { color: '#fff', fontFamily: 'PressStart2P', fontSize: 10 },

  /* Score */
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  bigScore: { fontSize: 48, fontFamily: 'PressStart2P' },
  energyLabel: { fontFamily: 'PressStart2P', fontSize: 11 },
  desc: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 16 },
  bar: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 3 },
  energyCard: { borderColor: 'rgba(37,123,244,0.5)' },

  /* Badge */
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: 'PressStart2P', fontSize: 7 },
  methodText: { color: '#475569', fontFamily: 'VT323', fontSize: 14 },

  /* Stats */
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { color: '#fff', fontFamily: 'VT323', fontSize: 26 },
  statLbl: { color: '#64748b', fontFamily: 'PressStart2P', fontSize: 6, textAlign: 'center' },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(71,85,105,0.3)' },

  /* Chart */
  chartScroll: { marginTop: 4 },
  hint: { color: '#475569', fontFamily: 'VT323', fontSize: 14, textAlign: 'center' },
  miniChartLabel: { color: '#7aaef8', fontFamily: 'PressStart2P', fontSize: 8, letterSpacing: 1, marginBottom: 4 },

  /* Legend */
  legRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legText: { color: '#64748b', fontFamily: 'VT323', fontSize: 14 },

  /* Recommendations */
  recScroll: { gap: 10, paddingVertical: 4 },
  recCard: { width: 120, backgroundColor: '#0f172a', borderWidth: 1, borderRadius: 4, padding: 12, gap: 6, alignItems: 'center' },
  recLabel: { fontFamily: 'PressStart2P', fontSize: 7, textAlign: 'center' },
  recTime: { color: '#e2e8f0', fontFamily: 'VT323', fontSize: 18 },

  /* Insight */
  insightP: { borderColor: 'rgba(251,191,36,0.3)' },
  insightH: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightT: { color: '#e2e8f0', fontFamily: 'VT323', fontSize: 20, lineHeight: 26 },

  /* Trends */
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  trendCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  trendVal: { fontFamily: 'PressStart2P', fontSize: 18 },

  /* Forecast */
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingHorizontal: 8 },
  forecastBlock: { alignItems: 'center', gap: 4 },
  forecastSmall: { color: '#64748b', fontFamily: 'PressStart2P', fontSize: 7 },
  forecastLevel: { fontFamily: 'PressStart2P', fontSize: 22 },
  forecastRank: { color: '#94a3b8', fontFamily: 'VT323', fontSize: 16 },
  forecastGain: { color: '#22c55e', fontFamily: 'PressStart2P', fontSize: 9, marginTop: 2 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
});

export default AnalyticsScreen;
