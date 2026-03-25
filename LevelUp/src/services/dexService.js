/**
 * dexService.js
 *
 * Flexibility/mobility logging, scoring, and XP pipeline.
 *
 * DEX (Dexterity) = Flexibility tracking.
 *
 * ── Data flow ──
 *   Log session → compute per-stretch XP → distribute to flex zones
 *   → aggregate zone scores → persist via firestoreSync
 *
 * ── Firestore structure ──
 *   users/{uid}/dexData/dexLogs       → { logs: [...] }
 *   users/{uid}/dexData/dexXp         → { totalXp, zones: { HIPS: { xp, subsections }, ... } }
 *   users/{uid}/dexData/dexHistory    → { sessions: [...] }
 */

import { saveData, loadData, SYNC_DOCS } from './firestoreSync';
import { getStatXpMultiplier } from './crossStatEngine';
import {
  FLEX_ZONES,
  STRETCH_MAP,
  DEX_SCORE_WEIGHTS,
  DEX_XP_SPLIT,
  BASE_XP_PER_STRETCH,
  HOLD_TIME_XP_PER_30S,
  DIFFICULTY_MULT,
} from '../config/dexConstants';
import { levelFromTotalXP, levelProgress, rankForLevel, xpForNextLevel, xpToReachLevel } from '../utils/xpSystem';

/* ── Storage keys ── */
const DEX_LOG_KEY = 'levelup_dex_log_v1';
const DEX_XP_KEY = 'levelup_dex_xp_v1';
const DEX_HISTORY_KEY = 'levelup_dex_history_v1';

/* ═══════════════════════════════════════════════════
   SCORE CALCULATION
   ═══════════════════════════════════════════════════ */

/**
 * Calculate the DEX score for a single session.
 *
 * @param {Array} stretches - [{ stretchId, duration, reps }]
 * @returns {number} composite dex score
 */
export function calcSessionDexScore(stretches) {
  if (!stretches || stretches.length === 0) return 0;

  let totalHoldTime = 0;
  let totalReps = 0;
  let totalDifficulty = 0;
  const uniqueStretches = new Set();

  for (const s of stretches) {
    const stretch = STRETCH_MAP[s.stretchId];
    if (!stretch) continue;
    uniqueStretches.add(s.stretchId);
    totalDifficulty += stretch.difficulty || 1;

    if (stretch.type === 'dynamic') {
      totalReps += s.reps || 0;
    } else {
      totalHoldTime += s.duration || 0;
    }
  }

  const avgDifficulty = stretches.length > 0 ? totalDifficulty / stretches.length : 1;
  const numStretches = uniqueStretches.size;

  return Math.round(
    totalHoldTime * DEX_SCORE_WEIGHTS.TOTAL_HOLD_TIME +
    totalReps * DEX_SCORE_WEIGHTS.TOTAL_REPS +
    avgDifficulty * 100 * DEX_SCORE_WEIGHTS.AVG_DIFFICULTY +
    numStretches * 10 * DEX_SCORE_WEIGHTS.NUM_STRETCHES,
  );
}

/* ═══════════════════════════════════════════════════
   XP CALCULATION & DISTRIBUTION
   ═══════════════════════════════════════════════════ */

/**
 * Calculate XP earned from a flexibility session and distribute across zones.
 *
 * @param {Array} stretches - [{ stretchId, duration, reps }]
 * @returns {{ totalXp: number, distribution: { [zone]: { xp, subsections: { [sub]: xp } } } }}
 */
export function calcDexXP(stretches) {
  if (!stretches || stretches.length === 0) return { totalXp: 0, distribution: {} };

  const distribution = {};

  for (const s of stretches) {
    const stretch = STRETCH_MAP[s.stretchId];
    if (!stretch) continue;

    const diffMult = DIFFICULTY_MULT[stretch.difficulty] || 1.0;

    // Base XP per stretch entry
    let stretchXP = BASE_XP_PER_STRETCH;

    if (stretch.type === 'dynamic') {
      // Reps-based: bonus per 10 reps
      stretchXP += Math.floor((s.reps || 0) / 10) * 3;
    } else {
      // Hold-time-based: bonus per 30s
      stretchXP += Math.floor((s.duration || 0) / 30) * HOLD_TIME_XP_PER_30S;
    }

    // Apply difficulty multiplier
    stretchXP = Math.round(stretchXP * diffMult);

    // Distribute to primary zone
    const primaryXP = Math.round(stretchXP * DEX_XP_SPLIT.PRIMARY);
    const primaryKey = stretch.primary;
    if (!distribution[primaryKey]) distribution[primaryKey] = { xp: 0, subsections: {} };
    distribution[primaryKey].xp += primaryXP;

    const subsectionShare = stretch.subsections.length > 0
      ? Math.round(primaryXP / stretch.subsections.length)
      : 0;
    for (const sub of stretch.subsections) {
      distribution[primaryKey].subsections[sub] = (distribution[primaryKey].subsections[sub] || 0) + subsectionShare;
    }

    // Distribute to secondary zones
    if (stretch.secondary.length > 0) {
      const secondaryXP = Math.round(stretchXP * DEX_XP_SPLIT.SECONDARY);
      const perSecondary = Math.round(secondaryXP / stretch.secondary.length);

      for (const secSub of stretch.secondary) {
        const ownerZone = FLEX_ZONES.find((z) =>
          z.subsections.some((ss) => ss.key === secSub),
        );
        if (!ownerZone) continue;
        const ownerKey = ownerZone.key;
        if (!distribution[ownerKey]) distribution[ownerKey] = { xp: 0, subsections: {} };
        distribution[ownerKey].xp += perSecondary;
        distribution[ownerKey].subsections[secSub] = (distribution[ownerKey].subsections[secSub] || 0) + perSecondary;
      }
    }
  }

  const totalXp = Object.values(distribution).reduce((sum, z) => sum + z.xp, 0);
  return { totalXp, distribution };
}

