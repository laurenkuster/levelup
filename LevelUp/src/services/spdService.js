/**
 * spdService.js
 *
 * SPD (Speed) stat — logging, XP, dashboard.
 */

import { saveData, loadData, SYNC_DOCS } from './firestoreSync';
import { getStatXpMultiplier } from './crossStatEngine';
import { levelFromTotalXP, levelProgress, rankForLevel } from '../utils/xpSystem';
import {
  SPD_SCORE_WEIGHTS,
  BASE_XP_PER_SESSION,
  MAX_XP_PER_SESSION,
  SPEED_XP_MULT,
  DISTANCE_BONUS_PER_KM,
  SPD_METRICS,
} from '../config/spdConstants';

const LOG_KEY = 'levelup_spd_log_v1';
const XP_KEY = 'levelup_spd_xp_v1';
const HISTORY_KEY = 'levelup_spd_history_v1';

/* ── scoring ───────────────────────── */

export function calcSessionSpdScore(metrics) {
  const maxSpeedNorm = Math.min(metrics.maxSpeedMph / 15, 1) * 100;
  const avgSpeedNorm = Math.min(metrics.avgSpeedMph / 12, 1) * 100;
  const distNorm = Math.min(metrics.distanceM / 500, 1) * 100;
  const consistNorm = (metrics.consistency || 0) * 100;

  return Math.round(
    maxSpeedNorm * SPD_SCORE_WEIGHTS.MAX_SPEED +
    avgSpeedNorm * SPD_SCORE_WEIGHTS.AVG_SPEED +
    distNorm * SPD_SCORE_WEIGHTS.DISTANCE +
    consistNorm * SPD_SCORE_WEIGHTS.CONSISTENCY,
  );
}

/* ── XP calculation ────────────────── */

function getSpeedMult(avgMph) {
  for (const tier of SPEED_XP_MULT) {
    if (avgMph >= tier.minMph) return tier.mult;
  }
  return 0.8;
}

export function calcSpdXP(metrics) {
  const mult = getSpeedMult(metrics.avgSpeedMph);
  const distBonus = Math.floor(metrics.distanceKm) * DISTANCE_BONUS_PER_KM;
  const xp = Math.min(MAX_XP_PER_SESSION, Math.round(BASE_XP_PER_SESSION * mult + distBonus));
  return Math.max(5, xp); // min 5 XP for effort
}

/** Classify session into a metric subsection based on duration. */
function classifySession(elapsedS) {
  if (elapsedS <= 60) return 'SPRINT';
  if (elapsedS <= 180) return 'INTERVALS';
  return 'AGILITY';
}

/* ── logging ───────────────────────── */

export async function logSpdSession(metrics, durationPreset = null, notes = '') {
  const score = calcSessionSpdScore(metrics);
  const rawXp = calcSpdXP(metrics);
  const crossMult = await getStatXpMultiplier('SPD');
  const totalXp = Math.round(rawXp * crossMult);
  const metric = classifySession(metrics.elapsedS);
  const sessionId = `spd_${Date.now()}`;

  // 1. Append to logs
  const logs = (await loadData(LOG_KEY, SYNC_DOCS.SPD_LOGS)) || [];
  logs.unshift({
    sessionId,
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    durationPreset,
    metric,
    score,
    totalXp,
    notes,
    ...metrics,
  });
  if (logs.length > 200) logs.length = 200;
  await saveData(LOG_KEY, SYNC_DOCS.SPD_LOGS, logs);

  // 2. Update cumulative XP
  const xpData = (await loadData(XP_KEY, SYNC_DOCS.SPD_XP)) || { totalXp: 0, metrics: {} };
  xpData.totalXp = (xpData.totalXp || 0) + totalXp;
  if (!xpData.metrics[metric]) xpData.metrics[metric] = { xp: 0 };
  xpData.metrics[metric].xp += totalXp;
  await saveData(XP_KEY, SYNC_DOCS.SPD_XP, xpData);

  // 3. Append to history (90 days)
  const history = (await loadData(HISTORY_KEY, SYNC_DOCS.SPD_HISTORY)) || [];
  history.unshift({
    sessionId,
    date: new Date().toISOString().slice(0, 10),
    score,
    totalXp,
    maxSpeedMph: metrics.maxSpeedMph,
    avgSpeedMph: metrics.avgSpeedMph,
    distanceM: metrics.distanceM,
    elapsedS: metrics.elapsedS,
    metric,
  });
  const cutoff = Date.now() - 90 * 86400000;
  const trimmed = history.filter((h) => new Date(h.date).getTime() > cutoff);
  await saveData(HISTORY_KEY, SYNC_DOCS.SPD_HISTORY, trimmed);

  return { sessionId, score, totalXp, metric };
}

/* ── loaders ───────────────────────── */

export async function loadSpdXP() {
  return (await loadData(XP_KEY, SYNC_DOCS.SPD_XP)) || { totalXp: 0, metrics: {} };
}

export async function loadSpdLogs() {
  return (await loadData(LOG_KEY, SYNC_DOCS.SPD_LOGS)) || [];
}

export async function loadSpdHistory() {
  return (await loadData(HISTORY_KEY, SYNC_DOCS.SPD_HISTORY)) || [];
}

/* ── dashboard ─────────────────────── */

export async function getSpdDashboard() {
  const xpData = await loadSpdXP();
  const totalXp = xpData.totalXp || 0;
  const level = levelFromTotalXP(totalXp);
  const progress = levelProgress(totalXp);
  const rank = rankForLevel(level);

  const metricBreakdown = SPD_METRICS.map((m) => ({
    ...m,
    xp: xpData.metrics?.[m.key]?.xp || 0,
  }));

  return { level, progress, rank, totalXp, metrics: metricBreakdown };
}
