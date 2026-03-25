/**
 * stmAnalyticsService.js
 *
 * Computes STM analytics metrics from logged endurance data for the Analytics screen.
 *
 * Metrics:
 *   - Stamina score trend (14 days)
 *   - Volume distribution by run type (Short/Medium/Long/Recovery)
 *   - Pace & distance personal records
 *   - Training frequency & consistency
 *   - 7-day STM level forecast
 */

import { loadStmLogs, loadStmXP } from './stmService';
import { STM_METRICS } from '../config/stmConstants';
import { levelFromTotalXP, xpForNextLevel, xpToReachLevel, rankForLevel } from '../utils/xpSystem';
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

    const totalXp = sessions.reduce((s, sess) => s + (sess.totalXp || 0), 0);
    const avgScore = sessions.length > 0
      ? Math.round(sessions.reduce((s, sess) => s + (sess.score || 0), 0) / sessions.length)
      : 0;
    const totalDistanceMi = sessions.reduce((s, sess) => s + (sess.distanceMi || 0), 0);
    const totalDurationMin = sessions.reduce((s, sess) => s + ((sess.elapsedS || 0) / 60), 0);
    const bestPace = sessions.length > 0
      ? Math.min(...sessions.filter((sess) => sess.paceMinPerMi > 0).map((sess) => sess.paceMinPerMi), Infinity)
      : 0;

    dailies.push({
      date: key,
      label: key.slice(5),
      sessions: sessions.length,
      totalXp,
      avgScore,
      totalDistanceMi: Math.round(totalDistanceMi * 100) / 100,
      totalDurationMin: Math.round(totalDurationMin),
      bestPace: bestPace === Infinity ? 0 : Math.round(bestPace * 10) / 10,
    });
  }

  return dailies;
}

/* ═══════════════════════════════════════════════════
   VOLUME BY RUN TYPE
   ═══════════════════════════════════════════════════ */

function computeVolumeByType(logs, days = 14) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const volume = {};
  for (const m of STM_METRICS) {
    volume[m.key] = { sessions: 0, totalXp: 0, totalDistanceMi: 0, totalDurationMin: 0 };
  }

  for (const session of logs) {
    if (!session.date || new Date(session.date) < cutoff) continue;
    const type = session.metric || 'SHORT_RUN';
    if (volume[type]) {
      volume[type].sessions += 1;
      volume[type].totalXp += session.totalXp || 0;
      volume[type].totalDistanceMi += session.distanceMi || 0;
      volume[type].totalDurationMin += (session.elapsedS || 0) / 60;
    }
  }

  const maxSessions = Math.max(...Object.values(volume).map((v) => v.sessions), 1);
  return STM_METRICS.map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
    sessions: volume[m.key].sessions,
    totalXp: volume[m.key].totalXp,
    totalDistanceMi: Math.round(volume[m.key].totalDistanceMi * 100) / 100,
    totalDurationMin: Math.round(volume[m.key].totalDurationMin),
    percent: Math.round((volume[m.key].sessions / maxSessions) * 100),
  }));
}

/* ═══════════════════════════════════════════════════
   ENDURANCE PERSONAL RECORDS
   ═══════════════════════════════════════════════════ */

function computeEndurancePRs(logs) {
  if (logs.length === 0) return { longestRun: null, fastestPace: null, farthestRun: null };

  let longestRun = null;
  let fastestPace = null;
  let farthestRun = null;

  for (const session of logs) {
    const elapsed = session.elapsedS || 0;
    const dist = session.distanceMi || 0;
    const pace = session.paceMinPerMi || 0;

    if (elapsed > 0 && (!longestRun || elapsed > longestRun.elapsedS)) {
      longestRun = { date: session.date, elapsedS: elapsed, distanceMi: dist };
    }
    if (pace > 0 && (!fastestPace || pace < fastestPace.paceMinPerMi)) {
      fastestPace = { date: session.date, paceMinPerMi: pace, distanceMi: dist };
    }
    if (dist > 0 && (!farthestRun || dist > farthestRun.distanceMi)) {
      farthestRun = { date: session.date, distanceMi: dist, elapsedS: elapsed };
    }
  }

  return { longestRun, fastestPace, farthestRun };
}

/* ═══════════════════════════════════════════════════
   TRAINING FREQUENCY & CONSISTENCY
   ═══════════════════════════════════════════════════ */

function computeFrequency(dailies) {
  const last7 = dailies.slice(-7);

  const sessionsLast7 = last7.reduce((s, d) => s + d.sessions, 0);
  const xpLast7 = last7.reduce((s, d) => s + d.totalXp, 0);
  const milesLast7 = Math.round(last7.reduce((s, d) => s + d.totalDistanceMi, 0) * 100) / 100;
  const minsLast7 = Math.round(last7.reduce((s, d) => s + d.totalDurationMin, 0));

  let streak = 0;
  for (let i = dailies.length - 1; i >= 0; i--) {
    if (dailies[i].sessions > 0) streak++;
    else break;
  }

  return { sessionsLast7, xpLast7, milesLast7, minsLast7, streak };
}

