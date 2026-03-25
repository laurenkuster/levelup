/**
 * dexAnalyticsService.js
 *
 * Computes DEX analytics metrics for the Analytics screen.
 *
 * Metrics:
 *   - DEX score trend (14 days)
 *   - Volume distribution by flex zone
 *   - Flexibility balance analysis
 *   - Top stretches by frequency
 *   - Training frequency & consistency
 *   - 7-day DEX level forecast (day-of-week pattern-aware)
 */

import { loadDexLogs, loadDexXP, loadDexHistory } from './dexService';
import { FLEX_ZONES, STRETCH_MAP } from '../config/dexConstants';
import { levelFromTotalXP, levelProgress, xpForNextLevel, xpToReachLevel, rankForLevel } from '../utils/xpSystem';
import { predictStat, getStatModelInfo } from '../ml/statInference';
import { loadData, SYNC_DOCS } from './firestoreSync';

/* ═══════════════════════════════════════════════════
   DAILY AGGREGATES (14 days)
   ═══════════════════════════════════════════════════ */

function buildDailyAggregates(logs, days = 14) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const byDate = {};
  for (const session of logs) {
    const d = session.date;
    if (!d || new Date(d) < cutoff) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(session);
  }

  const dailies = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const sessions = byDate[key] || [];

    const totalStretches = sessions.reduce((s, sess) => s + (sess.stretches?.length || 0), 0);
    const totalXp = sessions.reduce((s, sess) => s + (sess.totalXp || 0), 0);
    const avgScore = sessions.length > 0
      ? Math.round(sessions.reduce((s, sess) => s + (sess.dexScore || 0), 0) / sessions.length)
      : 0;

    dailies.push({
      date: key,
      label: key.slice(5),
      sessions: sessions.length,
      totalStretches,
      totalXp,
      avgScore,
    });
  }

  return dailies;
}

/* ═══════════════════════════════════════════════════
   VOLUME BY FLEX ZONE
   ═══════════════════════════════════════════════════ */

function computeVolumeByZone(logs, days = 14) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const volume = {};
  for (const z of FLEX_ZONES) {
    volume[z.key] = { stretches: 0, totalTime: 0, xp: 0 };
  }

  for (const session of logs) {
    if (!session.date || new Date(session.date) < cutoff) continue;
    if (!session.stretches) continue;

    for (const s of session.stretches) {
      const stretch = STRETCH_MAP[s.stretchId];
      if (!stretch) continue;
      const primaryKey = stretch.primary;
      if (volume[primaryKey]) {
        volume[primaryKey].stretches += 1;
        volume[primaryKey].totalTime += s.duration || 0;
      }
    }

    if (session.distribution) {
      for (const [zKey, zData] of Object.entries(session.distribution)) {
        if (volume[zKey]) volume[zKey].xp += zData.xp || 0;
      }
    }
  }

  const maxStretches = Math.max(...Object.values(volume).map((v) => v.stretches), 1);
  return FLEX_ZONES.map((z) => ({
    key: z.key,
    label: z.label,
    color: z.color,
    stretches: volume[z.key].stretches,
    totalTime: volume[z.key].totalTime,
    xp: volume[z.key].xp,
    percent: Math.round((volume[z.key].stretches / maxStretches) * 100),
  }));
}

/* ═══════════════════════════════════════════════════
   FLEXIBILITY BALANCE
   ═══════════════════════════════════════════════════ */

function analyzeFlexBalance(volumeByZone) {
  const withData = volumeByZone.filter((z) => z.stretches > 0);
  if (withData.length === 0) return { balanced: true, insights: [], weakest: null, strongest: null };

  const avgStretches = withData.reduce((s, z) => s + z.stretches, 0) / FLEX_ZONES.length;
  const sorted = [...volumeByZone].sort((a, b) => b.stretches - a.stretches);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const insights = [];
  const neglected = volumeByZone.filter((z) => z.stretches === 0);
  const undertrained = volumeByZone.filter((z) => z.stretches > 0 && z.stretches < avgStretches * 0.5);

  if (neglected.length > 0 && withData.length > 0) {
    insights.push(`No ${neglected.map((z) => z.label).join(', ')} stretching in the last 14 days.`);
  }
  if (undertrained.length > 0) {
    insights.push(`${undertrained.map((z) => z.label).join(', ')} could use more attention.`);
  }
  if (insights.length === 0 && withData.length >= 4) {
    insights.push('Great flexibility balance across all zones!');
  }

  return {
    balanced: neglected.length <= 1 && undertrained.length === 0,
    insights,
    weakest: weakest.stretches > 0 ? weakest : null,
    strongest,
  };
}

