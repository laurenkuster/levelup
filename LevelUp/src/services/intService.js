/**
 * INT Analytics Service — quiz performance + 7-day level forecast.
 *
 * Reads quiz attempts from `levelup_int_log_v1` and XP from
 * `levelup_int_xp_v1` (AsyncStorage) and computes:
 *   - Daily aggregates (14 days)
 *   - INT score per day
 *   - 7-day level forecast based on XP earning trends
 *
 * INT Score (0–100):
 *   accuracy × 60 + improvement × 25 + streak × 15
 *
 * Level Forecast:
 *   Projects XP earnings 7 days ahead using:
 *   - avg XP/day from last 7 days
 *   - accuracy trend (improving = bonus, declining = penalty)
 *   - streak momentum
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { levelFromTotalXP, xpForNextLevel, xpToReachLevel, rankForLevel } from '../utils/xpSystem';
import { loadData, SYNC_DOCS } from './firestoreSync';

const INT_LOG_KEY = 'levelup_int_log_v1';
const INT_XP_KEY = 'levelup_int_xp_v1';

/* ═══════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════ */

export async function loadQuizLogs() {
  try {
    const data = await loadData(INT_LOG_KEY, SYNC_DOCS.QUIZ_LOGS);
    return data || [];
  } catch { return []; }
}

async function loadXpData() {
  try {
    const data = await loadData(INT_XP_KEY, SYNC_DOCS.INT_XP);
    return data || { totalXp: 0, level: 1, history: [] };
  } catch { return { totalXp: 0, level: 1, history: [] }; }
}

/* ═══════════════════════════════════════════════════
   DAILY AGGREGATES
   ═══════════════════════════════════════════════════ */

export function computeDailyAggregates(logs, days = 14) {
  if (!logs || logs.length === 0) return [];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const byDate = {};
  for (const log of logs) {
    if (!log.date) continue;
    const d = log.date.slice(0, 10);
    if (new Date(d) < cutoff) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(log);
  }

  const dailies = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entries = byDate[key] || [];

    if (entries.length === 0) {
      dailies.push({ date: key, attempts: 0, avgAccuracy: 0, xpEarned: 0, intScore: 0 });
      continue;
    }

    const attempts = entries.length;
    const avgAccuracy = Math.round(entries.reduce((s, e) => s + (e.percent || 0), 0) / attempts);
    const xpEarned = entries.reduce((s, e) => s + (e.xp || 0), 0);

    dailies.push({ date: key, attempts, avgAccuracy, xpEarned, intScore: 0 });
  }

  dailies.reverse(); // oldest first

  // Compute streak + INT scores
  const streak = computeStreak(dailies);
  const allAcc = dailies.filter((d) => d.attempts > 0).map((d) => d.avgAccuracy);
  const baseline = allAcc.length > 0 ? allAcc.reduce((s, a) => s + a, 0) / allAcc.length : 50;

  for (const day of dailies) {
    if (day.attempts === 0) continue;
    const accComp = Math.min(1, day.avgAccuracy / 100) * 60;
    const impBonus = day.avgAccuracy > baseline ? Math.min(1, (day.avgAccuracy - baseline) / 20) : 0;
    const speedComp = impBonus * 25;
    const streakComp = Math.min(1, streak / 7) * 15;
    day.intScore = Math.min(100, Math.max(0, Math.round(accComp + speedComp + streakComp)));
  }

  return dailies;
}

function computeStreak(dailies) {
  let streak = 0;
  for (let i = dailies.length - 1; i >= 0; i--) {
    if (dailies[i].attempts > 0) streak++;
    else break;
  }
  return streak;
}

/* ═══════════════════════════════════════════════════
   7-DAY LEVEL FORECAST
   ═══════════════════════════════════════════════════ */

