import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { MlPredictionPanel } from './analyticsHelpers';
import { MiniLineChart, ForecastGraph } from './analyticsCharts';
import { FLEX_ZONES } from '../../config/dexConstants';
import { typography } from '../../theme/typography';

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
              <Text style={[s.desc, { color: z.color, fontFamily: typography.family.pixel, fontSize: 9 }]}>{z.label.toUpperCase()}</Text>
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

        <ForecastGraph fc={fc} color="#f97316" />

        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

export default DexView;