/* ═══════════════════════════════════════════════════
   TOP STRETCHES BY FREQUENCY
   ═══════════════════════════════════════════════════ */

function computeTopStretches(logs) {
  const counts = {};
  for (const session of logs) {
    if (!session.stretches) continue;
    for (const s of session.stretches) {
      const stretch = STRETCH_MAP[s.stretchId];
      if (!stretch) continue;
      if (!counts[s.stretchId]) {
        counts[s.stretchId] = { stretchId: s.stretchId, name: stretch.name, primary: stretch.primary, count: 0, totalTime: 0 };
      }
      counts[s.stretchId].count += 1;
      counts[s.stretchId].totalTime += s.duration || 0;
    }
  }

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/* ═══════════════════════════════════════════════════
   FREQUENCY & CONSISTENCY
   ═══════════════════════════════════════════════════ */

function computeFrequency(dailies) {
  const last7 = dailies.slice(-7);
  const last14 = dailies;

  const sessionsLast7 = last7.reduce((s, d) => s + d.sessions, 0);
  const sessionsLast14 = last14.reduce((s, d) => s + d.sessions, 0);
  const stretchesLast7 = last7.reduce((s, d) => s + d.totalStretches, 0);
  const xpLast7 = last7.reduce((s, d) => s + d.totalXp, 0);

  let streak = 0;
  for (let i = dailies.length - 1; i >= 0; i--) {
    if (dailies[i].sessions > 0) streak++;
    else break;
  }

  return {
    sessionsLast7,
    sessionsLast14,
    stretchesLast7,
    xpLast7,
    streak,
    avgSessionsPerWeek: Math.round(((sessionsLast14 / 14) * 7) * 10) / 10,
  };
}

/* ═══════════════════════════════════════════════════
   7-DAY FORECAST (day-of-week pattern-aware)
   ═══════════════════════════════════════════════════ */

function computeDexForecast(xpData, dailies) {
  const totalXp = xpData.totalXp || 0;
  const currentLevel = levelFromTotalXP(totalXp);
  const currentRank = rankForLevel(currentLevel);

  const last7 = dailies.slice(-7);
  const totalXpLast7 = last7.reduce((s, d) => s + d.totalXp, 0);
  const avgXpPerDay = totalXpLast7 / 7;

  // Score trend
  const recentScores = last7.filter((d) => d.sessions > 0).map((d) => d.avgScore);
  let scoreTrend = 'stable';
  if (recentScores.length >= 3) {
    const half = Math.floor(recentScores.length / 2);
    const avgFirst = recentScores.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const avgSecond = recentScores.slice(half).reduce((s, v) => s + v, 0) / (recentScores.length - half);
    if (avgSecond > avgFirst * 1.05) scoreTrend = 'improving';
    else if (avgSecond < avgFirst * 0.95) scoreTrend = 'declining';
  }

  const trendMult = scoreTrend === 'improving' ? 1.1 : scoreTrend === 'declining' ? 0.9 : 1.0;

  // Day-of-week pattern
  const dowXp = [0, 0, 0, 0, 0, 0, 0];
  const dowCount = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dailies) {
    const dow = new Date(d.date + 'T12:00:00').getDay();
    dowXp[dow] += d.totalXp;
    dowCount[dow] += 1;
  }
  const dowAvg = dowXp.map((total, i) => dowCount[i] > 0 ? total / dowCount[i] : 0);
  const hasDowPattern = dowAvg.some((v) => v > 0);

  // History (past 7 days actual cumulative)
  const history = [];
  let backtrack = 0;
  for (let i = last7.length - 1; i >= 0; i--) backtrack += last7[i].totalXp;
  let cumulXp = totalXp - backtrack;
  for (let i = 0; i < last7.length; i++) {
    cumulXp += last7[i].totalXp;
    const d = new Date(last7[i].date + 'T12:00:00');
    history.push({
      day: i - last7.length,
      date: last7[i].date,
      dateLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      xp: Math.round(cumulXp),
      dayXp: last7[i].totalXp,
      level: levelFromTotalXP(Math.round(cumulXp)),
      isActual: true,
    });
  }

  // Projected (next 7 days)
  const projected = [];
  let runningXp = totalXp;
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const dayXp = hasDowPattern
      ? Math.round(dowAvg[dow] * trendMult)
      : Math.round(avgXpPerDay * trendMult);

    runningXp += dayXp;
    projected.push({
      day: i,
      date: d.toISOString().slice(0, 10),
      dateLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      projectedXp: Math.round(runningXp),
      dayXp,
      level: levelFromTotalXP(Math.round(runningXp)),
      isActual: false,
    });
  }

  const projectedLevel = projected[6]?.level || currentLevel;
  const projectedRank = rankForLevel(projectedLevel);
  const levelsGained = projectedLevel - currentLevel;

  const nudges = [];
  if (avgXpPerDay === 0) {
    nudges.push('Log a stretching session to start your DEX forecast!');
  } else {
    if (levelsGained > 0) {
      nudges.push(`On track for DEX Level ${projectedLevel} (${projectedRank}) by ${projected[6].dateLabel}!`);
    } else {
      const projectedDailyAvg = projected.reduce((s, p) => s + p.dayXp, 0) / 7;
      const xpToNext = xpToReachLevel(currentLevel + 1) - totalXp;
      const daysToNext = projectedDailyAvg > 0 ? Math.ceil(xpToNext / projectedDailyAvg) : 99;
      if (daysToNext <= 14) {
        nudges.push(`Level ${currentLevel + 1} in ~${daysToNext} day${daysToNext > 1 ? 's' : ''} at this pace.`);
      } else {
        nudges.push('Stretch more often to level up faster!');
      }
    }
    if (scoreTrend === 'improving') nudges.push('Flexibility scores trending up — consistency is paying off!');
    else if (scoreTrend === 'declining') nudges.push('Scores dipping — try longer holds or new stretches.');
  }

  return {
    currentLevel, currentRank, totalXp,
    avgXpPerDay: Math.round(avgXpPerDay),
    xpToNextLevel: xpForNextLevel(currentLevel),
    xpInCurrentLevel: totalXp - xpToReachLevel(currentLevel),
    scoreTrend, projectedLevel, projectedRank, levelsGained,
    history, projected, nudges,
  };
}

