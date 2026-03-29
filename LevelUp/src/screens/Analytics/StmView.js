import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { MlPredictionPanel, formatDuration } from './analyticsHelpers';
import { MiniLineChart, ForecastGraph } from './analyticsCharts';
import { typography } from '../../theme/typography';

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
              <Text style={[s.desc, { color: t.color, fontFamily: typography.family.pixel, fontSize: 9 }]}>{t.label.toUpperCase()}</Text>
              <Text style={s.desc}>{t.sessions} runs {'\u00B7'} {t.totalDistanceMi} mi</Text>
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

export default StmView;
