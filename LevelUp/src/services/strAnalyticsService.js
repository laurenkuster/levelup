/**
 * strAnalyticsService.js
 *
 * Computes STR analytics metrics from logged workout data for the Analytics screen.
 *
 * Metrics:
 *   - Strength score trend (14 days)
 *   - Volume distribution by body part
 *   - Muscle balance analysis (imbalance detection)
 *   - Training frequency & consistency
 *   - Top exercises by 1RM
 *   - 7-day STR level forecast
 */

import { loadStrLogs, loadStrXP, loadStrHistory } from './strService';
import { BODY_PARTS, EXERCISE_MAP, epley1RM } from '../config/strConstants';
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

    const totalSets = sessions.reduce((s, sess) => s + (sess.sets?.length || 0), 0);
    const totalXp = sessions.reduce((s, sess) => s + (sess.totalXp || 0), 0);
    const avgScore = sessions.length > 0
      ? Math.round(sessions.reduce((s, sess) => s + (sess.strengthScore || 0), 0) / sessions.length)
      : 0;
    const maxScore = sessions.length > 0
      ? Math.max(...sessions.map((sess) => sess.strengthScore || 0))
      : 0;

    dailies.push({
      date: key,
      label: key.slice(5),
      sessions: sessions.length,
      totalSets,
      totalXp,
      avgScore,
      maxScore,
    });
  }

  return dailies;
}

/* ═══════════════════════════════════════════════════
   VOLUME BY BODY PART
   ═══════════════════════════════════════════════════ */

function computeVolumeByBodyPart(logs, days = 14) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const volume = {}; // { CHEST: { sets: 0, totalWeight: 0 }, ... }
  for (const bp of BODY_PARTS) {
    volume[bp.key] = { sets: 0, totalWeight: 0, xp: 0 };
  }

  for (const session of logs) {
    if (!session.date || new Date(session.date) < cutoff) continue;
    if (!session.sets) continue;

    for (const set of session.sets) {
      const exercise = EXERCISE_MAP[set.exerciseId];
      if (!exercise) continue;
      const primaryKey = exercise.primary;
      if (volume[primaryKey]) {
        volume[primaryKey].sets += 1;
        volume[primaryKey].totalWeight += (set.weight || 0) * (set.reps || 0);
      }
    }

    // Also use the session's XP distribution
    if (session.distribution) {
      for (const [bpKey, bpData] of Object.entries(session.distribution)) {
        if (volume[bpKey]) {
          volume[bpKey].xp += bpData.xp || 0;
        }
      }
    }
  }

  const maxSets = Math.max(...Object.values(volume).map((v) => v.sets), 1);
  return BODY_PARTS.map((bp) => ({
    key: bp.key,
    label: bp.label,
    color: bp.color,
    sets: volume[bp.key].sets,
    totalWeight: volume[bp.key].totalWeight,
    xp: volume[bp.key].xp,
    percent: Math.round((volume[bp.key].sets / maxSets) * 100),
  }));
}

/* ═══════════════════════════════════════════════════
   MUSCLE BALANCE — detect imbalances
   ═══════════════════════════════════════════════════ */

function analyzeMuscleBalance(volumeByPart) {
  const withSets = volumeByPart.filter((bp) => bp.sets > 0);
  if (withSets.length === 0) return { balanced: true, insights: [], weakest: null, strongest: null };

  const avgSets = withSets.reduce((s, bp) => s + bp.sets, 0) / BODY_PARTS.length;
  const sorted = [...volumeByPart].sort((a, b) => b.sets - a.sets);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const insights = [];
  const undertrained = volumeByPart.filter((bp) => bp.sets < avgSets * 0.5 && bp.sets < strongest.sets * 0.3);
  const overtrained = volumeByPart.filter((bp) => bp.sets > avgSets * 2);

  if (undertrained.length > 0) {
    const names = undertrained.map((bp) => bp.label).join(', ');
    insights.push(`${names} ${undertrained.length > 1 ? 'are' : 'is'} undertrained — add more volume to balance.`);
  }

  if (overtrained.length > 0 && undertrained.length > 0) {
    insights.push(`Focus is heavy on ${overtrained.map((bp) => bp.label).join(', ')}. Spread sets more evenly.`);
  }

  const zeroGroups = volumeByPart.filter((bp) => bp.sets === 0);
  if (zeroGroups.length > 0 && withSets.length > 0) {
    insights.push(`No ${zeroGroups.map((bp) => bp.label).join(', ')} training logged in the last 14 days.`);
  }

  if (insights.length === 0 && withSets.length >= 4) {
    insights.push('Good muscle balance across all trained groups!');
  }

  return {
    balanced: undertrained.length === 0 && zeroGroups.length <= 1,
    insights,
    weakest: weakest.sets > 0 ? weakest : null,
    strongest,
  };
}

/* ═══════════════════════════════════════════════════
   TOP EXERCISES BY 1RM
   ═══════════════════════════════════════════════════ */

