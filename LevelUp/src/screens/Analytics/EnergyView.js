import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { spacing } from '../../theme/typography';
import { scoreColor, scoreLabel, ConfidenceDot, RecCard, Leg, getRecTime } from './analyticsHelpers';
import { EnergyGraph } from './analyticsCharts';

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
      <View style={s.row}><Text style={s.sect}>TODAY'S ENERGY</Text><ConfidenceDot confidence={m.confidence} /></View>
      <View style={s.scoreRow}>
        <Text style={[s.bigScore, { color: scoreColor(m.energyScore) }]}>{m.energyScore}</Text>
        <View style={{ flex: 1, gap: spacing.valueLabelGap }}>
          <Text style={[s.energyLabel, { color: scoreColor(m.energyScore) }]}>{scoreLabel(m.energyScore)}</Text>
          <Text style={s.desc}>Based on metabolism + last night's sleep</Text>
        </View>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${m.energyScore}%`, backgroundColor: scoreColor(m.energyScore) }]} /></View>
    </View>

    {/* Recovery */}
    <View style={s.panel}>
      <Text style={s.sect}>RECOVERY BREAKDOWN</Text>
      <View style={s.statsRow}>
        {[
          { v: m.features?.recovery_ratio != null ? `${Math.round(m.features.recovery_ratio*100)}%` : '\u2014', l: 'RECOVERY' },
          { v: `${m.features?.last_night_hours || '\u2014'}h`, l: 'LAST NIGHT' },
          { v: `${m.features?.required_hours || '\u2014'}h`, l: 'NEEDED' },
          { v: `${m.features?.bmr || '\u2014'}`, l: 'DAILY BURN' },
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
          <View style={{ marginTop: spacing.valueLabelGap }}>
            {m.foodAnalytics.recommendations.map((rec, i) => (
              <Text key={i} style={s.insightT}>{'\u2022'} {rec}</Text>
            ))}
          </View>
        )}
      </View>
    )}

    {/* Chart */}
    <View style={s.panel}>
      <Text style={s.sect}>24H ENERGY CURVE</Text>
      <Text style={s.hint}>{'\u2190'} Scroll horizontally {'\u2192'}</Text>
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
        {m.insights.map((t,i) => <Text key={i} style={s.insightT}>{'\u2022'} {t}</Text>)}
      </View>
    )}
  </>);
};

export default EnergyView;
