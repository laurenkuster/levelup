import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { scoreColor, scoreLabel } from './analyticsHelpers';
import { MiniLineChart, ForecastGraph } from './analyticsCharts';

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
          <Text style={s.desc}>{data.totalQuizzes} total {'\u00B7'} {data.streak} day streak {'\uD83D\uDD25'}</Text>
        </View>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${data.todayScore}%`, backgroundColor: scoreColor(data.todayScore) }]} /></View>
    </View>

    {/* 7-DAY LEVEL FORECAST */}
    {fc && (
      <View style={[s.panel, { borderColor: 'rgba(168,85,247,0.5)' }]}>
        <View style={s.row}>
          <Text style={s.sect}>7-DAY FORECAST</Text>
          <View style={[s.badge, { borderColor: '#a855f7' }]}>
            <Text style={[s.badgeText, { color: '#a855f7' }]}>INT</Text>
          </View>
        </View>

        {/* Current -> Projected */}
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

        <ForecastGraph fc={fc} color="#a855f7" />

        {/* Nudges */}
        {fc.nudges?.length > 0 && (
          <View style={{ gap: 4, marginTop: 4 }}>
            {fc.nudges.map((n, i) => <Text key={i} style={s.insightT}>{'\u2022'} {n}</Text>)}
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

export default IntView;