function computeTop1RMs(logs) {
  const best = {}; // { exerciseId: { name, max1RM, date } }

  for (const session of logs) {
    if (!session.sets) continue;
    for (const set of session.sets) {
      const oneRM = set.oneRM || epley1RM(set.weight || 0, set.reps || 0);
      if (oneRM <= 0) continue;
      const exercise = EXERCISE_MAP[set.exerciseId];
      if (!exercise) continue;

      if (!best[set.exerciseId] || oneRM > best[set.exerciseId].max1RM) {
        best[set.exerciseId] = {
          exerciseId: set.exerciseId,
          name: exercise.name,
          primary: exercise.primary,
          max1RM: oneRM,
          date: session.date,
        };
      }
    }
  }

  return Object.values(best)
    .sort((a, b) => b.max1RM - a.max1RM)
    .slice(0, 8);
}

/* ═══════════════════════════════════════════════════
   TRAINING FREQUENCY & CONSISTENCY
   ═══════════════════════════════════════════════════ */

function computeFrequency(dailies) {
  const last7 = dailies.slice(-7);
  const last14 = dailies;

  const sessionsLast7 = last7.reduce((s, d) => s + d.sessions, 0);
  const sessionsLast14 = last14.reduce((s, d) => s + d.sessions, 0);
  const setsLast7 = last7.reduce((s, d) => s + d.totalSets, 0);
  const xpLast7 = last7.reduce((s, d) => s + d.totalXp, 0);

  // Training streak
  let streak = 0;
  for (let i = dailies.length - 1; i >= 0; i--) {
    if (dailies[i].sessions > 0) streak++;
    else break;
  }

  // Weekly consistency: how many of last 4 weeks had 2+ sessions?
  const weeks = [];
  for (let w = 0; w < 2; w++) {
    const start = dailies.length - (w + 1) * 7;
    const end = dailies.length - w * 7;
    const weekSlice = dailies.slice(Math.max(0, start), end);
    weeks.push(weekSlice.reduce((s, d) => s + d.sessions, 0));
  }

  return {
    sessionsLast7,
    sessionsLast14,
    setsLast7,
    xpLast7,
    streak,
    avgSessionsPerWeek: Math.round(((sessionsLast14 / 14) * 7) * 10) / 10,
    weeklyBreakdown: weeks,
  };
}

/* ═══════════════════════════════════════════════════
   7-DAY STR LEVEL FORECAST (pattern-aware)
   ═══════════════════════════════════════════════════ */

function computeStrForecast(xpData, dailies) {
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
    const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
    const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    if (avgSecond > avgFirst * 1.05) scoreTrend = 'improving';
    else if (avgSecond < avgFirst * 0.95) scoreTrend = 'declining';
  }

  const trendMult = scoreTrend === 'improving' ? 1.1 : scoreTrend === 'declining' ? 0.9 : 1.0;

  // ── Build day-of-week XP pattern from last 14 days ──
  // dayOfWeek: 0=Sun..6=Sat → average XP on that day
  const dowXp = [0, 0, 0, 0, 0, 0, 0]; // totals per dow
  const dowCount = [0, 0, 0, 0, 0, 0, 0]; // occurrences per dow
  for (const d of dailies) {
    const dow = new Date(d.date + 'T12:00:00').getDay();
    dowXp[dow] += d.totalXp;
    dowCount[dow] += 1;
  }
  const dowAvg = dowXp.map((total, i) => dowCount[i] > 0 ? total / dowCount[i] : 0);

  // If no pattern (all zeros), fall back to flat average
  const hasDowPattern = dowAvg.some((v) => v > 0);

  // ── Build history points (past 7 days actual cumulative XP) ──
  // We reconstruct cumulative XP going backwards from current totalXp
  const history = [];
  let backtrack = 0;
  for (let i = last7.length - 1; i >= 0; i--) {
    backtrack += last7[i].totalXp;
  }
  let cumulXp = totalXp - backtrack;
  for (let i = 0; i < last7.length; i++) {
    cumulXp += last7[i].totalXp;
    const d = new Date(last7[i].date + 'T12:00:00');
    history.push({
      day: i - last7.length, // negative = past
      date: last7[i].date,
      dateLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      xp: Math.round(cumulXp),
      dayXp: last7[i].totalXp,
      level: levelFromTotalXP(Math.round(cumulXp)),
      isActual: true,
    });
  }

  // ── Build projected points (next 7 days) ──
  const projected = [];
  let runningXp = totalXp;
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dow = d.getDay();

    // Use the day-of-week pattern with trend multiplier
    let dayXp;
    if (hasDowPattern) {
      dayXp = Math.round(dowAvg[dow] * trendMult);
    } else {
      dayXp = Math.round(avgXpPerDay * trendMult);
    }

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
    nudges.push('Log a workout to get your STR forecast started!');
  } else {
    if (levelsGained > 0) {
      nudges.push(`On track for STR Level ${projectedLevel} (${projectedRank}) by ${projected[6].dateLabel}!`);
    } else {
      const xpToNext = xpToReachLevel(currentLevel + 1) - totalXp;
      const projectedDailyAvg = projected.reduce((s, p) => s + p.dayXp, 0) / 7;
      const daysToNext = projectedDailyAvg > 0 ? Math.ceil(xpToNext / projectedDailyAvg) : 99;
      if (daysToNext <= 14) {
        nudges.push(`Level ${currentLevel + 1} in ~${daysToNext} day${daysToNext > 1 ? 's' : ''} at this pace.`);
      } else {
        nudges.push('Train more often to level up faster!');
      }
    }
    if (scoreTrend === 'improving') nudges.push('Strength scores trending up — progressive overload is working!');
    else if (scoreTrend === 'declining') nudges.push('Scores dipping — consider a deload or technique check.');

    // Show training pattern insight
    const trainDays = dowAvg
      .map((v, i) => ({ dow: i, xp: v }))
      .filter((d) => d.xp > 0)
      .sort((a, b) => b.xp - a.xp);
    if (trainDays.length > 0 && trainDays.length < 6) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const top = trainDays.slice(0, 3).map((d) => dayNames[d.dow]);
      nudges.push(`Heaviest training days: ${top.join(', ')}`);
    }
  }

  return {
    currentLevel,
    currentRank,
    totalXp,
    avgXpPerDay: Math.round(avgXpPerDay),
    xpToNextLevel: xpForNextLevel(currentLevel),
    xpInCurrentLevel: totalXp - xpToReachLevel(currentLevel),
    scoreTrend,
    projectedLevel,
    projectedRank,
    levelsGained,
    history,    // past 7 days actual data
    projected,  // next 7 days predicted data
    nudges,
  };
}

