/**
 * strService.js
 *
 * Strength training logging, scoring, and XP pipeline.
 *
 * ── Data flow ──
 *   Log workout → compute per-set 1RM (Epley) → distribute XP to muscle groups
 *   → aggregate body-part scores → persist via firestoreSync
 *
 * ── Firestore structure ──
 *   users/{uid}/strData/strLogs       → { logs: [...] }
 *   users/{uid}/strData/strXp         → { totalXp, bodyParts: { CHEST: { xp, subsections: { UPPER_CHEST: xp, ... } }, ... } }
 *   users/{uid}/strData/strHistory    → { sessions: [...] }  (condensed per-session summaries)
 */

import { saveData, loadData, SYNC_DOCS } from './firestoreSync';
import { getStatXpMultiplier } from './crossStatEngine';
import {
  BODY_PARTS,
  EXERCISE_MAP,
  SCORE_WEIGHTS,
  XP_SPLIT,
  BASE_XP_PER_SET,
  BODYWEIGHT_XP_PER_SET,
  epley1RM,
} from '../config/strConstants';
import { levelFromTotalXP, levelProgress, rankForLevel, xpForNextLevel, xpToReachLevel } from '../utils/xpSystem';

/* ── Storage keys ── */
const STR_LOG_KEY = 'levelup_str_log_v1';
const STR_XP_KEY = 'levelup_str_xp_v1';
const STR_HISTORY_KEY = 'levelup_str_history_v1';

/* ═══════════════════════════════════════════════════
   SCORE CALCULATION (reference pipeline formula)
   ═══════════════════════════════════════════════════ */

/**
 * Calculate the strength score for a single session.
 *
 * @param {Array} sets - [{ exerciseId, weight, reps }]
 * @returns {number} composite strength score
 */
export function calcSessionStrengthScore(sets) {
  if (!sets || sets.length === 0) return 0;

  const oneRMs = sets.map((s) => epley1RM(s.weight || 0, s.reps || 0));
  const maxOneRM = Math.max(...oneRMs, 0);
  const totalVolume = oneRMs.reduce((sum, v) => sum + v, 0);
  const totalWeight = sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
  const numSets = sets.length;

  return Math.round(
    maxOneRM * SCORE_WEIGHTS.MAX_1RM +
    totalVolume * SCORE_WEIGHTS.TOTAL_VOLUME +
    totalWeight * SCORE_WEIGHTS.TOTAL_WEIGHT +
    numSets * SCORE_WEIGHTS.NUM_SETS,
  );
}

/* ═══════════════════════════════════════════════════
   XP CALCULATION & DISTRIBUTION
   ═══════════════════════════════════════════════════ */

/**
 * Calculate XP earned from a workout session and distribute it across body parts.
 *
 * @param {Array} sets - [{ exerciseId, weight, reps }]
 * @returns {{ totalXp: number, distribution: { [bodyPart]: { xp, subsections: { [sub]: xp } } } }}
 */
export function calcStrXP(sets) {
  if (!sets || sets.length === 0) return { totalXp: 0, distribution: {} };

  const distribution = {};

  for (const set of sets) {
    const exercise = EXERCISE_MAP[set.exerciseId];
    if (!exercise) continue;

    const isBodyweight = exercise.type === 'bodyweight';
    const reps = set.reps || 0;
    const weight = set.weight || 0;

    // Base XP per set, scaled by intensity
    let setXP;
    if (isBodyweight) {
      setXP = BODYWEIGHT_XP_PER_SET + Math.floor(reps / 5) * 2;
    } else {
      const oneRM = epley1RM(weight, reps);
      // Scale XP by 1RM bracket (heavier = more XP)
      const intensityMult = oneRM > 0 ? Math.min(2.5, 1 + oneRM / 200) : 1;
      setXP = Math.round(BASE_XP_PER_SET * intensityMult);
    }

    // Distribute to primary body part subsections
    const primaryXP = Math.round(setXP * XP_SPLIT.PRIMARY);
    const primaryKey = exercise.primary;
    if (!distribution[primaryKey]) distribution[primaryKey] = { xp: 0, subsections: {} };
    distribution[primaryKey].xp += primaryXP;

    const subsectionShare = exercise.subsections.length > 0
      ? Math.round(primaryXP / exercise.subsections.length)
      : 0;
    for (const sub of exercise.subsections) {
      distribution[primaryKey].subsections[sub] = (distribution[primaryKey].subsections[sub] || 0) + subsectionShare;
    }

    // Distribute to secondary targets
    if (exercise.secondary.length > 0) {
      const secondaryXP = Math.round(setXP * XP_SPLIT.SECONDARY);
      const perSecondary = Math.round(secondaryXP / exercise.secondary.length);

      for (const secSub of exercise.secondary) {
        // Find which body part owns this subsection
        const ownerPart = BODY_PARTS.find((bp) =>
          bp.subsections.some((s) => s.key === secSub),
        );
        if (!ownerPart) continue;

        const ownerKey = ownerPart.key;
        if (!distribution[ownerKey]) distribution[ownerKey] = { xp: 0, subsections: {} };
        distribution[ownerKey].xp += perSecondary;
        distribution[ownerKey].subsections[secSub] = (distribution[ownerKey].subsections[secSub] || 0) + perSecondary;
      }
    }
  }

  const totalXp = Object.values(distribution).reduce((s, bp) => s + bp.xp, 0);
  return { totalXp, distribution };
}

/* ═══════════════════════════════════════════════════
   LOGGING — save a workout session
   ═══════════════════════════════════════════════════ */