/* ═══════════════════════════════════════════════════
   LOGGING — save a flexibility session
   ═══════════════════════════════════════════════════ */

/**
 * Log a completed DEX flexibility session.
 *
 * @param {Array} stretches - [{ stretchId, duration, reps }]
 * @param {string} [notes] - optional session notes
 * @returns {Object} { sessionId, dexScore, totalXp, distribution }
 */
export async function logDexSession(stretches, notes = '') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const dexScore = calcSessionDexScore(stretches);
  const { totalXp: rawXp, distribution } = calcDexXP(stretches);
  const crossMult = await getStatXpMultiplier('DEX');
  const totalXp = Math.round(rawXp * crossMult);

  const sessionId = `dex_${Date.now()}`;

  const entry = {
    id: sessionId,
    date,
    time,
    stretches: stretches.map((s) => ({
      stretchId: s.stretchId,
      duration: s.duration || 0,
      reps: s.reps || 0,
    })),
    dexScore,
    totalXp,
    distribution,
    notes,
    createdAt: now.toISOString(),
  };

  // 1. Append to logs
  const existingLogs = (await loadData(DEX_LOG_KEY, SYNC_DOCS.DEX_LOGS)) || [];
  existingLogs.unshift(entry);
  await saveData(DEX_LOG_KEY, SYNC_DOCS.DEX_LOGS, existingLogs);

  // 2. Update cumulative XP
  const xpData = (await loadData(DEX_XP_KEY, SYNC_DOCS.DEX_XP)) || {
    totalXp: 0,
    zones: {},
  };

  xpData.totalXp += totalXp;

  for (const [zoneKey, zoneData] of Object.entries(distribution)) {
    if (!xpData.zones[zoneKey]) {
      xpData.zones[zoneKey] = { xp: 0, subsections: {} };
    }
    xpData.zones[zoneKey].xp += zoneData.xp;

    for (const [subKey, subXp] of Object.entries(zoneData.subsections)) {
      xpData.zones[zoneKey].subsections[subKey] =
        (xpData.zones[zoneKey].subsections[subKey] || 0) + subXp;
    }
  }

  await saveData(DEX_XP_KEY, SYNC_DOCS.DEX_XP, xpData);

  // 3. Append condensed session to history
  const history = (await loadData(DEX_HISTORY_KEY, SYNC_DOCS.DEX_HISTORY)) || [];
  history.unshift({
    id: sessionId,
    date,
    dexScore,
    totalXp,
    stretchCount: stretches.length,
    uniqueStretches: [...new Set(stretches.map((s) => s.stretchId))].length,
  });
  // Keep last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const trimmed = history.filter((h) => h.date >= cutoffStr);
  await saveData(DEX_HISTORY_KEY, SYNC_DOCS.DEX_HISTORY, trimmed);

  return { sessionId, dexScore, totalXp, distribution };
}

/* ═══════════════════════════════════════════════════
   READING — load DEX data
   ═══════════════════════════════════════════════════ */

export async function loadDexXP() {
  return (await loadData(DEX_XP_KEY, SYNC_DOCS.DEX_XP)) || { totalXp: 0, zones: {} };
}

export async function loadDexLogs() {
  return (await loadData(DEX_LOG_KEY, SYNC_DOCS.DEX_LOGS)) || [];
}

export async function loadDexHistory() {
  return (await loadData(DEX_HISTORY_KEY, SYNC_DOCS.DEX_HISTORY)) || [];
}

/* ═══════════════════════════════════════════════════
   DASHBOARD — compute display data
   ═══════════════════════════════════════════════════ */

/**
 * Compute the full DEX dashboard state.
 */
export async function getDexDashboard() {
  const xpData = await loadDexXP();
  const totalXp = xpData.totalXp || 0;

  const level = levelFromTotalXP(totalXp);
  const progress = levelProgress(totalXp);
  const rank = rankForLevel(level);
  const xpCurrent = totalXp - xpToReachLevel(level);
  const xpNeeded = xpForNextLevel(level);

  const zones = FLEX_ZONES.map((zone) => {
    const zData = xpData.zones[zone.key] || { xp: 0, subsections: {} };
    const zXp = zData.xp || 0;
    const zLevel = levelFromTotalXP(zXp);
    const zProgress = levelProgress(zXp);

    const subsections = zone.subsections.map((sub) => {
      const subXp = zData.subsections[sub.key] || 0;
      const subLevel = levelFromTotalXP(subXp);
      const subProgress = levelProgress(subXp);
      return { key: sub.key, label: sub.label, xp: subXp, level: subLevel, progress: subProgress };
    });

    return {
      key: zone.key,
      label: zone.label,
      color: zone.color,
      level: zLevel,
      progress: zProgress,
      xp: zXp,
      subsections,
    };
  });

  return { level, progress, rank, totalXp, xpCurrent, xpNeeded, zones };
}

/**
 * Compute a 0-100 score for each zone based on relative XP.
 */
export function zoneScores(zones) {
  const maxXp = Math.max(...zones.map((z) => z.xp), 1);
  return zones.map((z) => ({
    ...z,
    score: Math.round((z.xp / maxXp) * 100),
  }));
}
