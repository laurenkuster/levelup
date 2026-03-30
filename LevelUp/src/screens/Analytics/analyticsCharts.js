import React from 'react';
import { View, ScrollView, Text, Dimensions } from 'react-native';
import Svg, { Polyline, Rect, Line, Text as SvgText, Circle } from 'react-native-svg';
import s from './analyticsStyles';
import { colors } from '../../theme/colors';
import { typography, spacing } from '../../theme/typography';

const SW = Dimensions.get('window').width;
const CHART_W = 960;
const CH = 180;
const CP = { top: 10, right: 16, bottom: 30, left: 36 };

/* -------------------------------------------------------
   EnergyGraph (SVG)
   ------------------------------------------------------- */

export const EnergyGraph = ({ curve, recommendations, currentMinute }) => {
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
    xLabels.push(<SvgText key={`x${i}`} x={x} y={CH-4} fill={colors.textTertiary} fontSize={typography.size.xs} fontFamily="monospace" textAnchor="middle">{lbl}</SvgText>);
  }

  const yLabels = [0,25,50,75,100].map((v) => {
    const y = CP.top + pH - (v / 100) * pH;
    return (<React.Fragment key={`y${v}`}>
      <SvgText x={CP.left-6} y={y+3} fill={colors.textTertiary} fontSize={typography.size.xs} fontFamily="monospace" textAnchor="end">{v}</SvgText>
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

/* -------------------------------------------------------
   MiniLineChart (for INT + Trends)
   ------------------------------------------------------- */

export const MiniLineChart = ({ data, color = '#3B82F6', maxVal = 100, height = 120, label = '' }) => {
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
            <SvgText x={pad.left-4} y={y+3} fill={colors.textTertiary} fontSize={8} fontFamily="monospace" textAnchor="end">{v}</SvgText>
          </React.Fragment>);
        })}
        {/* Line */}
        <Polyline points={polyStr} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {/* Dots + labels */}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={3} fill={color} />
            {i % step === 0 && <SvgText x={p.x} y={height-4} fill={colors.textTertiary} fontSize={7} fontFamily="monospace" textAnchor="middle">
              {p.label || ''}
            </SvgText>}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

/* -------------------------------------------------------
   ForecastGraph — shared by STR, DEX, SPD, STM
   ------------------------------------------------------- */

export const ForecastGraph = ({ fc, color }) => {
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
    <View style={{ marginTop: spacing.xs }}>
      <Text style={s.miniChartLabel}>XP TIMELINE: ACTUAL + FORECAST</Text>
      <Svg width={fW} height={fH}>
        <Line x1={fPad.left} y1={fPad.top + fpH} x2={fW - fPad.right} y2={fPad.top + fpH} stroke="rgba(71,85,105,0.3)" strokeWidth={0.5} />
        <Line x1={fPad.left} y1={fPad.top + fpH / 2} x2={fW - fPad.right} y2={fPad.top + fpH / 2} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
        <Line x1={fPad.left} y1={fPad.top} x2={fW - fPad.right} y2={fPad.top} stroke="rgba(71,85,105,0.15)" strokeWidth={0.5} strokeDasharray="3,3" />
        <SvgText x={fPad.left - 4} y={fPad.top + fpH + 3} fill={colors.textTertiary} fontSize={8} fontFamily="monospace" textAnchor="end">{minXp}</SvgText>
        <SvgText x={fPad.left - 4} y={fPad.top + 3} fill={colors.textTertiary} fontSize={8} fontFamily="monospace" textAnchor="end">{maxXp}</SvgText>
        <Line x1={todayX} y1={fPad.top - 4} x2={todayX} y2={fPad.top + fpH + 4} stroke={color + '80'} strokeWidth={1} strokeDasharray="3,2" />
        <SvgText x={todayX} y={fPad.top - 6} fill={color} fontSize={7} fontFamily="monospace" textAnchor="middle">TODAY</SvgText>
        {hPts.length > 1 && <Polyline points={histLine} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />}
        {pPts.length > 0 && <Polyline points={predLine} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" strokeOpacity={0.7} />}
        {hPts.map((p, i) => (
          <React.Fragment key={`h${i}`}>
            <Circle cx={p.x} cy={p.y} r={4} fill={color} />
            {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill={colors.textPrimary} fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
            <SvgText x={p.x} y={fH - 4} fill={colors.textSecondary} fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
          </React.Fragment>
        ))}
        {pPts.map((p, i) => (
          <React.Fragment key={`p${i}`}>
            <Circle cx={p.x} cy={p.y} r={3.5} fill="none" stroke={color} strokeWidth={1.5} />
            {p.dayXp > 0 && <SvgText x={p.x} y={p.y - 8} fill={color + '99'} fontSize={7} fontFamily="monospace" textAnchor="middle">+{p.dayXp}</SvgText>}
            <SvgText x={p.x} y={fH - 4} fill={colors.textTertiary} fontSize={7} fontFamily="monospace" textAnchor="middle">{p.label}</SvgText>
            {p.level > (i > 0 ? pPts[i-1].level : (hPts.length > 0 ? hPts[hPts.length-1].level : fc.currentLevel)) && (
              <SvgText x={p.x} y={p.y - 16} fill="#22c55e" fontSize={8} fontWeight="bold" fontFamily="monospace" textAnchor="middle">LV{p.level}</SvgText>
            )}
          </React.Fragment>
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', gap: spacing.base, marginTop: spacing.valueLabelGap, paddingLeft: fPad.left }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <View style={{ width: 16, height: 2, backgroundColor: color }} />
          <Text style={{ color: colors.textSecondary, fontFamily: typography.family.mono, fontSize: typography.size.md, lineHeight: typography.size.md * typography.lineHeight.normal }}>Actual</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <View style={{ width: 16, height: 2, backgroundColor: color, opacity: 0.5 }} />
          <Text style={{ color: colors.textTertiary, fontFamily: typography.family.mono, fontSize: typography.size.md, lineHeight: typography.size.md * typography.lineHeight.normal }}>Predicted</Text>
        </View>
      </View>
    </View>
  );
};