/* ═══════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════ */

export async function computeDexMetrics() {
  const [logs, xpData] = await Promise.all([loadDexLogs(), loadDexXP()]);

  if (!logs || logs.length === 0) {
    return { hasData: false };
  }

  const dailies = buildDailyAggregates(logs, 14);
  const volumeByZone = computeVolumeByZone(logs, 14);
  const balance = analyzeFlexBalance(volumeByZone);
  const topStretches = computeTopStretches(logs);
  const frequency = computeFrequency(dailies);
  const forecast = computeDexForecast(xpData, dailies);

  const scoreTrend = dailies
    .filter((d) => d.sessions > 0)
    .map((d) => ({ value: d.avgScore, label: d.label }));

  const xpTrend = dailies.map((d) => ({ value: d.totalXp, label: d.label }));

  const today = new Date().toISOString().slice(0, 10);
  const todayData = dailies.find((d) => d.date === today) || { sessions: 0, totalStretches: 0, totalXp: 0, avgScore: 0 };

  // ── ML prediction ──
  let mlPrediction = null;
  try {
    const profile = await loadData('levelup_profile_v1', SYNC_DOCS.PROFILE).catch(() => null);
    const age = profile?.age || 25;
    const sexNum = profile?.sex === 'female' ? 0 : 1;
    const heightCm = profile?.height || 170;
    const weightKg = profile?.weight || 70;
    const bodyFat = profile?.bodyFatPct || 20;
    const bmi = weightKg / ((heightCm / 100) ** 2);

    mlPrediction = predictStat('DEX', {
      age,
      sex_numeric: sexNum,
      heightCm,
      weightKg,
      bodyFatPct: bodyFat,
      bmi: Math.round(bmi * 10) / 10,
      gripForce: 35,
      gripRatio: weightKg > 0 ? 35 / weightKg : 0.5,
      broadJumpCm: 200,
      jumpRatio: heightCm > 0 ? 200 / heightCm : 1.2,
      situpsCount: 30,
      situpsPerKg: weightKg > 0 ? 30 / weightKg : 0.43,
      bpMean: 85,
      perfClassNum: 2,
    });
  } catch (e) {
    console.warn('[dexAnalytics] ML prediction failed:', e.message);
  }

  return {
    hasData: true,
    todaySessions: todayData.sessions,
    todayStretches: todayData.totalStretches,
    todayXp: todayData.totalXp,
    todayScore: todayData.avgScore,
    totalSessions: logs.length,
    volumeByZone,
    balance,
    topStretches,
    frequency,
    forecast,
    scoreTrend,
    xpTrend,
    dailies,
    mlPrediction,
    mlModelInfo: getStatModelInfo('DEX'),
  };
}
