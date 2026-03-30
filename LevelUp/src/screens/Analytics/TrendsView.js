import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/typography';
import { scoreColor, scoreLabel } from './analyticsHelpers';
import { MiniLineChart } from './analyticsCharts';

const TrendsView = ({ energy, intData, strData, dexData, spdData, stmData }) => {
  const hasEnergy = energy?.hasData;
  const hasInt = intData?.hasData;
  const hasStr = strData?.hasData;
  const hasDex = dexData?.hasData;
  const hasSpd = spdData?.hasData;
  const hasStm = stmData?.hasData;

  if (!hasEnergy && !hasInt && !hasStr && !hasDex && !hasSpd && !hasStm) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="trending-up" size={40} color={colors.textTertiary} />
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
          <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
            <Text style={[s.energyLabel, { color: scoreColor(energy.energyScore) }]}>{scoreLabel(energy.energyScore)}</Text>
            <Text style={s.desc}>Confidence: {energy.confidence}</Text>
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
          <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
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
          <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
          {strData.volumeByPart.filter((bp) => bp.sets > 0).map((bp) => (
            <View key={bp.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: bp.color + '40', backgroundColor: bp.color + '10' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bp.color }} />
              <Text style={[s.desc, { color: bp.color }]}>{bp.label}</Text>
              <Text style={[s.desc, { color: colors.textSecondary }]}>{bp.sets}s</Text>
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
          <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
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
          <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
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
          <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
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
      {hasEnergy && <Text style={s.insightT}>{'\u2022'} Energy: {energy.energyScore}/100</Text>}
      {hasInt && <Text style={s.insightT}>{'\u2022'} INT: {intData.todayScore}/100 ({intData.streak} day streak)</Text>}
      {hasStr && <Text style={s.insightT}>{'\u2022'} STR: Level {strData.forecast?.currentLevel} ({strData.forecast?.currentRank}) {'\u00B7'} {strData.frequency.xpLast7} XP this week</Text>}
      {hasStr && !strData.balance.balanced && <Text style={s.insightT}>{'\u2022'} Muscle imbalance detected {'\u2014'} check STR tab for details.</Text>}
      {hasDex && <Text style={s.insightT}>{'\u2022'} DEX: Level {dexData.forecast?.currentLevel} ({dexData.forecast?.currentRank}) {'\u00B7'} {dexData.frequency.xpLast7} XP this week</Text>}
      {hasDex && !dexData.balance.balanced && <Text style={s.insightT}>{'\u2022'} Flexibility imbalance {'\u2014'} check DEX tab for details.</Text>}
      {hasSpd && <Text style={s.insightT}>{'\u2022'} SPD: Level {spdData.forecast?.currentLevel} ({spdData.forecast?.currentRank}) {'\u00B7'} {spdData.frequency.xpLast7} XP this week</Text>}
      {hasStm && <Text style={s.insightT}>{'\u2022'} STM: Level {stmData.forecast?.currentLevel} ({stmData.forecast?.currentRank}) {'\u00B7'} {stmData.frequency.xpLast7} XP this week</Text>}
      <Text style={s.insightT}>{'\u2022'} {trackedCount >= 6 ? 'All stats tracked \u2014 complete athlete!' : trackedCount >= 4 ? 'Great coverage \u2014 add more stats for full picture.' : trackedCount >= 2 ? 'Good start \u2014 keep logging to unlock combined insights.' : 'Log more data to unlock combined insights.'}</Text>
    </View>
  </>);
};

export default TrendsView;
