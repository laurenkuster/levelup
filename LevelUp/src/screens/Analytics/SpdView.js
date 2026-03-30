import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { MlPredictionPanel } from './analyticsHelpers';
import { MiniLineChart, ForecastGraph } from './analyticsCharts';
import { SPD_METRICS } from '../../config/spdConstants';
import { colors } from '../../theme/colors';
import { typography, spacing } from '../../theme/typography';

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
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {data.volumeByType.map((t) => (
          <View key={t.key} style={{ gap: 3 }}>
            <View style={s.row}>
              <Text style={[s.desc, { color: t.color, fontFamily: typography.family.pixel, fontSize: typography.size.xs }]}>{t.label.toUpperCase()}</Text>
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
            <View key={pr.sessionId || i} style={[s.row, { paddingVertical: spacing.xs, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(71,85,105,0.15)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                <Text style={[s.desc, { color: colors.textTertiary, width: 18 }]}>#{i + 1}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: typeInfo?.color || '#f59e0b' }} />
                <Text style={[s.desc, { color: colors.textPrimary }]}>{pr.date}</Text>
              </View>
              <Text style={[s.statVal, { fontSize: typography.size.xl }]}>{pr.maxSpeed} <Text style={{ fontSize: typography.size.md, color: colors.textTertiary }}>mph</Text></Text>
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
        <View style={{ gap: spacing.xs }}>
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
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

export default SpdView;
