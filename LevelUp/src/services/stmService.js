/**
 * stmService.js
 *
 * STM (Stamina) stat — endurance logging, XP, dashboard.
 */

import { saveData, loadData, SYNC_DOCS } from './firestoreSync';
import { getStatXpMultiplier } from './crossStatEngine';
import { levelFromTotalXP, levelProgress, rankForLevel } from '../utils/xpSystem';
import {
  STM_SCORE_WEIGHTS,
  BASE_XP_PER_MINUTE,
  DISTANCE_BONUS_PER_KM,
  MAX_XP_PER_SESSION,
  PACE_XP_MULT,
  RECOVERY_PACE_THRESHOLD,
  STM_METRICS,
} from '../config/stmConstants';

const LOG_KEY = 'levelup_stm_log_v1';
const XP_KEY = 'levelup_stm_xp_v1';
const HISTORY_KEY = 'levelup_stm_history_v1';

/* ── scoring ───────────────────────── */

export function calcSessionStmScore(metrics) {
  const distNorm = Math.min(metrics.distanceKm / 10, 1) * 100;
  const durNorm = Math.min((metrics.elapsedS / 60) / 60, 1) * 100; // up to 60 min
  const paceNorm = metrics.paceMinPerMi > 0
    ? Math.min(12 / metrics.paceMinPerMi, 1) * 100
    : 0;
  const consistNorm = (metrics.consistency || 0) * 100;

  return Math.round(
    distNorm * STM_SCORE_WEIGHTS.TOTAL_DISTANCE +
    durNorm * STM_SCORE_WEIGHTS.DURATION +
    paceNorm * STM_SCORE_WEIGHTS.AVG_PACE +
    consistNorm * STM_SCORE_WEIGHTS.CONSISTENCY,
  );
}

/* ── XP calculation ────────────────── */

function getPaceMult(paceMinMi) {
  if (paceMinMi <= 0) return 0.8;
  for (const tier of PACE_XP_MULT) {
    if (paceMinMi <= tier.maxPace) return tier.mult;
  }
  return 0.8;
}

export function calcStmXP(metrics) {
  const durationMin = metrics.elapsedS / 60;
  const paceMult = getPaceMult(metrics.paceMinPerMi);
  const distBonus = Math.floor(metrics.distanceKm) * DISTANCE_BONUS_PER_KM;
  const xp = Math.min(
    MAX_XP_PER_SESSION,
    Math.round(BASE_XP_PER_MINUTE * durationMin * paceMult + distBonus),
  );
  return Math.max(5, xp);
}

/** Classify session into a metric subsection. */
function classifySession(elapsedS, paceMinMi) {
  if (paceMinMi > RECOVERY_PACE_THRESHOLD) return 'RECOVERY';
  const min = elapsedS / 60;
  if (min < 15) return 'SHORT_RUN';
  if (min <= 45) return 'MEDIUM_RUN';
  return 'LONG_RUN';
}

/* ── logging ───────────────────────── */

export async function logStmSession(metrics, notes = '') {
  const score = calcSessionStmScore(metrics);
  const rawXp = calcStmXP(metrics);
  const crossMult = await getStatXpMultiplier('STM');
  const totalXp = Math.round(rawXp * crossMult);
  const metric = classifySession(metrics.elapsedS, metrics.paceMinPerMi);
  const sessionId = `stm_${Date.now()}`;

  // 1. Append to logs
  const logs = (await loadData(LOG_KEY, SYNC_DOCS.STM_LOGS)) || [];
  logs.unshift({
    sessionId,
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    metric,
    score,
    totalXp,
    notes,
    ...metrics,
  });
  if (logs.length > 200) logs.length = 200;
  await saveData(LOG_KEY, SYNC_DOCS.STM_LOGS, logs);

  // 2. Update cumulative XP
  const xpData = (await loadData(XP_KEY, SYNC_DOCS.STM_XP)) || { totalXp: 0, metrics: {} };
  xpData.totalXp = (xpData.totalXp || 0) + totalXp;
  if (!xpData.metrics[metric]) xpData.metrics[metric] = { xp: 0 };
  xpData.metrics[metric].xp += totalXp;
  await saveData(XP_KEY, SYNC_DOCS.STM_XP, xpData);

  // 3. Append to history (90 days)
  const history = (await loadData(HISTORY_KEY, SYNC_DOCS.STM_HISTORY)) || [];
  history.unshift({
    sessionId,
    date: new Date().toISOString().slice(0, 10),
    score,
    totalXp,
    avgSpeedMph: metrics.avgSpeedMph,
    paceMinPerMi: metrics.paceMinPerMi,
    distanceM: metrics.distanceM,
    distanceMi: metrics.distanceMi,
    elapsedS: metrics.elapsedS,
    metric,
  });
  const cutoff = Date.now() - 90 * 86400000;
  const trimmed = history.filter((h) => new Date(h.date).getTime() > cutoff);
  await saveData(HISTORY_KEY, SYNC_DOCS.STM_HISTORY, trimmed);

  return { sessionId, score, totalXp, metric };
}

/* ── loaders ───────────────────────── */

export async function loadStmXP() {
  return (await loadData(XP_KEY, SYNC_DOCS.STM_XP)) || { totalXp: 0, metrics: {} };
}

export async function loadStmLogs() {
  return (await loadData(LOG_KEY, SYNC_DOCS.STM_LOGS)) || [];
}

export async function loadStmHistory() {
  return (await loadData(HISTORY_KEY, SYNC_DOCS.STM_HISTORY)) || [];
}

/* ── dashboard ─────────────────────── */

export async function getStmDashboard() {
  const xpData = await loadStmXP();
  const totalXp = xpData.totalXp || 0;
  const level = levelFromTotalXP(totalXp);
  const progress = levelProgress(totalXp);
  const rank = rankForLevel(level);

  const metricBreakdown = STM_METRICS.map((m) => ({
    ...m,
    xp: xpData.metrics?.[m.key]?.xp || 0,
  }));

  return { level, progress, rank, totalXp, metrics: metricBreakdown };
}