function computeForecast(xpData, dailies) {
  const totalXp = xpData.totalXp || 0;
  const currentLevel = levelFromTotalXP(totalXp);
  const currentRank = rankForLevel(currentLevel);

  // Calculate avg XP/day from last 7 days
  const last7 = dailies.slice(-7);
  const daysWithActivity = last7.filter((d) => d.xpEarned > 0).length;
  const totalXpLast7 = last7.reduce((s, d) => s + d.xpEarned, 0);
  const avgXpPerDay = daysWithActivity > 0 ? totalXpLast7 / 7 : 0; // distribute over 7 days (counts rest days)

  // Accuracy trend: are they improving?
  const recentAcc = last7.filter((d) => d.attempts > 0).map((d) => d.avgAccuracy);
  let accTrend = 'stable';
  if (recentAcc.length >= 3) {
    const firstHalf = recentAcc.slice(0, Math.floor(recentAcc.length / 2));
    const secondHalf = recentAcc.slice(Math.floor(recentAcc.length / 2));
    const avgFirst = firstHalf.reduce((s, a) => s + a, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, a) => s + a, 0) / secondHalf.length;
    if (avgSecond > avgFirst + 3) accTrend = 'improving';
    else if (avgSecond < avgFirst - 3) accTrend = 'declining';
  }

  // Trend multiplier
  const trendMult = accTrend === 'improving' ? 1.15 : accTrend === 'declining' ? 0.85 : 1.0;

  // Project 7 days ahead
  const projectedXpPerDay = avgXpPerDay * trendMult;
  const projected = [];
  let runningXp = totalXp;

  for (let i = 1; i <= 7; i++) {
    runningXp += projectedXpPerDay;
    const lv = levelFromTotalXP(Math.round(runningXp));
    const rk = rankForLevel(lv);
    const d = new Date();
    d.setDate(d.getDate() + i);
    projected.push({
      day: i,
      date: d.toISOString().slice(0, 10),
      dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      projectedXp: Math.round(runningXp),
      level: lv,
      rank: rk,
    });
  }

  const projectedLevel = projected[6]?.level || currentLevel;
  const projectedRank = projected[6]?.rank || currentRank;
  const levelsGained = projectedLevel - currentLevel;

  // Generate nudges
  const nudges = [];
  if (avgXpPerDay === 0) {
    nudges.push('Take a quiz today to get your forecast started! 🚀');
  } else {
    if (levelsGained > 0) {
      nudges.push(`At this pace, you'll reach Level ${projectedLevel} (${projectedRank}) by ${projected[6].dateLabel}! 🎯`);
    } else {
      const xpToNext = xpToReachLevel(currentLevel + 1) - totalXp;
      const daysToNext = Math.ceil(xpToNext / projectedXpPerDay);
      if (daysToNext <= 14) {
        nudges.push(`Level ${currentLevel + 1} in ~${daysToNext} day${daysToNext > 1 ? 's' : ''} at your current pace.`);
      } else {
        nudges.push('Increase quiz frequency to level up faster! 💪');
      }
    }

    if (accTrend === 'improving') nudges.push('Your accuracy is trending up — you\'re improving! 📈');
    else if (accTrend === 'declining') nudges.push('Accuracy dipping — try reviewing weaker topics. 📉');

    const streak = computeStreak(dailies);
    if (streak > 0 && streak < 7) nudges.push(`${streak}-day streak! Keep it going for bonus XP. 🔥`);
    else if (streak === 0) nudges.push('Quiz today to start a streak! 🔥');
    else if (streak >= 7) nudges.push(`${streak}-day streak! Incredible consistency! 🔥🔥`);
  }

  return {
    currentLevel,
    currentRank,
    totalXp,
    avgXpPerDay: Math.round(avgXpPerDay),
    xpToNextLevel: xpForNextLevel(currentLevel),
    xpInCurrentLevel: totalXp - xpToReachLevel(currentLevel),
    accTrend,
    projectedLevel,
    projectedRank,
    levelsGained,
    projected,
    nudges,
  };
}

/* ═══════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════ */

export async function computeIntMetrics() {
  const [logs, xpData] = await Promise.all([loadQuizLogs(), loadXpData()]);

  if (logs.length === 0) {
    return { hasData: false };
  }

  const dailies = computeDailyAggregates(logs, 14);
  const today = new Date().toISOString().slice(0, 10);
  const todayData = dailies.find((d) => d.date === today) || { attempts: 0, avgAccuracy: 0, intScore: 0 };

  const totalQuizzes = logs.length;
  const overallAccuracy = Math.round(logs.reduce((s, l) => s + (l.percent || 0), 0) / logs.length);

  const recentWithData = dailies.filter((d) => d.attempts > 0);
  const currentScore = todayData.attempts > 0
    ? todayData.intScore
    : recentWithData.length > 0
      ? recentWithData[recentWithData.length - 1].intScore
      : Math.round(overallAccuracy * 0.6);

  const streak = computeStreak(dailies);
  const forecast = computeForecast(xpData, dailies);

  return {
    hasData: true,
    todayScore: currentScore,
    todayAccuracy: todayData.attempts > 0 ? todayData.avgAccuracy : overallAccuracy,
    todayAttempts: todayData.attempts,
    totalQuizzes,
    overallAccuracy,
    streak,
    trend: dailies,
    forecast,
  };
}
