import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { STAT_ICONS, STAT_COLORS } from './analyticsHelpers';
import { colors } from '../../theme/colors';
import { typography, spacing } from '../../theme/typography';

const RecoveryView = ({ data }) => {
  if (!data?.hasData) return (
    <View style={[s.panel, s.centerPanel]}>
      <MaterialIcons name="monitor-heart" size={40} color={colors.textTertiary} />
      <Text style={s.noTitle}>NO RECOVERY DATA</Text>
      <Text style={s.noText}>Log sleep and training sessions to see cross-stat recovery analysis.</Text>
    </View>
  );

  const { readiness, overtraining, xpModifiers, sleep, nutrition, bdnf, insights, recommendedFocus } = data;
  const [expandedStat, setExpandedStat] = useState(null);

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
          { v: `${overtraining.loadIndex}`, l: 'INTENSITY' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
      {overtraining.factors.length > 0 && (
        <View style={{ gap: spacing.valueLabelGap, marginTop: spacing.xs }}>
          {overtraining.factors.map((f, i) => (
            <Text key={i} style={[s.desc, { color: overtraining.color }]}>{'\u26A0'} {f}</Text>
          ))}
        </View>
      )}
    </View>

    {/* Recovery Readiness Per Stat */}
    <View style={s.panel}>
      <Text style={s.sect}>STAT READINESS</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {['STR', 'DEX', 'SPD', 'STM', 'INT'].map((stat) => {
          const r = readiness[stat];
          if (!r) return null;
          const hasMuscleGroups = stat === 'STR' && r.muscleGroups && Object.keys(r.muscleGroups).length > 0;
          const isExpanded = expandedStat === stat;

          return (
            <View key={stat} style={{ gap: spacing.xs }}>
              <Pressable onPress={() => hasMuscleGroups && setExpandedStat(isExpanded ? null : stat)}>
                <View style={s.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <MaterialIcons name={STAT_ICONS[stat]} size={16} color={STAT_COLORS[stat]} />
                    <Text style={[s.desc, { color: STAT_COLORS[stat], fontFamily: typography.family.pixel, fontSize: typography.size.sm }]}>{stat}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={[s.desc, { color: r.color }]}>{r.status}</Text>
                    <Text style={[s.statVal, { color: r.color }]}>{r.score}%</Text>
                    {hasMuscleGroups && (
                      <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textSecondary} />
                    )}
                  </View>
                </View>
              </Pressable>
              <View style={s.bar}>
                <View style={[s.barFill, { width: `${r.score}%`, backgroundColor: r.color }]} />
              </View>
              <View style={s.row}>
                <Text style={s.desc}>
                  {r.hoursSinceLast < 999 ? `Last trained ${r.hoursSinceLast}h ago` : 'No sessions logged'}
                </Text>
                <Text style={s.desc}>
                  {r.inSupercomp ? 'PEAK RECOVERY' : `Recovery: ${r.supercompWindow}`}
                </Text>
              </View>
              {r.legInterference && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <MaterialIcons name="warning" size={14} color="#f59e0b" />
                  <Text style={[s.desc, { color: '#f59e0b' }]}>{r.legInterference}</Text>
                </View>
              )}

              {/* STR: per-muscle-group readiness (dropdown) */}
              {hasMuscleGroups && isExpanded && (
                <View style={{ gap: spacing.sm, marginTop: spacing.xs, paddingLeft: spacing.xl, borderLeftWidth: 2, borderLeftColor: STAT_COLORS.STR + '40' }}>
                  {Object.entries(r.muscleGroups).map(([part, mg]) => (
                    <View key={part} style={{ gap: spacing.valueLabelGap }}>
                      <View style={s.row}>
                        <Text style={[s.desc, { color: colors.textPrimary }]}>{part}</Text>
                        <Text style={[s.desc, { color: mg.color }]}>{mg.score}% {mg.status}</Text>
                      </View>
                      <View style={[s.bar, { height: 4 }]}>
                        <View style={[s.barFill, { width: `${mg.score}%`, backgroundColor: mg.color }]} />
                      </View>
                      <Text style={[s.desc, { color: colors.textTertiary }]}>
                        {mg.hoursSinceLast < 999 ? `Trained ${mg.hoursSinceLast}h ago` : 'Not trained recently'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
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
              <Text style={[s.desc, { textAlign: 'center' }]}>{f.status}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    )}

    {/* XP Modifiers */}
    <View style={[s.panel, { borderColor: 'rgba(168,85,247,0.4)' }]}>
      <View style={s.row}>
        <Text style={s.sect}>XP BONUSES & PENALTIES</Text>
        <View style={[s.badge, { borderColor: '#a855f7' }]}>
          <Text style={[s.badgeText, { color: '#a855f7' }]}>ACTIVE</Text>
        </View>
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {['STR', 'DEX', 'SPD', 'STM', 'INT'].map((stat) => {
          const mod = xpModifiers[stat];
          if (!mod) return null;
          const hasMods = mod.factors.length > 0;
          const multColor = mod.finalMult >= 1.05 ? '#22c55e' : mod.finalMult <= 0.95 ? '#ef4444' : colors.textSecondary;
          return (
            <View key={stat} style={{ gap: spacing.valueLabelGap }}>
              <View style={s.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name={STAT_ICONS[stat]} size={14} color={STAT_COLORS[stat]} />
                  <Text style={[s.desc, { color: colors.textPrimary }]}>{stat} XP</Text>
                </View>
                <Text style={[s.statVal, { fontSize: typography.size.xl, color: multColor }]}>
                  {mod.finalMult > 1 ? '+' : ''}{Math.round((mod.finalMult - 1) * 100)}%
                </Text>
              </View>
              {hasMods && mod.factors.map((f, i) => (
                <Text key={i} style={[s.desc, { paddingLeft: spacing.xl }]}>
                  {f.mult >= 1 ? '+' : ''}{Math.round((f.mult - 1) * 100)}% {f.label}: {f.detail}
                </Text>
              ))}
              {!hasMods && <Text style={[s.desc, { paddingLeft: spacing.xl }]}>No active modifiers</Text>}
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
          { v: sleep.hours != null && sleep.hours > 0 ? `${sleep.hours}h` : '\u2014', l: 'LAST SLEEP' },
          { v: sleep.weeklyDebt != null ? `${sleep.weeklyDebt}h` : '\u2014', l: 'SLEEP DEBT' },
          { v: nutrition.hasData ? `${Math.round(nutrition.proteinRatio * 100)}%` : 'N/A', l: nutrition.hasData ? 'PROTEIN' : 'NO MEALS' },
        ].map((st, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statItem}><Text style={s.statVal}>{st.v}</Text><Text style={s.statLbl}>{st.l}</Text></View>
          </React.Fragment>
        ))}
      </View>
      {/* Sleep status on its own full-width row */}
      <View style={{ gap: spacing.valueLabelGap }}>
        <Text style={s.statLbl}>SLEEP STATUS</Text>
        <Text style={[s.desc, { color: sleep.label === 'ADEQUATE' || sleep.label === 'OPTIMAL' || sleep.label === 'EXTENDED' ? '#22c55e' : sleep.label === 'SUBOPTIMAL' ? '#f59e0b' : '#ef4444' }]}>{sleep.label || '\u2014'}</Text>
      </View>
      {bdnf.mult > 1.0 && (
        <View style={[s.trendBadge, { borderColor: '#22c55e40', backgroundColor: '#22c55e10', marginTop: spacing.xs }]}>
          <MaterialIcons name="psychology" size={14} color="#22c55e" style={{ marginTop: 2 }} />
          <Text style={[s.desc, { color: '#22c55e', flex: 1 }]}>
            Brain Boost active {'\u2014'} INT XP +{Math.round((bdnf.mult - 1) * 100)}% ({bdnf.chronicDays} training days this week)
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

export default RecoveryView;