/**
 * Log a completed STR workout session.
 *
 * @param {Array} sets - [{ exerciseId, weight, reps }]
 * @param {string} [notes] - optional session notes
 * @returns {Object} { sessionId, strengthScore, totalXp, distribution }
 */
export async function logStrSession(sets, notes = '') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const strengthScore = calcSessionStrengthScore(sets);
  const { totalXp: rawXp, distribution } = calcStrXP(sets);
  const crossMult = await getStatXpMultiplier('STR');
  const totalXp = Math.round(rawXp * crossMult);

  const sessionId = `str_${Date.now()}`;

  // Build log entry
  const entry = {
    id: sessionId,
    date,
    time,
    sets: sets.map((s) => ({
      exerciseId: s.exerciseId,
      weight: s.weight || 0,
      reps: s.reps || 0,
      oneRM: epley1RM(s.weight || 0, s.reps || 0),
    })),
    strengthScore,
    totalXp,
    distribution,
    notes,
    createdAt: now.toISOString(),
  };

  // 1. Append to logs
  const existingLogs = (await loadData(STR_LOG_KEY, SYNC_DOCS.STR_LOGS)) || [];
  existingLogs.unshift(entry);
  await saveData(STR_LOG_KEY, SYNC_DOCS.STR_LOGS, existingLogs);

  // 2. Update cumulative XP
  const xpData = (await loadData(STR_XP_KEY, SYNC_DOCS.STR_XP)) || {
    totalXp: 0,
    bodyParts: {},
  };

  xpData.totalXp += totalXp;

  for (const [bpKey, bpData] of Object.entries(distribution)) {
    if (!xpData.bodyParts[bpKey]) {
      xpData.bodyParts[bpKey] = { xp: 0, subsections: {} };
    }
    xpData.bodyParts[bpKey].xp += bpData.xp;

    for (const [subKey, subXp] of Object.entries(bpData.subsections)) {
      xpData.bodyParts[bpKey].subsections[subKey] =
        (xpData.bodyParts[bpKey].subsections[subKey] || 0) + subXp;
    }
  }

  await saveData(STR_XP_KEY, SYNC_DOCS.STR_XP, xpData);

  // 3. Append condensed session to history
  const history = (await loadData(STR_HISTORY_KEY, SYNC_DOCS.STR_HISTORY)) || [];
  history.unshift({
    id: sessionId,
    date,
    strengthScore,
    totalXp,
    setCount: sets.length,
    exerciseCount: [...new Set(sets.map((s) => s.exerciseId))].length,
  });
  // Keep last 90 days of history
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const trimmed = history.filter((h) => h.date >= cutoffStr);
  await saveData(STR_HISTORY_KEY, SYNC_DOCS.STR_HISTORY, trimmed);

  return { sessionId, strengthScore, totalXp, distribution };
}

/* ═══════════════════════════════════════════════════
   READING — load STR data for dashboard
   ═══════════════════════════════════════════════════ */

/** Load cumulative STR XP data */
export async function loadStrXP() {
  return (await loadData(STR_XP_KEY, SYNC_DOCS.STR_XP)) || { totalXp: 0, bodyParts: {} };
}

/** Load STR workout logs */
export async function loadStrLogs() {
  return (await loadData(STR_LOG_KEY, SYNC_DOCS.STR_LOGS)) || [];
}

/** Load condensed session history */
export async function loadStrHistory() {
  return (await loadData(STR_HISTORY_KEY, SYNC_DOCS.STR_HISTORY)) || [];
}

/* ═══════════════════════════════════════════════════
   DASHBOARD HELPERS — compute display data
   ═══════════════════════════════════════════════════ */

/**
 * Compute the full dashboard state from XP data.
 *
 * @returns {Object} {
 *   level, progress, rank, totalXp, xpToNext, xpCurrent, xpNeeded,
 *   bodyParts: [{ key, label, color, level, progress, xp, subsections: [{ key, label, xp, level, progress }] }]
 * }
 */
export async function getStrDashboard() {
  const xpData = await loadStrXP();
  const totalXp = xpData.totalXp || 0;

  // Overall STR stat
  const level = levelFromTotalXP(totalXp);
  const progress = levelProgress(totalXp);
  const rank = rankForLevel(level);
  const xpCurrent = totalXp - xpToReachLevel(level);
  const xpNeeded = xpForNextLevel(level);

  // Per body-part breakdown
  const bodyParts = BODY_PARTS.map((bp) => {
    const bpData = xpData.bodyParts[bp.key] || { xp: 0, subsections: {} };
    const bpXp = bpData.xp || 0;
    const bpLevel = levelFromTotalXP(bpXp);
    const bpProgress = levelProgress(bpXp);

    const subsections = bp.subsections.map((sub) => {
      const subXp = bpData.subsections[sub.key] || 0;
      const subLevel = levelFromTotalXP(subXp);
      const subProgress = levelProgress(subXp);
      return { key: sub.key, label: sub.label, xp: subXp, level: subLevel, progress: subProgress };
    });

    return {
      key: bp.key,
      label: bp.label,
      color: bp.color,
      level: bpLevel,
      progress: bpProgress,
      xp: bpXp,
      subsections,
    };
  });

  return { level, progress, rank, totalXp, xpCurrent, xpNeeded, bodyParts };
}

/**
 * Compute a 0-100 score for each body part based on relative XP.
 * The highest-XP body part gets 100, others scale proportionally.
 */
export function bodyPartScores(bodyParts) {
  const maxXp = Math.max(...bodyParts.map((bp) => bp.xp), 1);
  return bodyParts.map((bp) => ({
    ...bp,
    score: Math.round((bp.xp / maxXp) * 100),
  }));
}
