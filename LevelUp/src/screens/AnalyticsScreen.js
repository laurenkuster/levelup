/**
 * AnalyticsScreen — Multi-tab analytics dashboard.
 *
 * Internal tabs: ENERGY | INT | STR | DEX | SPD | STM | TRENDS
 *
 * Energy:  ML-powered energy prediction + 24h curve + recommendations
 * INT:     Quiz performance scoring + trend charts
 * STR:     Strength score trend, volume by body part, muscle balance, 1RM leaderboard, forecast
 * DEX:     Flexibility score trend, volume by zone, balance, top stretches, forecast
 * SPD:     Speed score trend, session type distribution, top speeds, forecast
 * STM:     Stamina score trend, run type distribution, endurance PRs, forecast
 * Trends:  Combined overview
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
import { computeStrMetrics } from '../services/strAnalyticsService';
import { computeDexMetrics } from '../services/dexAnalyticsService';
import { computeSpdMetrics } from '../services/spdAnalyticsService';
import { computeStmMetrics } from '../services/stmAnalyticsService';
import { computeCrossStatAnalysis } from '../services/crossStatEngine';
import { BODY_PARTS } from '../config/strConstants';
import { FLEX_ZONES } from '../config/dexConstants';
import { SPD_METRICS } from '../config/spdConstants';
import { STM_METRICS } from '../config/stmConstants';

const SW = Dimensions.get('window').width;
const CHART_W = 960;
const CH = 180;
const CP = { top: 10, right: 16, bottom: 30, left: 36 };

/* ═══════════════════════════════════════════════════
   TAB SWITCHER
   ═══════════════════════════════════════════════════ */

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
  const [strData, setStrData] = useState(null);
  const [dexData, setDexData] = useState(null);
  const [spdData, setSpdData] = useState(null);
  const [stmData, setStmData] = useState(null);
  const [crossData, setCrossData] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let m = true;
      const load = async () => {
        setLoading(true);
        try {
          const [e, i, st, dx, sp, sm, cr] = await Promise.all([
            computeDailyMetrics(), computeIntMetrics(), computeStrMetrics(),
            computeDexMetrics(), computeSpdMetrics(), computeStmMetrics(),
            computeCrossStatAnalysis(),
          ]);
          if (m) { setEnergy(e); setIntData(i); setStrData(st); setDexData(dx); setSpdData(sp); setStmData(sm); setCrossData(cr); }
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
        ) : tab === 'STR' ? (
          <StrView data={strData} navigation={navigation} />
        ) : tab === 'DEX' ? (
          <DexView data={dexData} navigation={navigation} />
        ) : tab === 'SPD' ? (
          <SpdView data={spdData} navigation={navigation} />
        ) : tab === 'STM' ? (
          <StmView data={stmData} navigation={navigation} />
        ) : tab === 'RECOVERY' ? (
          <RecoveryView data={crossData} />
        ) : (
          <TrendsView energy={energy} intData={intData} strData={strData} dexData={dexData} spdData={spdData} stmData={stmData} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* ═══════════════════════════════════════════════════
   ML PREDICTION PANEL (shared across stat views)
   ═══════════════════════════════════════════════════ */

const MlPredictionPanel = ({ prediction, modelInfo, color, stat }) => {
  if (!prediction) return null;
  const r2Pct = modelInfo?.r2 ? Math.round(modelInfo.r2 * 100) : null;
  const confidence = r2Pct >= 95 ? 'HIGH' : r2Pct >= 85 ? 'GOOD' : r2Pct >= 70 ? 'MODERATE' : 'LOW';
  const confColor = r2Pct >= 95 ? '#22c55e' : r2Pct >= 85 ? '#3b82f6' : r2Pct >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[s.panel, { borderColor: color + '60' }]}>
      <View style={s.row}>
        <Text style={s.sect}>ML PREDICTION</Text>
        <View style={[s.badge, { borderColor: color, flexDirection: 'row', gap: 4 }]}>
          <MaterialCommunityIcons name="brain" size={10} color={color} />
          <Text style={[s.badgeText, { color }]}>{stat}</Text>
        </View>
      </View>
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={[s.statVal, { color }]}>{prediction.prediction}</Text>
          <Text style={s.statLbl}>{prediction.targetLabel || prediction.target || 'PREDICTED'}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: confColor }]}>{confidence}</Text>
          <Text style={s.statLbl}>CONFIDENCE</Text>
        </View>
        {modelInfo?.mae != null && (
          <>
            <View style={s.divider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>±{modelInfo.mae}</Text>
              <Text style={s.statLbl}>MAE</Text>
            </View>
          </>
        )}
      </View>
      {r2Pct != null && (
        <View style={{ marginTop: 4 }}>
          <View style={s.row}>
            <Text style={s.desc}>Model accuracy (R²)</Text>
            <Text style={[s.desc, { color: confColor }]}>{r2Pct}%</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, r2Pct)}%`, backgroundColor: confColor }]} />
          </View>
        </View>
      )}
      {modelInfo?.nTrees && (
        <Text style={[s.desc, { marginTop: 2, color: '#475569' }]}>
          {modelInfo.nTrees} trees · depth {modelInfo.maxDepth} · {modelInfo.trainingSamples?.toLocaleString()} samples
        </Text>
      )}
    </View>
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

    {/* Food Analytics */}
    {m.foodAnalytics?.hasData && (
      <View style={[s.panel, { borderColor: 'rgba(16,185,129,0.4)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>FOOD ANALYTICS</Text>
          <View style={[s.badge, { borderColor: '#10b981' }]}>
            <Text style={[s.badgeText, { color: '#10b981' }]}>NUTRITION</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          {[
            { v: `${m.foodAnalytics.today?.calories ?? 0}`, l: 'KCAL TODAY' },
            { v: `${m.foodAnalytics.today?.protein ?? 0}g`, l: 'PROTEIN' },
            { v: `${m.foodAnalytics.rolling?.protein7dAvg ?? 0}g`, l: 'PROTEIN 7D' },
            { v: `${Math.round((m.foodAnalytics.today?.proteinAdequacyRatio ?? 0) * 100)}%`, l: 'GOAL HIT' },
          ].map((st, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
            </React.Fragment>
          ))}
        </View>

        <Text style={s.desc}>
          Energy balance today: {m.foodAnalytics.today?.energyBalance ?? 0} kcal
        </Text>

        {m.foodAnalytics.recommendations?.length > 0 && (
          <View style={{ marginTop: 2 }}>
            {m.foodAnalytics.recommendations.map((rec, i) => (
              <Text key={i} style={s.insightT}>• {rec}</Text>
            ))}
          </View>
        )}
      </View>
    )}

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

        {/* Combined History + Forecast Graph */}
        {(fc.history?.length > 0 || fc.projected?.length > 0) && (() => {
          const histPts = fc.history || [];
          const predPts = fc.projected || [];
          const allXp = [
            ...histPts.map((p) => p.xp),
            ...predPts.map((p) => p.projectedXp),
          ];
          const maxXp = Math.max(...allXp);
          const minXp = Math.min(...allXp);
          const range = maxXp - minXp || 1;
          const fW = SW - 64;
          const fH = 130;
          const fPad = { top: 20, right: 8, bottom: 28, left: 44 };
          const fpW = fW - fPad.left - fPad.right;
          const fpH = fH - fPad.top - fPad.bottom;
          const totalPtsCount = histPts.length + predPts.length;

          const hPts = histPts.map((p, i) => {
            const x = fPad.left + (i / Math.max(totalPtsCount - 1, 1)) * fpW;
            const y = fPad.top + fpH - ((p.xp - minXp) / range) * fpH;
            return { x, y, label: p.dateLabel, xp: p.xp, dayXp: p.dayXp, level: p.level, isActual: true };
          });
          const pPts = predPts.map((p, i) => {
            const x = fPad.left + ((histPts.length + i) / Math.max(totalPtsCount - 1, 1)) * fpW;
            const y = fPad.top + fpH - ((p.projectedXp - minXp) / range) * fpH;
            return { x, y, label: p.dateLabel, xp: p.projectedXp, dayXp: p.dayXp, level: p.level, isActual: false };
          });

          const histLine = hPts.map((p) => `${p.x},${p.y}`).join(' ');
          const bridgePt = hPts.length > 0 ? `${hPts[hPts.length - 1].x},${hPts[hPts.length - 1].y} ` : '';
          const predLine = bridgePt + pPts.map((p) => `${p.x},${p.y}`).join(' ');
          const todayX = hPts.length > 0 ? hPts[hPts.length - 1].x : fPad.left;

          return (
            <View style={{ marginTop: 4 }}>
              <Text style={s.miniChartLabel}>XP TIMELINE: ACTUAL + FORECAST</Text>
              <Svg width={fW} height={fH}>
                <Line x1={fPad.left} y1={fPad.top + fpH} x2={fW - fPad.right} y2={fPad.top + fpH} stroke="rgba(71,85,105,0.3)" strokeWidth={0.5} />
                <Line x1={fPad.left} y1={fPad.top + fpH / 2} x2={fW - fPad.right} y2={fPad.top + fpH / 2} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
                <Line x1={fPad.left} y1={fPad.top} x2={fW - fPad.right} y2={fPad.top} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
                <SvgText x={fPad.left - 4} y={fPad.top + fpH + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{minXp}</SvgText>
                <SvgText x={fPad.left - 4} y={fPad.top + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{maxXp}</SvgText>
                {/* Today divider */}
                <Line x1={todayX} y1={fPad.top - 4} x2={todayX} y2={fPad.top + fpH + 4} stroke="rgba(168,85,247,0.5)" strokeWidth={1} strokeDasharray="3,2" />
                <SvgText x={todayX} y={fPad.top - 6} fill="#a855f7" fontSize={7} fontFamily="monospace" textAnchor="middle">TODAY</SvgText>
                {/* Actual line (solid) */}
                {hPts.length > 1 && <Polyline points={histLine} fill="none" stroke="#a855f7" strokeWidth={2.5} strokeLinejoin="round" />}
                {/* Predicted line (dashed) */}
                {pPts.length > 0 && <Polyline points={predLine} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" strokeOpacity={0.7} />}
                {/* History dots */}
                {hPts.map((p, i) => (
                  <React.Fragment key={`h${i}`}>
                    <Circle cx={p.x} cy={p.y} r={4} fill="#a855f7" />
                    {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#f8fafc" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
                    <SvgText x={p.x} y={fH - 4} fill="#94a3b8" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
                  </React.Fragment>
                ))}
                {/* Forecast dots */}
                {pPts.map((p, i) => (
                  <React.Fragment key={`p${i}`}>
                    <Circle cx={p.x} cy={p.y} r={3.5} fill="none" stroke="#a855f7" strokeWidth={1.5} />
                    {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#a855f799" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
                    <SvgText x={p.x} y={fH - 4} fill="#64748b" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
                    {p.level > (i > 0 ? pPts[i-1].level : (hPts.length > 0 ? hPts[hPts.length-1].level : fc.currentLevel)) && (
                      <SvgText x={p.x} y={p.y - 16} fill="#22c55e" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">LV{p.level}</SvgText>
                    )}
                  </React.Fragment>
                ))}
              </Svg>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 2, paddingLeft: fPad.left }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: '#a855f7' }} />
                  <Text style={{ color: '#94a3b8', fontFamily: 'VT323', fontSize: 13 }}>Actual</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: '#a855f7', opacity: 0.5 }} />
                  <Text style={{ color: '#64748b', fontFamily: 'VT323', fontSize: 13 }}>Predicted</Text>
                </View>
              </View>
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
   STR VIEW
   ═══════════════════════════════════════════════════ */

const StrView = ({ data, navigation }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialCommunityIcons name="dumbbell" size={40} color="#ef4444" />
      <Text style={s.noTitle}>NO WORKOUT DATA</Text>
      <Text style={s.noText}>Log a strength workout to start tracking your progress.</Text>
      <Pressable onPress={() => navigation.navigate('LogStrEntry')} style={[s.cta, { backgroundColor: '#ef4444' }]}>
        <Text style={s.ctaT}>LOG WORKOUT</Text>
      </Pressable>
    </View>
  );

  const fc = data.forecast;
  const maxScore = data.scoreTrend.length > 0 ? Math.max(...data.scoreTrend.map((d) => d.value), 1) : 100;

  return (<>
    {/* Training Summary */}
    <View style={[s.panel, { borderColor: 'rgba(239,68,68,0.5)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>TRAINING SUMMARY</Text>
        <View style={[s.badge, { borderColor: '#ef4444' }]}><Text style={[s.badgeText, { color: '#ef4444' }]}>STR</Text></View>
      </View>
      <View style={s.statsRow}>
        {[
          { v: `${data.frequency.sessionsLast7}`, l: 'SESSIONS/7D' },
          { v: `${data.frequency.setsLast7}`, l: 'SETS/7D' },
          { v: `${data.frequency.xpLast7}`, l: 'XP/7D' },
          { v: `${data.frequency.streak}`, l: 'STREAK' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
    </View>

    {/* ML Prediction */}
    <MlPredictionPanel prediction={data.mlPrediction} modelInfo={data.mlModelInfo} color="#ef4444" stat="STR" />

    {/* Volume by Body Part */}
    <View style={s.panel}>
      <Text style={s.sect}>VOLUME BY BODY PART (14D)</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {data.volumeByPart.map((bp) => (
          <View key={bp.key} style={{ gap: 3 }}>
            <View style={s.row}>
              <Text style={[s.desc, { color: bp.color, fontFamily: 'PressStart2P', fontSize: 7 }]}>{bp.label.toUpperCase()}</Text>
              <Text style={s.desc}>{bp.sets} sets</Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${bp.percent}%`, backgroundColor: bp.color }]} />
            </View>
          </View>
        ))}
      </View>
    </View>

    {/* Muscle Balance */}
    <View style={[s.panel, { borderColor: data.balance.balanced ? 'rgba(34,197,94,0.4)' : 'rgba(251,146,60,0.4)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>MUSCLE BALANCE</Text>
        <View style={[s.badge, { borderColor: data.balance.balanced ? '#22c55e' : '#f97316' }]}>
          <Text style={[s.badgeText, { color: data.balance.balanced ? '#22c55e' : '#f97316' }]}>
            {data.balance.balanced ? 'BALANCED' : 'IMBALANCED'}
          </Text>
        </View>
      </View>
      {data.balance.insights.map((insight, i) => (
        <Text key={i} style={s.insightT}>{'\u2022'} {insight}</Text>
      ))}
      {data.balance.strongest && data.balance.weakest && (
        <View style={[s.statsRow, { marginTop: 4 }]}>
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#22c55e' }]}>{data.balance.strongest.label}</Text>
            <Text style={s.statLbl}>STRONGEST</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#f97316' }]}>{data.balance.weakest.label}</Text>
            <Text style={s.statLbl}>WEAKEST</Text>
          </View>
        </View>
      )}
    </View>

    {/* Top 1RMs */}
    {data.top1RMs.length > 0 && (
      <View style={s.panel}>
        <Text style={s.sect}>TOP ESTIMATED 1RMs</Text>
        {data.top1RMs.map((ex, i) => {
          const bp = BODY_PARTS.find((b) => b.key === ex.primary);
          return (
            <View key={ex.exerciseId} style={[s.row, { paddingVertical: 4, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(71,85,105,0.15)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={[s.desc, { color: '#64748b', width: 18 }]}>#{i + 1}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bp?.color || '#3B82F6' }} />
                <Text style={[s.desc, { color: '#e2e8f0' }]}>{ex.name}</Text>
              </View>
              <Text style={[s.statVal, { fontSize: 22 }]}>{ex.max1RM} <Text style={{ fontSize: 14, color: '#64748b' }}>lbs</Text></Text>
            </View>
          );
        })}
      </View>
    )}

    {/* Strength Score Trend */}
    {data.scoreTrend.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={data.scoreTrend} color="#ef4444" maxVal={maxScore} label="STRENGTH SCORE TREND" />
      </View>
    )}

    {/* 7-Day Forecast */}
    {fc && (
      <View style={[s.panel, { borderColor: 'rgba(239,68,68,0.5)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>7-DAY FORECAST</Text>
          <View style={[s.badge, { borderColor: '#ef4444' }]}><Text style={[s.badgeText, { color: '#ef4444' }]}>STR</Text></View>
        </View>

        <View style={s.forecastRow}>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>NOW</Text>
            <Text style={[s.forecastLevel, { color: '#ef4444' }]}>LV {fc.currentLevel}</Text>
            <Text style={s.forecastRank}>{fc.currentRank}</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="trending-flat" size={28} color={
              fc.levelsGained > 0 ? '#22c55e' : fc.scoreTrend === 'declining' ? '#ef4444' : '#64748b'
            } />
            {fc.levelsGained > 0 && <Text style={s.forecastGain}>+{fc.levelsGained}</Text>}
          </View>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>IN 7 DAYS</Text>
            <Text style={[s.forecastLevel, { color: fc.levelsGained > 0 ? '#22c55e' : '#ef4444' }]}>
              LV {fc.projectedLevel}
            </Text>
            <Text style={s.forecastRank}>{fc.projectedRank}</Text>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.desc}>XP: {fc.xpInCurrentLevel} / {fc.xpToNextLevel}</Text>
            <Text style={s.desc}>{fc.avgXpPerDay} XP/day avg</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, fc.xpToNextLevel > 0 ? (fc.xpInCurrentLevel / fc.xpToNextLevel) * 100 : 0)}%`, backgroundColor: '#ef4444' }]} />
          </View>
        </View>

        {/* Combined History + Forecast Graph */}
        {(fc.history?.length > 0 || fc.projected?.length > 0) && (() => {
          const histPts = fc.history || [];
          const predPts = fc.projected || [];
          const allXp = [
            ...histPts.map((p) => p.xp),
            ...predPts.map((p) => p.projectedXp),
          ];
          const maxXp = Math.max(...allXp);
          const minXp = Math.min(...allXp);
          const range = maxXp - minXp || 1;
          const fW = SW - 64;
          const fH = 130;
          const fPad = { top: 20, right: 8, bottom: 28, left: 44 };
          const fpW = fW - fPad.left - fPad.right;
          const fpH = fH - fPad.top - fPad.bottom;
          const totalPts = histPts.length + predPts.length;

          // Map history points
          const hPts = histPts.map((p, i) => {
            const x = fPad.left + (i / Math.max(totalPts - 1, 1)) * fpW;
            const y = fPad.top + fpH - ((p.xp - minXp) / range) * fpH;
            return { x, y, label: p.dateLabel, xp: p.xp, dayXp: p.dayXp, level: p.level, isActual: true };
          });
          // Map predicted points
          const pPts = predPts.map((p, i) => {
            const x = fPad.left + ((histPts.length + i) / Math.max(totalPts - 1, 1)) * fpW;
            const y = fPad.top + fpH - ((p.projectedXp - minXp) / range) * fpH;
            return { x, y, label: p.dateLabel, xp: p.projectedXp, dayXp: p.dayXp, level: p.level, isActual: false };
          });

          const histLine = hPts.map((p) => `${p.x},${p.y}`).join(' ');
          // Connect forecast from last history point
          const bridgePt = hPts.length > 0 ? `${hPts[hPts.length - 1].x},${hPts[hPts.length - 1].y} ` : '';
          const predLine = bridgePt + pPts.map((p) => `${p.x},${p.y}`).join(' ');

          // Today divider x
          const todayX = hPts.length > 0 ? hPts[hPts.length - 1].x : fPad.left;

          return (
            <View style={{ marginTop: 4 }}>
              <Text style={s.miniChartLabel}>XP TIMELINE: ACTUAL + FORECAST</Text>
              <Svg width={fW} height={fH}>
                {/* Grid lines */}
                <Line x1={fPad.left} y1={fPad.top + fpH} x2={fW - fPad.right} y2={fPad.top + fpH} stroke="rgba(71,85,105,0.3)" strokeWidth={0.5} />
                <Line x1={fPad.left} y1={fPad.top + fpH / 2} x2={fW - fPad.right} y2={fPad.top + fpH / 2} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
                <Line x1={fPad.left} y1={fPad.top} x2={fW - fPad.right} y2={fPad.top} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
                {/* Y axis labels */}
                <SvgText x={fPad.left - 4} y={fPad.top + fpH + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{minXp}</SvgText>
                <SvgText x={fPad.left - 4} y={fPad.top + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{maxXp}</SvgText>
                {/* Today divider */}
                <Line x1={todayX} y1={fPad.top - 4} x2={todayX} y2={fPad.top + fpH + 4} stroke="rgba(239,68,68,0.5)" strokeWidth={1} strokeDasharray="3,2" />
                <SvgText x={todayX} y={fPad.top - 6} fill="#ef4444" fontSize={7} fontFamily="monospace" textAnchor="middle">TODAY</SvgText>
                {/* Actual line (solid) */}
                {hPts.length > 1 && <Polyline points={histLine} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" />}
                {/* Predicted line (dashed) */}
                {pPts.length > 0 && <Polyline points={predLine} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" strokeOpacity={0.7} />}
                {/* History dots */}
                {hPts.map((p, i) => (
                  <React.Fragment key={`h${i}`}>
                    <Circle cx={p.x} cy={p.y} r={4} fill="#ef4444" />
                    {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#f8fafc" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
                    <SvgText x={p.x} y={fH - 4} fill="#94a3b8" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
                  </React.Fragment>
                ))}
                {/* Forecast dots */}
                {pPts.map((p, i) => (
                  <React.Fragment key={`p${i}`}>
                    <Circle cx={p.x} cy={p.y} r={3.5} fill="none" stroke="#ef4444" strokeWidth={1.5} />
                    {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#ef444499" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
                    <SvgText x={p.x} y={fH - 4} fill="#64748b" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
                    {p.level > (i > 0 ? pPts[i-1].level : (hPts.length > 0 ? hPts[hPts.length-1].level : fc.currentLevel)) && (
                      <SvgText x={p.x} y={p.y - 16} fill="#22c55e" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">LV{p.level}</SvgText>
                    )}
                  </React.Fragment>
                ))}
              </Svg>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 2, paddingLeft: fPad.left }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: '#ef4444' }} />
                  <Text style={{ color: '#94a3b8', fontFamily: 'VT323', fontSize: 13 }}>Actual</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: '#ef4444', opacity: 0.5 }} />
                  <Text style={{ color: '#64748b', fontFamily: 'VT323', fontSize: 13 }}>Predicted</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

/* ═══════════════════════════════════════════════════
   DEX VIEW
   ═══════════════════════════════════════════════════ */

const DexView = ({ data, navigation }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialCommunityIcons name="yoga" size={40} color="#f97316" />
      <Text style={s.noTitle}>NO FLEXIBILITY DATA</Text>
      <Text style={s.noText}>Log a stretching session to start tracking your flexibility.</Text>
      <Pressable onPress={() => navigation.navigate('LogDexEntry')} style={[s.cta, { backgroundColor: '#f97316' }]}>
        <Text style={s.ctaT}>LOG STRETCH</Text>
      </Pressable>
    </View>
  );

  const fc = data.forecast;
  const maxScore = data.scoreTrend.length > 0 ? Math.max(...data.scoreTrend.map((d) => d.value), 1) : 100;

  return (<>
    {/* Training Summary */}
    <View style={[s.panel, { borderColor: 'rgba(249,115,22,0.5)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>FLEXIBILITY SUMMARY</Text>
        <View style={[s.badge, { borderColor: '#f97316' }]}><Text style={[s.badgeText, { color: '#f97316' }]}>DEX</Text></View>
      </View>
      <View style={s.statsRow}>
        {[
          { v: `${data.frequency.sessionsLast7}`, l: 'SESSIONS/7D' },
          { v: `${data.frequency.stretchesLast7}`, l: 'STRETCHES/7D' },
          { v: `${data.frequency.xpLast7}`, l: 'XP/7D' },
          { v: `${data.frequency.streak}`, l: 'STREAK' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
    </View>

    {/* ML Prediction */}
    <MlPredictionPanel prediction={data.mlPrediction} modelInfo={data.mlModelInfo} color="#f97316" stat="DEX" />

    {/* Volume by Zone */}
    <View style={s.panel}>
      <Text style={s.sect}>VOLUME BY ZONE (14D)</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {data.volumeByZone.map((z) => (
          <View key={z.key} style={{ gap: 3 }}>
            <View style={s.row}>
              <Text style={[s.desc, { color: z.color, fontFamily: 'PressStart2P', fontSize: 7 }]}>{z.label.toUpperCase()}</Text>
              <Text style={s.desc}>{z.stretches} stretches</Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${z.percent}%`, backgroundColor: z.color }]} />
            </View>
          </View>
        ))}
      </View>
    </View>

    {/* Flexibility Balance */}
    <View style={[s.panel, { borderColor: data.balance.balanced ? 'rgba(34,197,94,0.4)' : 'rgba(251,146,60,0.4)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>FLEXIBILITY BALANCE</Text>
        <View style={[s.badge, { borderColor: data.balance.balanced ? '#22c55e' : '#f97316' }]}>
          <Text style={[s.badgeText, { color: data.balance.balanced ? '#22c55e' : '#f97316' }]}>
            {data.balance.balanced ? 'BALANCED' : 'IMBALANCED'}
          </Text>
        </View>
      </View>
      {data.balance.insights.map((insight, i) => (
        <Text key={i} style={s.insightT}>{'\u2022'} {insight}</Text>
      ))}
      {data.balance.strongest && data.balance.weakest && (
        <View style={[s.statsRow, { marginTop: 4 }]}>
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#22c55e' }]}>{data.balance.strongest.label}</Text>
            <Text style={s.statLbl}>MOST FLEXIBLE</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: '#f97316' }]}>{data.balance.weakest.label}</Text>
            <Text style={s.statLbl}>NEEDS WORK</Text>
          </View>
        </View>
      )}
    </View>

    {/* Top Stretches */}
    {data.topStretches.length > 0 && (
      <View style={s.panel}>
        <Text style={s.sect}>MOST PRACTICED</Text>
        {data.topStretches.map((ex, i) => {
          const zone = FLEX_ZONES.find((z) => z.key === ex.primary);
          return (
            <View key={ex.stretchId} style={[s.row, { paddingVertical: 4, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(71,85,105,0.15)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={[s.desc, { color: '#64748b', width: 18 }]}>#{i + 1}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zone?.color || '#f97316' }} />
                <Text style={[s.desc, { color: '#e2e8f0' }]}>{ex.name}</Text>
              </View>
              <Text style={[s.statVal, { fontSize: 22 }]}>{ex.count}<Text style={{ fontSize: 14, color: '#64748b' }}>x</Text></Text>
            </View>
          );
        })}
      </View>
    )}

    {/* DEX Score Trend */}
    {data.scoreTrend.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={data.scoreTrend} color="#f97316" maxVal={maxScore} label="DEX SCORE TREND" />
      </View>
    )}

    {/* 7-Day Forecast */}
    {fc && (
      <View style={[s.panel, { borderColor: 'rgba(249,115,22,0.5)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>7-DAY FORECAST</Text>
          <View style={[s.badge, { borderColor: '#f97316' }]}><Text style={[s.badgeText, { color: '#f97316' }]}>DEX</Text></View>
        </View>

        <View style={s.forecastRow}>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>NOW</Text>
            <Text style={[s.forecastLevel, { color: '#f97316' }]}>LV {fc.currentLevel}</Text>
            <Text style={s.forecastRank}>{fc.currentRank}</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="trending-flat" size={28} color={
              fc.levelsGained > 0 ? '#22c55e' : fc.scoreTrend === 'declining' ? '#ef4444' : '#64748b'
            } />
            {fc.levelsGained > 0 && <Text style={s.forecastGain}>+{fc.levelsGained}</Text>}
          </View>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>IN 7 DAYS</Text>
            <Text style={[s.forecastLevel, { color: fc.levelsGained > 0 ? '#22c55e' : '#f97316' }]}>
              LV {fc.projectedLevel}
            </Text>
            <Text style={s.forecastRank}>{fc.projectedRank}</Text>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.desc}>XP: {fc.xpInCurrentLevel} / {fc.xpToNextLevel}</Text>
            <Text style={s.desc}>{fc.avgXpPerDay} XP/day avg</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, fc.xpToNextLevel > 0 ? (fc.xpInCurrentLevel / fc.xpToNextLevel) * 100 : 0)}%`, backgroundColor: '#f97316' }]} />
          </View>
        </View>

        {/* Combined History + Forecast Graph */}
        {(fc.history?.length > 0 || fc.projected?.length > 0) && (() => {
          const histPts = fc.history || [];
          const predPts = fc.projected || [];
          const allXp = [...histPts.map((p) => p.xp), ...predPts.map((p) => p.projectedXp)];
          const maxXp = Math.max(...allXp);
          const minXp = Math.min(...allXp);
          const range = maxXp - minXp || 1;
          const fW = SW - 64;
          const fH = 130;
          const fPad = { top: 20, right: 8, bottom: 28, left: 44 };
          const fpW = fW - fPad.left - fPad.right;
          const fpH = fH - fPad.top - fPad.bottom;
          const totalPtsCount = histPts.length + predPts.length;

          const hPts = histPts.map((p, i) => ({
            x: fPad.left + (i / Math.max(totalPtsCount - 1, 1)) * fpW,
            y: fPad.top + fpH - ((p.xp - minXp) / range) * fpH,
            label: p.dateLabel, xp: p.xp, dayXp: p.dayXp, level: p.level,
          }));
          const pPts = predPts.map((p, i) => ({
            x: fPad.left + ((histPts.length + i) / Math.max(totalPtsCount - 1, 1)) * fpW,
            y: fPad.top + fpH - ((p.projectedXp - minXp) / range) * fpH,
            label: p.dateLabel, xp: p.projectedXp, dayXp: p.dayXp, level: p.level,
          }));

          const histLine = hPts.map((p) => `${p.x},${p.y}`).join(' ');
          const bridgePt = hPts.length > 0 ? `${hPts[hPts.length - 1].x},${hPts[hPts.length - 1].y} ` : '';
          const predLine = bridgePt + pPts.map((p) => `${p.x},${p.y}`).join(' ');
          const todayX = hPts.length > 0 ? hPts[hPts.length - 1].x : fPad.left;

          return (
            <View style={{ marginTop: 4 }}>
              <Text style={s.miniChartLabel}>XP TIMELINE: ACTUAL + FORECAST</Text>
              <Svg width={fW} height={fH}>
                <Line x1={fPad.left} y1={fPad.top + fpH} x2={fW - fPad.right} y2={fPad.top + fpH} stroke="rgba(71,85,105,0.3)" strokeWidth={0.5} />
                <Line x1={fPad.left} y1={fPad.top + fpH / 2} x2={fW - fPad.right} y2={fPad.top + fpH / 2} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
                <Line x1={fPad.left} y1={fPad.top} x2={fW - fPad.right} y2={fPad.top} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
                <SvgText x={fPad.left - 4} y={fPad.top + fpH + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{minXp}</SvgText>
                <SvgText x={fPad.left - 4} y={fPad.top + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{maxXp}</SvgText>
                <Line x1={todayX} y1={fPad.top - 4} x2={todayX} y2={fPad.top + fpH + 4} stroke="rgba(249,115,22,0.5)" strokeWidth={1} strokeDasharray="3,2" />
                <SvgText x={todayX} y={fPad.top - 6} fill="#f97316" fontSize={7} fontFamily="monospace" textAnchor="middle">TODAY</SvgText>
                {hPts.length > 1 && <Polyline points={histLine} fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinejoin="round" />}
                {pPts.length > 0 && <Polyline points={predLine} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" strokeOpacity={0.7} />}
                {hPts.map((p, i) => (
                  <React.Fragment key={`h${i}`}>
                    <Circle cx={p.x} cy={p.y} r={4} fill="#f97316" />
                    {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#f8fafc" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
                    <SvgText x={p.x} y={fH - 4} fill="#94a3b8" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
                  </React.Fragment>
                ))}
                {pPts.map((p, i) => (
                  <React.Fragment key={`p${i}`}>
                    <Circle cx={p.x} cy={p.y} r={3.5} fill="none" stroke="#f97316" strokeWidth={1.5} />
                    {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#f9731699" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
                    <SvgText x={p.x} y={fH - 4} fill="#64748b" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
                    {p.level > (i > 0 ? pPts[i-1].level : (hPts.length > 0 ? hPts[hPts.length-1].level : fc.currentLevel)) && (
                      <SvgText x={p.x} y={p.y - 16} fill="#22c55e" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">LV{p.level}</SvgText>
                    )}
                  </React.Fragment>
                ))}
              </Svg>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 2, paddingLeft: fPad.left }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: '#f97316' }} />
                  <Text style={{ color: '#94a3b8', fontFamily: 'VT323', fontSize: 13 }}>Actual</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 16, height: 2, backgroundColor: '#f97316', opacity: 0.5 }} />
                  <Text style={{ color: '#64748b', fontFamily: 'VT323', fontSize: 13 }}>Predicted</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

/* ═══════════════════════════════════════════════════
   FORECAST GRAPH — shared by STR, DEX, SPD, STM
   ═══════════════════════════════════════════════════ */

const ForecastGraph = ({ fc, color }) => {
  if (!fc?.history?.length && !fc?.projected?.length) return null;
  const histPts = fc.history || [];
  const predPts = fc.projected || [];
  const allXp = [...histPts.map((p) => p.xp), ...predPts.map((p) => p.projectedXp)];
  const maxXp = Math.max(...allXp);
  const minXp = Math.min(...allXp);
  const range = maxXp - minXp || 1;
  const fW = SW - 64;
  const fH = 130;
  const fPad = { top: 20, right: 8, bottom: 28, left: 44 };
  const fpW = fW - fPad.left - fPad.right;
  const fpH = fH - fPad.top - fPad.bottom;
  const totalPtsCount = histPts.length + predPts.length;

  const hPts = histPts.map((p, i) => ({
    x: fPad.left + (i / Math.max(totalPtsCount - 1, 1)) * fpW,
    y: fPad.top + fpH - ((p.xp - minXp) / range) * fpH,
    label: p.dateLabel, xp: p.xp, dayXp: p.dayXp, level: p.level,
  }));
  const pPts = predPts.map((p, i) => ({
    x: fPad.left + ((histPts.length + i) / Math.max(totalPtsCount - 1, 1)) * fpW,
    y: fPad.top + fpH - ((p.projectedXp - minXp) / range) * fpH,
    label: p.dateLabel, xp: p.projectedXp, dayXp: p.dayXp, level: p.level,
  }));

  const histLine = hPts.map((p) => `${p.x},${p.y}`).join(' ');
  const bridgePt = hPts.length > 0 ? `${hPts[hPts.length - 1].x},${hPts[hPts.length - 1].y} ` : '';
  const predLine = bridgePt + pPts.map((p) => `${p.x},${p.y}`).join(' ');
  const todayX = hPts.length > 0 ? hPts[hPts.length - 1].x : fPad.left;

  return (
    <View style={{ marginTop: 4 }}>
      <Text style={s.miniChartLabel}>XP TIMELINE: ACTUAL + FORECAST</Text>
      <Svg width={fW} height={fH}>
        <Line x1={fPad.left} y1={fPad.top + fpH} x2={fW - fPad.right} y2={fPad.top + fpH} stroke="rgba(71,85,105,0.3)" strokeWidth={0.5} />
        <Line x1={fPad.left} y1={fPad.top + fpH / 2} x2={fW - fPad.right} y2={fPad.top + fpH / 2} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
        <Line x1={fPad.left} y1={fPad.top} x2={fW - fPad.right} y2={fPad.top} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
        <SvgText x={fPad.left - 4} y={fPad.top + fpH + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{minXp}</SvgText>
        <SvgText x={fPad.left - 4} y={fPad.top + 3} fill="#475569" fontSize={8} fontFamily="monospace" textAnchor="end">{maxXp}</SvgText>
        <Line x1={todayX} y1={fPad.top - 4} x2={todayX} y2={fPad.top + fpH + 4} stroke={color + '80'} strokeWidth={1} strokeDasharray="3,2" />
        <SvgText x={todayX} y={fPad.top - 6} fill={color} fontSize={7} fontFamily="monospace" textAnchor="middle">TODAY</SvgText>
        {hPts.length > 1 && <Polyline points={histLine} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />}
        {pPts.length > 0 && <Polyline points={predLine} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" strokeOpacity={0.7} />}
        {hPts.map((p, i) => (
          <React.Fragment key={`h${i}`}>
            <Circle cx={p.x} cy={p.y} r={4} fill={color} />
            {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill="#f8fafc" fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
            <SvgText x={p.x} y={fH - 4} fill="#94a3b8" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
          </React.Fragment>
        ))}
        {pPts.map((p, i) => (
          <React.Fragment key={`p${i}`}>
            <Circle cx={p.x} cy={p.y} r={3.5} fill="none" stroke={color} strokeWidth={1.5} />
            {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill={color + '99'} fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
            <SvgText x={p.x} y={fH - 4} fill="#64748b" fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
            {p.level > (i > 0 ? pPts[i-1].level : (hPts.length > 0 ? hPts[hPts.length-1].level : fc.currentLevel)) && (
              <SvgText x={p.x} y={p.y - 16} fill="#22c55e" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">LV{p.level}</SvgText>
            )}
          </React.Fragment>
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 2, paddingLeft: fPad.left }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 2, backgroundColor: color }} />
          <Text style={{ color: '#94a3b8', fontFamily: 'VT323', fontSize: 13 }}>Actual</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 2, backgroundColor: color, opacity: 0.5 }} />
          <Text style={{ color: '#64748b', fontFamily: 'VT323', fontSize: 13 }}>Predicted</Text>
        </View>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════
   SPD VIEW
   ═══════════════════════════════════════════════════ */

const SpdView = ({ data, navigation }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialCommunityIcons name="run-fast" size={40} color="#f59e0b" />
      <Text style={s.noTitle}>NO SPEED DATA</Text>
      <Text style={s.noText}>Log a sprint session to start tracking your speed.</Text>
      <Pressable onPress={() => navigation.navigate('LogSpdEntry')} style={[s.cta, { backgroundColor: '#f59e0b' }]}>
        <Text style={s.ctaT}>LOG SPRINT</Text>
      </Pressable>
    </View>
  );

  const fc = data.forecast;
  const maxScore = data.scoreTrend.length > 0 ? Math.max(...data.scoreTrend.map((d) => d.value), 1) : 100;

  return (<>
    {/* Training Summary */}
    <View style={[s.panel, { borderColor: 'rgba(245,158,11,0.5)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>SPEED SUMMARY</Text>
        <View style={[s.badge, { borderColor: '#f59e0b' }]}><Text style={[s.badgeText, { color: '#f59e0b' }]}>SPD</Text></View>
      </View>
      <View style={s.statsRow}>
        {[
          { v: `${data.frequency.sessionsLast7}`, l: 'SESSIONS/7D' },
          { v: `${data.frequency.xpLast7}`, l: 'XP/7D' },
          { v: `${data.frequency.streak}`, l: 'STREAK' },
          { v: `${data.totalSessions}`, l: 'TOTAL' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
    </View>

    {/* ML Prediction */}
    <MlPredictionPanel prediction={data.mlPrediction} modelInfo={data.mlModelInfo} color="#f59e0b" stat="SPD" />

    {/* Volume by Type */}
    <View style={s.panel}>
      <Text style={s.sect}>SESSION TYPES (14D)</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {data.volumeByType.map((t) => (
          <View key={t.key} style={{ gap: 3 }}>
            <View style={s.row}>
              <Text style={[s.desc, { color: t.color, fontFamily: 'PressStart2P', fontSize: 7 }]}>{t.label.toUpperCase()}</Text>
              <Text style={s.desc}>{t.sessions} sessions</Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${t.percent}%`, backgroundColor: t.color }]} />
            </View>
          </View>
        ))}
      </View>
    </View>

    {/* Top Speeds */}
    {data.topSpeeds.length > 0 && (
      <View style={s.panel}>
        <Text style={s.sect}>TOP SPEEDS</Text>
        {data.topSpeeds.map((pr, i) => {
          const typeInfo = SPD_METRICS.find((m) => m.key === pr.type);
          return (
            <View key={pr.sessionId || i} style={[s.row, { paddingVertical: 4, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(71,85,105,0.15)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={[s.desc, { color: '#64748b', width: 18 }]}>#{i + 1}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: typeInfo?.color || '#f59e0b' }} />
                <Text style={[s.desc, { color: '#e2e8f0' }]}>{pr.date}</Text>
              </View>
              <Text style={[s.statVal, { fontSize: 22 }]}>{pr.maxSpeed} <Text style={{ fontSize: 14, color: '#64748b' }}>mph</Text></Text>
            </View>
          );
        })}
      </View>
    )}

    {/* Score Trend */}
    {data.scoreTrend.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={data.scoreTrend} color="#f59e0b" maxVal={maxScore} label="SPEED SCORE TREND" />
      </View>
    )}

    {/* Speed Trend */}
    {data.speedTrend.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={data.speedTrend} color="#fb923c" maxVal={Math.max(...data.speedTrend.map((d) => d.value), 1)} label="MAX SPEED TREND (MPH)" />
      </View>
    )}

    {/* 7-Day Forecast */}
    {fc && (
      <View style={[s.panel, { borderColor: 'rgba(245,158,11,0.5)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>7-DAY FORECAST</Text>
          <View style={[s.badge, { borderColor: '#f59e0b' }]}><Text style={[s.badgeText, { color: '#f59e0b' }]}>SPD</Text></View>
        </View>
        <View style={s.forecastRow}>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>NOW</Text>
            <Text style={[s.forecastLevel, { color: '#f59e0b' }]}>LV {fc.currentLevel}</Text>
            <Text style={s.forecastRank}>{fc.currentRank}</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="trending-flat" size={28} color={fc.levelsGained > 0 ? '#22c55e' : '#64748b'} />
            {fc.levelsGained > 0 && <Text style={s.forecastGain}>+{fc.levelsGained}</Text>}
          </View>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>IN 7 DAYS</Text>
            <Text style={[s.forecastLevel, { color: fc.levelsGained > 0 ? '#22c55e' : '#f59e0b' }]}>LV {fc.projectedLevel}</Text>
            <Text style={s.forecastRank}>{fc.projectedRank}</Text>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.desc}>XP: {fc.xpInCurrentLevel} / {fc.xpToNextLevel}</Text>
            <Text style={s.desc}>{fc.avgXpPerDay} XP/day avg</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, fc.xpToNextLevel > 0 ? (fc.xpInCurrentLevel / fc.xpToNextLevel) * 100 : 0)}%`, backgroundColor: '#f59e0b' }]} />
          </View>
        </View>
        <ForecastGraph fc={fc} color="#f59e0b" />
        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

/* ═══════════════════════════════════════════════════
   STM VIEW
   ═══════════════════════════════════════════════════ */

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const StmView = ({ data, navigation }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="favorite" size={40} color="#ec4899" />
      <Text style={s.noTitle}>NO ENDURANCE DATA</Text>
      <Text style={s.noText}>Log an endurance run to start tracking your stamina.</Text>
      <Pressable onPress={() => navigation.navigate('LogStmEntry')} style={[s.cta, { backgroundColor: '#ec4899' }]}>
        <Text style={s.ctaT}>LOG RUN</Text>
      </Pressable>
    </View>
  );

  const fc = data.forecast;
  const maxScore = data.scoreTrend.length > 0 ? Math.max(...data.scoreTrend.map((d) => d.value), 1) : 100;
  const { prs } = data;

  return (<>
    {/* Training Summary */}
    <View style={[s.panel, { borderColor: 'rgba(236,72,153,0.5)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>ENDURANCE SUMMARY</Text>
        <View style={[s.badge, { borderColor: '#ec4899' }]}><Text style={[s.badgeText, { color: '#ec4899' }]}>STM</Text></View>
      </View>
      <View style={s.statsRow}>
        {[
          { v: `${data.frequency.sessionsLast7}`, l: 'RUNS/7D' },
          { v: `${data.frequency.milesLast7}`, l: 'MILES/7D' },
          { v: `${data.frequency.xpLast7}`, l: 'XP/7D' },
          { v: `${data.frequency.streak}`, l: 'STREAK' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
    </View>

    {/* ML Prediction */}
    <MlPredictionPanel prediction={data.mlPrediction} modelInfo={data.mlModelInfo} color="#ec4899" stat="STM" />

    {/* Volume by Run Type */}
    <View style={s.panel}>
      <Text style={s.sect}>RUN TYPES (14D)</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {data.volumeByType.map((t) => (
          <View key={t.key} style={{ gap: 3 }}>
            <View style={s.row}>
              <Text style={[s.desc, { color: t.color, fontFamily: 'PressStart2P', fontSize: 7 }]}>{t.label.toUpperCase()}</Text>
              <Text style={s.desc}>{t.sessions} runs · {t.totalDistanceMi} mi</Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${t.percent}%`, backgroundColor: t.color }]} />
            </View>
          </View>
        ))}
      </View>
    </View>

    {/* Personal Records */}
    {(prs.longestRun || prs.fastestPace || prs.farthestRun) && (
      <View style={[s.panel, { borderColor: 'rgba(236,72,153,0.4)' }]}>
        <Text style={s.sect}>PERSONAL RECORDS</Text>
        <View style={s.statsRow}>
          {[
            prs.farthestRun && { v: `${prs.farthestRun.distanceMi}`, l: 'FARTHEST (MI)' },
            prs.longestRun && { v: formatDuration(prs.longestRun.elapsedS), l: 'LONGEST RUN' },
            prs.fastestPace && { v: `${prs.fastestPace.paceMinPerMi}`, l: 'BEST PACE' },
          ].filter(Boolean).map((st, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.statItem}><Text style={[s.statVal, { color: '#ec4899' }]}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
            </React.Fragment>
          ))}
        </View>
      </View>
    )}

    {/* Score Trend */}
    {data.scoreTrend.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={data.scoreTrend} color="#ec4899" maxVal={maxScore} label="STAMINA SCORE TREND" />
      </View>
    )}

    {/* Distance Trend */}
    {data.distanceTrend.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={data.distanceTrend} color="#f472b6" maxVal={Math.max(...data.distanceTrend.map((d) => d.value), 0.1)} label="DISTANCE TREND (MILES)" />
      </View>
    )}

    {/* 7-Day Forecast */}
    {fc && (
      <View style={[s.panel, { borderColor: 'rgba(236,72,153,0.5)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>7-DAY FORECAST</Text>
          <View style={[s.badge, { borderColor: '#ec4899' }]}><Text style={[s.badgeText, { color: '#ec4899' }]}>STM</Text></View>
        </View>
        <View style={s.forecastRow}>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>NOW</Text>
            <Text style={[s.forecastLevel, { color: '#ec4899' }]}>LV {fc.currentLevel}</Text>
            <Text style={s.forecastRank}>{fc.currentRank}</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="trending-flat" size={28} color={fc.levelsGained > 0 ? '#22c55e' : '#64748b'} />
            {fc.levelsGained > 0 && <Text style={s.forecastGain}>+{fc.levelsGained}</Text>}
          </View>
          <View style={s.forecastBlock}>
            <Text style={s.forecastSmall}>IN 7 DAYS</Text>
            <Text style={[s.forecastLevel, { color: fc.levelsGained > 0 ? '#22c55e' : '#ec4899' }]}>LV {fc.projectedLevel}</Text>
            <Text style={s.forecastRank}>{fc.projectedRank}</Text>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.desc}>XP: {fc.xpInCurrentLevel} / {fc.xpToNextLevel}</Text>
            <Text style={s.desc}>{fc.avgXpPerDay} XP/day avg</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, fc.xpToNextLevel > 0 ? (fc.xpInCurrentLevel / fc.xpToNextLevel) * 100 : 0)}%`, backgroundColor: '#ec4899' }]} />
          </View>
        </View>
        <ForecastGraph fc={fc} color="#ec4899" />
        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

/* ═══════════════════════════════════════════════════
   RECOVERY VIEW (cross-stat interactions)
   ═══════════════════════════════════════════════════ */

const STAT_ICONS = { STR: 'fitness-center', DEX: 'self-improvement', SPD: 'directions-run', STM: 'favorite', INT: 'psychology' };
const STAT_COLORS = { STR: '#ef4444', DEX: '#f97316', SPD: '#f59e0b', STM: '#ec4899', INT: '#818cf8' };

const RecoveryView = ({ data }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="monitor-heart" size={40} color="#64748b" />
      <Text style={s.noTitle}>NO RECOVERY DATA</Text>
      <Text style={s.noText}>Log sleep and training sessions to see cross-stat recovery analysis.</Text>
    </View>
  );

  const { readiness, overtraining, xpModifiers, sleep, nutrition, bdnf, insights, recommendedFocus } = data;

  return (<>
    {/* Overtraining Risk */}
    <View style={[s.panel, { borderColor: overtraining.color + '80' }]}>
      <View style={s.row}>
        <Text style={s.sect}>OVERTRAINING RISK</Text>
        <View style={[s.badge, { borderColor: overtraining.color }]}>
          <Text style={[s.badgeText, { color: overtraining.color }]}>{overtraining.risk}</Text>
        </View>
      </View>
      <View style={s.statsRow}>
        {[
          { v: `${overtraining.totalSessions}`, l: 'SESSIONS/7D' },
          { v: `${overtraining.consecutiveDays}`, l: 'CONSEC DAYS' },
          { v: `${overtraining.sleepDebt}h`, l: 'SLEEP DEBT' },
          { v: `${overtraining.loadIndex}`, l: 'LOAD INDEX' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
      {overtraining.factors.length > 0 && (
        <View style={{ gap: 2, marginTop: 4 }}>
          {overtraining.factors.map((f, i) => (
            <Text key={i} style={[s.desc, { color: overtraining.color }]}>{'\u26A0'} {f}</Text>
          ))}
        </View>
      )}
    </View>

    {/* Recovery Readiness Per Stat */}
    <View style={s.panel}>
      <Text style={s.sect}>STAT READINESS</Text>
      <View style={{ gap: 10, marginTop: 4 }}>
        {['STR', 'DEX', 'SPD', 'STM', 'INT'].map((stat) => {
          const r = readiness[stat];
          if (!r) return null;
          return (
            <View key={stat} style={{ gap: 3 }}>
              <View style={s.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name={STAT_ICONS[stat]} size={16} color={STAT_COLORS[stat]} />
                  <Text style={[s.desc, { color: STAT_COLORS[stat], fontFamily: 'PressStart2P', fontSize: 8 }]}>{stat}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.desc, { color: r.color }]}>{r.status}</Text>
                  <Text style={[s.statVal, { fontSize: 20, color: r.color }]}>{r.score}%</Text>
                </View>
              </View>
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${r.score}%`, backgroundColor: r.color }]} />
              </View>
              <View style={s.row}>
                <Text style={[s.desc, { fontSize: 14 }]}>
                  {r.hoursSinceLast < 999 ? `Last trained ${r.hoursSinceLast}h ago` : 'No sessions logged'}
                </Text>
                <Text style={[s.desc, { fontSize: 14 }]}>
                  {r.inSupercomp ? 'IN SUPERCOMP WINDOW' : `Window: ${r.supercompWindow}`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>

    {/* Recommended Focus */}
    {recommendedFocus?.length > 0 && (
      <View style={[s.panel, { borderColor: 'rgba(34,197,94,0.4)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>TRAIN TODAY</Text>
          <View style={[s.badge, { borderColor: '#22c55e' }]}>
            <Text style={[s.badgeText, { color: '#22c55e' }]}>FOCUS</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
          {recommendedFocus.map((f) => (
            <View key={f.stat} style={[s.recCard, { borderColor: STAT_COLORS[f.stat] + '60' }]}>
              <MaterialIcons name={STAT_ICONS[f.stat]} size={24} color={STAT_COLORS[f.stat]} />
              <Text style={[s.recLabel, { color: STAT_COLORS[f.stat] }]}>{f.stat}</Text>
              <Text style={s.recTime}>{f.score}% ready</Text>
              <Text style={[s.desc, { fontSize: 12, textAlign: 'center' }]}>{f.status}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    )}

    {/* XP Modifiers */}
    <View style={[s.panel, { borderColor: 'rgba(168,85,247,0.4)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>ACTIVE XP MODIFIERS</Text>
        <View style={[s.badge, { borderColor: '#a855f7' }]}>
          <Text style={[s.badgeText, { color: '#a855f7' }]}>CROSS-STAT</Text>
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 4 }}>
        {['STR', 'DEX', 'SPD', 'STM', 'INT'].map((stat) => {
          const mod = xpModifiers[stat];
          if (!mod) return null;
          const hasMods = mod.factors.length > 0;
          const multColor = mod.finalMult >= 1.05 ? '#22c55e' : mod.finalMult <= 0.95 ? '#ef4444' : '#94a3b8';
          return (
            <View key={stat} style={{ gap: 2 }}>
              <View style={s.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name={STAT_ICONS[stat]} size={14} color={STAT_COLORS[stat]} />
                  <Text style={[s.desc, { color: '#e2e8f0' }]}>{stat} XP</Text>
                </View>
                <Text style={[s.statVal, { fontSize: 22, color: multColor }]}>
                  {mod.finalMult > 1 ? '+' : ''}{Math.round((mod.finalMult - 1) * 100)}%
                </Text>
              </View>
              {hasMods && mod.factors.map((f, i) => (
                <Text key={i} style={[s.desc, { fontSize: 14, paddingLeft: 22 }]}>
                  {f.mult >= 1 ? '+' : ''}{Math.round((f.mult - 1) * 100)}% {f.label}: {f.detail}
                </Text>
              ))}
              {!hasMods && <Text style={[s.desc, { fontSize: 14, paddingLeft: 22 }]}>No active modifiers</Text>}
            </View>
          );
        })}
      </View>
    </View>

    {/* Sleep & Nutrition Context */}
    <View style={s.panel}>
      <Text style={s.sect}>CONTEXT</Text>
      <View style={s.statsRow}>
        {[
          { v: sleep.hours != null ? `${sleep.hours}h` : '—', l: 'LAST SLEEP' },
          { v: sleep.label || '—', l: 'STATUS' },
          { v: sleep.weeklyDebt != null ? `${sleep.weeklyDebt}h` : '—', l: 'SLEEP DEBT' },
          { v: nutrition.hasData ? `${Math.round(nutrition.proteinRatio * 100)}%` : '—', l: 'PROTEIN' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
      {bdnf.mult > 1.0 && (
        <View style={[s.trendBadge, { borderColor: '#22c55e40', backgroundColor: '#22c55e10', marginTop: 4 }]}>
          <MaterialIcons name="psychology" size={14} color="#22c55e" />
          <Text style={[s.desc, { color: '#22c55e' }]}>
            BDNF active — INT XP +{Math.round((bdnf.mult - 1) * 100)}% ({bdnf.chronicDays} training days this week)
          </Text>
        </View>
      )}
    </View>

    {/* Cross-Stat Insights */}
    {insights?.length > 0 && (
      <View style={[s.panel, s.insightP]}>
        <View style={s.insightH}>
          <MaterialIcons name="auto-awesome" size={18} color="#fbbf24" />
          <Text style={s.sect}>CROSS-STAT INSIGHTS</Text>
        </View>
        {insights.map((ins, i) => {
          const icon = ins.type === 'warning' ? '\u26A0' : ins.type === 'positive' ? '\u2705' : ins.type === 'tip' ? '\u{1F4A1}' : '\u2139';
          return <Text key={i} style={s.insightT}>{icon} {ins.text}</Text>;
        })}
      </View>
    )}
  </>);
};

/* ═══════════════════════════════════════════════════
   TRENDS VIEW
   ═══════════════════════════════════════════════════ */

const TrendsView = ({ energy, intData, strData, dexData, spdData, stmData }) => {
  const hasEnergy = energy?.hasData;
  const hasInt = intData?.hasData;
  const hasStr = strData?.hasData;
  const hasDex = dexData?.hasData;
  const hasSpd = spdData?.hasData;
  const hasStm = stmData?.hasData;

  if (!hasEnergy && !hasInt && !hasStr && !hasDex && !hasSpd && !hasStm) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="trending-up" size={40} color="#64748b" />
      <Text style={s.noTitle}>NO TREND DATA</Text>
      <Text style={s.noText}>Log sleep, take quizzes, or train to see your trends.</Text>
    </View>
  );

  // Build combined 7-day view
  const intTrend = intData?.trend || [];
  const last7Int = intTrend.slice(-7);
  const scoreData = last7Int.map((d) => ({ value: d.intScore, label: d.date.slice(5) }));

  const strScoreData = strData?.scoreTrend?.slice(-7) || [];

  // Count tracked stats
  const trackedCount = [hasEnergy, hasInt, hasStr, hasDex, hasSpd, hasStm].filter(Boolean).length;

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
            <Text style={s.desc}>Method: {energy.method?.toUpperCase()} {'\u00B7'} {energy.confidence}</Text>
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
            <Text style={s.desc}>Accuracy: {intData.overallAccuracy}% {'\u00B7'} {intData.streak} day streak</Text>
            <Text style={s.desc}>{intData.totalQuizzes} quizzes completed</Text>
          </View>
        </View>
      </View>
    )}

    {/* STR Summary */}
    {hasStr && (
      <View style={s.panel}>
        <Text style={s.sect}>STR TODAY</Text>
        <View style={s.trendRow}>
          <View style={[s.trendCircle, { borderColor: '#ef4444' }]}>
            <Text style={[s.trendVal, { color: '#ef4444' }]}>LV{strData.forecast?.currentLevel || 1}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.energyLabel, { color: '#ef4444' }]}>{strData.forecast?.currentRank || 'NOVICE'}</Text>
            <Text style={s.desc}>{strData.frequency.sessionsLast7} sessions {'\u00B7'} {strData.frequency.setsLast7} sets (7d)</Text>
            <Text style={s.desc}>{strData.totalSessions} total workouts {'\u00B7'} {strData.frequency.streak} day streak</Text>
          </View>
        </View>
      </View>
    )}

    {/* Body Part Distribution (compact) */}
    {hasStr && (
      <View style={s.panel}>
        <Text style={s.sect}>MUSCLE VOLUME (14D)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {strData.volumeByPart.filter((bp) => bp.sets > 0).map((bp) => (
            <View key={bp.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: bp.color + '40', backgroundColor: bp.color + '10' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bp.color }} />
              <Text style={[s.desc, { color: bp.color }]}>{bp.label}</Text>
              <Text style={[s.desc, { color: '#94a3b8' }]}>{bp.sets}s</Text>
            </View>
          ))}
        </View>
      </View>
    )}

    {/* Combined Charts */}
    {hasInt && scoreData.length > 0 && (
      <View style={s.panel}>
        <MiniLineChart data={scoreData} color="#818cf8" label="INT SCORE (7 DAYS)" />
      </View>
    )}

    {hasStr && strScoreData.length > 1 && (
      <View style={s.panel}>
        <MiniLineChart data={strScoreData} color="#ef4444" maxVal={Math.max(...strScoreData.map((d) => d.value), 1)} label="STR SCORE (7 DAYS)" />
      </View>
    )}

    {/* DEX Summary */}
    {hasDex && (
      <View style={s.panel}>
        <Text style={s.sect}>DEX TODAY</Text>
        <View style={s.trendRow}>
          <View style={[s.trendCircle, { borderColor: '#f97316' }]}>
            <Text style={[s.trendVal, { color: '#f97316' }]}>LV{dexData.forecast?.currentLevel || 1}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.energyLabel, { color: '#f97316' }]}>{dexData.forecast?.currentRank || 'NOVICE'}</Text>
            <Text style={s.desc}>{dexData.frequency.sessionsLast7} sessions {'\u00B7'} {dexData.frequency.stretchesLast7} stretches (7d)</Text>
            <Text style={s.desc}>{dexData.totalSessions} total sessions {'\u00B7'} {dexData.frequency.streak} day streak</Text>
          </View>
        </View>
      </View>
    )}

    {hasDex && (() => {
      const dexScoreData = dexData.scoreTrend?.slice(-7) || [];
      return dexScoreData.length > 1 ? (
        <View style={s.panel}>
          <MiniLineChart data={dexScoreData} color="#f97316" maxVal={Math.max(...dexScoreData.map((d) => d.value), 1)} label="DEX SCORE (7 DAYS)" />
        </View>
      ) : null;
    })()}

    {/* SPD Summary */}
    {hasSpd && (
      <View style={s.panel}>
        <Text style={s.sect}>SPD TODAY</Text>
        <View style={s.trendRow}>
          <View style={[s.trendCircle, { borderColor: '#f59e0b' }]}>
            <Text style={[s.trendVal, { color: '#f59e0b' }]}>LV{spdData.forecast?.currentLevel || 1}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.energyLabel, { color: '#f59e0b' }]}>{spdData.forecast?.currentRank || 'NOVICE'}</Text>
            <Text style={s.desc}>{spdData.frequency.sessionsLast7} sessions {'\u00B7'} {spdData.frequency.xpLast7} XP (7d)</Text>
            <Text style={s.desc}>{spdData.totalSessions} total sessions {'\u00B7'} {spdData.frequency.streak} day streak</Text>
          </View>
        </View>
      </View>
    )}

    {hasSpd && (() => {
      const spdScoreData = spdData.scoreTrend?.slice(-7) || [];
      return spdScoreData.length > 1 ? (
        <View style={s.panel}>
          <MiniLineChart data={spdScoreData} color="#f59e0b" maxVal={Math.max(...spdScoreData.map((d) => d.value), 1)} label="SPD SCORE (7 DAYS)" />
        </View>
      ) : null;
    })()}

    {/* STM Summary */}
    {hasStm && (
      <View style={s.panel}>
        <Text style={s.sect}>STM TODAY</Text>
        <View style={s.trendRow}>
          <View style={[s.trendCircle, { borderColor: '#ec4899' }]}>
            <Text style={[s.trendVal, { color: '#ec4899' }]}>LV{stmData.forecast?.currentLevel || 1}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.energyLabel, { color: '#ec4899' }]}>{stmData.forecast?.currentRank || 'NOVICE'}</Text>
            <Text style={s.desc}>{stmData.frequency.sessionsLast7} runs {'\u00B7'} {stmData.frequency.milesLast7} mi {'\u00B7'} {stmData.frequency.xpLast7} XP (7d)</Text>
            <Text style={s.desc}>{stmData.totalSessions} total runs {'\u00B7'} {stmData.frequency.streak} day streak</Text>
          </View>
        </View>
      </View>
    )}

    {hasStm && (() => {
      const stmScoreData = stmData.scoreTrend?.slice(-7) || [];
      return stmScoreData.length > 1 ? (
        <View style={s.panel}>
          <MiniLineChart data={stmScoreData} color="#ec4899" maxVal={Math.max(...stmScoreData.map((d) => d.value), 1)} label="STM SCORE (7 DAYS)" />
        </View>
      ) : null;
    })()}

    {/* Insight */}
    <View style={[s.panel, s.insightP]}>
      <View style={s.insightH}><MaterialIcons name="auto-awesome" size={18} color="#fbbf24" /><Text style={s.sect}>OVERVIEW</Text></View>
      {hasEnergy && <Text style={s.insightT}>{'\u2022'} Energy: {energy.energyScore}/100 ({energy.confidence})</Text>}
      {hasInt && <Text style={s.insightT}>{'\u2022'} INT: {intData.todayScore}/100 ({intData.streak} day streak)</Text>}
      {hasStr && <Text style={s.insightT}>{'\u2022'} STR: Level {strData.forecast?.currentLevel} ({strData.forecast?.currentRank}) {'\u00B7'} {strData.frequency.xpLast7} XP this week</Text>}
      {hasStr && !strData.balance.balanced && <Text style={s.insightT}>{'\u2022'} Muscle imbalance detected — check STR tab for details.</Text>}
      {hasDex && <Text style={s.insightT}>{'\u2022'} DEX: Level {dexData.forecast?.currentLevel} ({dexData.forecast?.currentRank}) {'\u00B7'} {dexData.frequency.xpLast7} XP this week</Text>}
      {hasDex && !dexData.balance.balanced && <Text style={s.insightT}>{'\u2022'} Flexibility imbalance — check DEX tab for details.</Text>}
      {hasSpd && <Text style={s.insightT}>{'\u2022'} SPD: Level {spdData.forecast?.currentLevel} ({spdData.forecast?.currentRank}) {'\u00B7'} {spdData.frequency.xpLast7} XP this week</Text>}
      {hasStm && <Text style={s.insightT}>{'\u2022'} STM: Level {stmData.forecast?.currentLevel} ({stmData.forecast?.currentRank}) {'\u00B7'} {stmData.frequency.xpLast7} XP this week</Text>}
      <Text style={s.insightT}>{'\u2022'} {trackedCount >= 6 ? 'All stats tracked — complete athlete!' : trackedCount >= 4 ? 'Great coverage — add more stats for full picture.' : trackedCount >= 2 ? 'Good start — keep logging to unlock combined insights.' : 'Log more data to unlock combined insights.'}</Text>
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
  tabBar: { backgroundColor: '#111827', borderBottomWidth: 1, borderBottomColor: 'rgba(37,123,244,0.25)', maxHeight: 44 },
  tabBarContent: { paddingHorizontal: 8 },
  tab: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  tabText: { color: '#475569', fontFamily: 'PressStart2P', fontSize: 7 },
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