/* ═══════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════ */

export async function computeStrMetrics() {
  const [logs, xpData] = await Promise.all([loadStrLogs(), loadStrXP()]);

  if (!logs || logs.length === 0) {
    return { hasData: false };
  }

  const dailies = buildDailyAggregates(logs, 14);
  const volumeByPart = computeVolumeByBodyPart(logs, 14);
  const balance = analyzeMuscleBalance(volumeByPart);
  const top1RMs = computeTop1RMs(logs);
  const frequency = computeFrequency(dailies);
  const forecast = computeStrForecast(xpData, dailies);

  // Score trend data for chart
  const scoreTrend = dailies
    .filter((d) => d.sessions > 0)
    .map((d) => ({ value: d.avgScore, label: d.label }));

  // XP trend data for chart
  const xpTrend = dailies.map((d) => ({ value: d.totalXp, label: d.label }));

  // Today summary
  const today = new Date().toISOString().slice(0, 10);
  const todayData = dailies.find((d) => d.date === today) || { sessions: 0, totalSets: 0, totalXp: 0, avgScore: 0 };

  // ── ML prediction ──
  let mlPrediction = null;
  try {
    const profile = await loadData('levelup_profile_v1', SYNC_DOCS.PROFILE).catch(() => null);
    const age = profile?.age || 25;
    const sexNum = profile?.sex === 'female' ? 0 : 1;
    const bw = profile?.weight || 70;
    const lastSession = logs[0];
    const totalKg = (lastSession?.sets || []).reduce((s, set) => {
      const ex = EXERCISE_MAP[set.exerciseId];
      const oneRm = epley1RM(set.weight || 0, set.reps || 0);
      return s + oneRm;
    }, 0);
    const strToBw = bw > 0 ? totalKg / bw : 0;

    // Get rolling avg from last 3 sessions
    const recent3 = logs.slice(0, 3);
    const avg3Score = recent3.length > 0
      ? recent3.reduce((s, l) => s + (l.strengthScore || 0), 0) / recent3.length
      : 0;

    const daysSince = lastSession?.date
      ? Math.round((Date.now() - new Date(lastSession.date).getTime()) / 86400000)
      : 7;

    mlPrediction = predictStat('STR', {
      age,
      sex_numeric: sexNum,
      bodyweightKg: bw,
      strToBw,
      squatRatio: 0,
      benchRatio: 0,
      deadliftRatio: 0,
      sessionNum: Math.min(logs.length, 50),
      totalSessions: logs.length,
      daysSinceLast: daysSince,
      totalPrev: lastSession?.totalXp || 0,
      dotsPrev: avg3Score * 3,
      bwChange: 0,
      totalChangePct: 0,
      totalRollingMean3: avg3Score * 3,
      dotsRollingMean3: avg3Score * 3,
    });
  } catch (e) {
    console.warn('[strAnalytics] ML prediction failed:', e.message);
  }

  return {
    hasData: true,
    todaySessions: todayData.sessions,
    todaySets: todayData.totalSets,
    todayXp: todayData.totalXp,
    todayScore: todayData.avgScore,
    totalSessions: logs.length,
    volumeByPart,
    balance,
    top1RMs,
    frequency,
    forecast,
    scoreTrend,
    xpTrend,
    dailies,
    mlPrediction,
    mlModelInfo: getStatModelInfo('STR'),
  };
}