/* ═══════════════════════════════════════════════════
   7-DAY STM LEVEL FORECAST
   ═══════════════════════════════════════════════════ */

function computeStmForecast(xpData, dailies) {
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

  // History points (past 7 days)
  let backtrack = 0;
  for (let i = last7.length - 1; i >= 0; i--) backtrack += last7[i].totalXp;
  let cumulXp = totalXp - backtrack;
  const history = [];
  for (let i = 0; i < last7.length; i++) {
    cumulXp += last7[i].totalXp;
    const d = new Date(last7[i].date + 'T12:00:00');
    history.push({
      date: last7[i].date,
      dateLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      xp: Math.round(cumulXp),
      dayXp: last7[i].totalXp,
      level: levelFromTotalXP(Math.round(cumulXp)),
    });
  }

  // Projected (next 7 days)
  const projected = [];
  let runningXp = totalXp;
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const dayXp = Math.round((hasDowPattern ? dowAvg[dow] : avgXpPerDay) * trendMult);
    runningXp += dayXp;
    projected.push({
      date: d.toISOString().slice(0, 10),
      dateLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      projectedXp: Math.round(runningXp),
      dayXp,
      level: levelFromTotalXP(Math.round(runningXp)),
    });
  }

  const projectedLevel = projected[6]?.level || currentLevel;
  const projectedRank = rankForLevel(projectedLevel);
  const levelsGained = projectedLevel - currentLevel;

  const nudges = [];
  if (avgXpPerDay === 0) {
    nudges.push('Log an endurance run to get your STM forecast started!');
  } else {
    if (levelsGained > 0) {
      nudges.push(`On track for STM Level ${projectedLevel} (${projectedRank}) by ${projected[6].dateLabel}!`);
    } else {
      const xpToNext = xpToReachLevel(currentLevel + 1) - totalXp;
      const projAvg = projected.reduce((s, p) => s + p.dayXp, 0) / 7;
      const daysToNext = projAvg > 0 ? Math.ceil(xpToNext / projAvg) : 99;
      if (daysToNext <= 14) nudges.push(`Level ${currentLevel + 1} in ~${daysToNext} day${daysToNext > 1 ? 's' : ''} at this pace.`);
      else nudges.push('Run more often to level up faster!');
    }
    if (scoreTrend === 'improving') nudges.push('Endurance scores trending up — keep pushing!');
    else if (scoreTrend === 'declining') nudges.push('Scores dipping — try easy recovery runs to rebuild base.');
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

export async function computeStmMetrics() {
  const [logs, xpData] = await Promise.all([loadStmLogs(), loadStmXP()]);

  if (!logs || logs.length === 0) return { hasData: false };

  const dailies = buildDailyAggregates(logs, 14);
  const volumeByType = computeVolumeByType(logs, 14);
  const prs = computeEndurancePRs(logs);
  const frequency = computeFrequency(dailies);
  const forecast = computeStmForecast(xpData, dailies);

  const scoreTrend = dailies
    .filter((d) => d.sessions > 0)
    .map((d) => ({ value: d.avgScore, label: d.label }));

  const distanceTrend = dailies
    .filter((d) => d.sessions > 0)
    .map((d) => ({ value: d.totalDistanceMi, label: d.label }));

  // ── ML prediction (calorie burn for avg runner) ──
  let mlPrediction = null;
  try {
    const profile = await loadData('levelup_profile_v1', SYNC_DOCS.PROFILE).catch(() => null);
    const age = profile?.age || 25;
    const sexNum = profile?.sex === 'female' || profile?.sex === 'Female' ? 0 : 1;
    const weightKg = profile?.weight || 70;
    const heightM = (profile?.height || 170) / 100;
    const lastSession = logs[0];

    const distMi = lastSession?.distanceMi || 0;
    const distKm = distMi * 1.60934;
    const elapsedMin = (lastSession?.elapsedS || 0) / 60;
    const speedKmh = elapsedMin > 0 && distKm > 0
      ? distKm / (elapsedMin / 60)
      : (lastSession?.paceMinPerMi > 0 ? (60 / lastSession.paceMinPerMi) * 1.60934 : 0);

    mlPrediction = predictStat('STM', {
      age,
      sex_numeric: sexNum,
      weightKg,
      heightM,
      sessionMinutes: elapsedMin,
      speedKmh: Math.round(speedKmh * 10) / 10,
      distanceKm: Math.round(distKm * 100) / 100,
      avgBpm: Math.round((220 - age) * 0.75),
      maxBpm: 220 - age,
      restingBpm: 65,
    });
  } catch (e) {
    console.warn('[stmAnalytics] ML prediction failed:', e.message);
  }

  return {
    hasData: true,
    totalSessions: logs.length,
    volumeByType,
    prs,
    frequency,
    forecast,
    scoreTrend,
    distanceTrend,
    dailies,
    mlPrediction,
    mlModelInfo: getStatModelInfo('STM'),
  };
}
