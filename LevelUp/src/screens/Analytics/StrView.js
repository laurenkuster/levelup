import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { MlPredictionPanel } from './analyticsHelpers';
import { MiniLineChart, ForecastGraph } from './analyticsCharts';
import { BODY_PARTS } from '../../config/strConstants';
import { colors } from '../../theme/colors';
import { typography, spacing } from '../../theme/typography';

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
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {data.volumeByPart.map((bp) => (
          <View key={bp.key} style={{ gap: 3 }}>
            <View style={s.row}>
              <Text style={[s.desc, { color: bp.color, fontFamily: typography.family.pixel, fontSize: typography.size.xs }]}>{bp.label.toUpperCase()}</Text>
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
        <View style={[s.statsRow, { marginTop: spacing.xs }]}>
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
            <View key={ex.exerciseId} style={[s.row, { paddingVertical: spacing.xs, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(71,85,105,0.15)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                <Text style={[s.desc, { color: colors.textTertiary, width: 18 }]}>#{i + 1}</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bp?.color || '#3B82F6' }} />
                <Text style={[s.desc, { color: colors.textPrimary }]}>{ex.name}</Text>
              </View>
              <Text style={[s.statVal, { fontSize: typography.size.xl }]}>{ex.max1RM} <Text style={{ fontSize: typography.size.md, color: colors.textTertiary }}>lbs</Text></Text>
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

        <View style={{ gap: spacing.xs }}>
          <View style={s.row}>
            <Text style={s.desc}>XP: {fc.xpInCurrentLevel} / {fc.xpToNextLevel}</Text>
            <Text style={s.desc}>{fc.avgXpPerDay} XP/day avg</Text>
          </View>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.min(100, fc.xpToNextLevel > 0 ? (fc.xpInCurrentLevel / fc.xpToNextLevel) * 100 : 0)}%`, backgroundColor: '#ef4444' }]} />
          </View>
        </View>

        <ForecastGraph fc={fc} color="#ef4444" />

        {fc.nudges?.length > 0 && (
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
          </View>
        )}
      </View>
    )}
  </>);
};

export default StrView;
