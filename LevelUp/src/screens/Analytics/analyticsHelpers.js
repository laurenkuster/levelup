import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import s from './analyticsStyles';
import { colors } from '../../theme/colors';

export const scoreColor = (v) => v >= 75 ? '#22c55e' : v >= 50 ? '#f59e0b' : v >= 25 ? '#f97316' : '#ef4444';
export const scoreLabel = (v) => v >= 80 ? 'EXCELLENT' : v >= 60 ? 'GOOD' : v >= 40 ? 'MODERATE' : 'LOW';
export const CONF_COLORS = { LOW: '#f97316', MEDIUM: '#f59e0b', HIGH: '#22c55e' };

export const ConfidenceDot = ({ confidence }) => (
  <View style={[s.badge, { borderColor: CONF_COLORS[confidence] || colors.textTertiary }]}>
    <Text style={[s.badgeText, { color: CONF_COLORS[confidence] || colors.textTertiary }]}>{confidence}</Text>
  </View>
);

export const RecCard = ({ icon, iconFamily, label, time, color }) => (
  <View style={[s.recCard, { borderColor: color + '40' }]}>
    {iconFamily === 'community'
      ? <MaterialCommunityIcons name={icon} size={20} color={color} />
      : <MaterialIcons name={icon} size={20} color={color} />}
    <Text style={[s.recLabel, { color }]}>{label}</Text>
    <Text style={s.recTime}>{time}</Text>
  </View>
);

export const Leg = ({ color, label }) => (
  <View style={s.legItem}><View style={[s.legDot, { backgroundColor: color }]} /><Text style={s.legText}>{label}</Text></View>
);

export const getRecTime = (r) => r?.start && r?.end ? `${r.start}\u2013${r.end}` : '';

export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

export const MlPredictionPanel = ({ prediction, modelInfo, color, stat }) => {
  if (!prediction) return null;
  const r2Pct = modelInfo?.r2 ? Math.round(modelInfo.r2 * 100) : null;
  const confidence = r2Pct >= 95 ? 'HIGH' : r2Pct >= 85 ? 'GOOD' : r2Pct >= 70 ? 'MODERATE' : 'LOW';
  const confColor = r2Pct >= 95 ? '#22c55e' : r2Pct >= 85 ? '#3b82f6' : r2Pct >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[s.panel, { borderColor: color + '60' }]}>
      <View style={s.row}>
        <Text style={s.sect}>PREDICTION</Text>
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
      </View>
    </View>
  );
};

export const STAT_ICONS = { STR: 'fitness-center', DEX: 'self-improvement', SPD: 'directions-run', STM: 'favorite', INT: 'psychology' };
export const STAT_COLORS = { STR: '#ef4444', DEX: '#f97316', SPD: '#f59e0b', STM: '#ec4899', INT: '#818cf8' };
