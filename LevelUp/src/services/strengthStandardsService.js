/**
 * strengthStandardsService.js
 *
 * Classifies user lifts against population-level strength standards.
 * Uses percentile data from the ML pipeline (or bundled defaults).
 *
 * ── Tiers ──
 *   Beginner     (0-20th percentile)
 *   Novice       (20-40th)
 *   Intermediate (40-60th)
 *   Advanced     (60-80th)
 *   Elite        (80-95th)
 *   World Class  (95-100th)
 *
 * ── Usage ──
 *   const ranking = classifyLift('bench_press', 225, { sex: 'M', bodyweightLbs: 180 });
 *   // → { tier: 'intermediate', percentile: 55, nextTier: 'advanced', nextThreshold: 280 }
 */

import standards from '../ml/strength_standards.json';
import { EXERCISE_MAP, epley1RM } from '../config/strConstants';

/* ── Tier definitions (ordered low → high) ── */
const TIERS = [
  { key: 'beginner',     label: 'Beginner',     pKey: null,  color: '#6b7280', icon: 'shield-outline' },
  { key: 'novice',       label: 'Novice',        pKey: 'p20', color: '#22c55e', icon: 'shield-half-full' },
  { key: 'intermediate', label: 'Intermediate',   pKey: 'p40', color: '#3b82f6', icon: 'shield' },
  { key: 'advanced',     label: 'Advanced',       pKey: 'p60', color: '#a855f7', icon: 'shield-star' },
  { key: 'elite',        label: 'Elite',          pKey: 'p80', color: '#f59e0b', icon: 'shield-crown' },
  { key: 'world_class',  label: 'World Class',    pKey: 'p95', color: '#ef4444', icon: 'trophy' },
];

/* ── Core lift exercise IDs → standards key mapping ── */
const LIFT_STANDARDS_MAP = {
  bench_press: 'bench_press',
  incline_bench: 'bench_press',
  decline_bench: 'bench_press',
  squat: 'squat',
  leg_press: 'squat',
  deadlift: 'deadlift',
  romanian_deadlift: 'deadlift',
};

/**
 * Find the bodyweight bucket for a given weight in lbs.
 */
function findBucket(bodyweightLbs) {
  const buckets = [
    [100, 120], [120, 140], [140, 160], [160, 180],
    [180, 200], [200, 220], [220, 250], [250, 300],
  ];
  for (const [lo, hi] of buckets) {
    if (bodyweightLbs >= lo && bodyweightLbs < hi) {
      return `${lo}-${hi}`;
    }
  }
  // Clamp to nearest bucket
  if (bodyweightLbs < 100) return '100-120';
  return '250-300';
}

/**
 * Classify a single lift against the standards.
 *
 * @param {string} exerciseId - Exercise ID from strConstants
 * @param {number} oneRM - Estimated 1RM in lbs
 * @param {{ sex?: string, bodyweightLbs?: number }} profile - User profile
 * @returns {{ tier, label, color, icon, percentile, nextTier, nextThreshold } | null}
 */
export function classifyLift(exerciseId, oneRM, profile = {}) {
  const standardsKey = LIFT_STANDARDS_MAP[exerciseId];
  if (!standardsKey || !oneRM || oneRM <= 0) return null;

  const sex = profile.sex || 'M';
  const bw = profile.bodyweightLbs || 170;
  const bucket = findBucket(bw);

  const liftData = standards.lifts?.[standardsKey]?.[sex]?.[bucket];
  if (!liftData) return null;

  // Walk tiers from top to bottom
  let tier = TIERS[0]; // default beginner
  for (let i = TIERS.length - 1; i >= 1; i--) {
    const threshold = liftData[TIERS[i].pKey];
    if (oneRM >= threshold) {
      tier = TIERS[i];
      break;
    }
  }

  // Estimate percentile within tier
  const tierIdx = TIERS.indexOf(tier);
  let percentile;
  if (tierIdx === 0) {
    percentile = Math.round((oneRM / liftData.p20) * 20);
  } else if (tierIdx === TIERS.length - 1) {
    percentile = 95 + Math.min(5, Math.round(((oneRM - liftData.p95) / liftData.p95) * 20));
  } else {
    const lo = liftData[tier.pKey];
    const nextPKey = TIERS[tierIdx + 1].pKey;
    const hi = liftData[nextPKey];
    const tierLo = tier.key === 'novice' ? 20 : tier.key === 'intermediate' ? 40 : tier.key === 'advanced' ? 60 : 80;
    const tierWidth = tierLo < 80 ? 20 : 15;
    percentile = Math.round(tierLo + ((oneRM - lo) / Math.max(1, hi - lo)) * tierWidth);
  }
  percentile = Math.max(0, Math.min(100, percentile));

  // Next tier info
  let nextTier = null;
  let nextThreshold = null;
  if (tierIdx < TIERS.length - 1) {
    nextTier = TIERS[tierIdx + 1];
    nextThreshold = liftData[nextTier.pKey];
  }

  return {
    tier: tier.key,
    label: tier.label,
    color: tier.color,
    icon: tier.icon,
    percentile,
    nextTier: nextTier?.label || null,
    nextThreshold,
    deficit: nextThreshold ? nextThreshold - oneRM : 0,
  };
}

/**
 * Classify all core lifts for a user from their logged data.
 *
 * @param {Array} logs - STR log entries from strService
 * @param {{ sex?: string, bodyweightLbs?: number }} profile
 * @returns {Array<{ exerciseId, exerciseName, oneRM, ...classification }>}
 */
export function classifyUserLifts(logs, profile = {}) {
  if (!logs || logs.length === 0) return [];

  // Find best 1RM per core-lift exercise across all sessions
  const best1RMs = {};

  for (const session of logs) {
    if (!session.sets) continue;
    for (const set of session.sets) {
      if (!LIFT_STANDARDS_MAP[set.exerciseId]) continue;
      const oneRM = set.oneRM || epley1RM(set.weight || 0, set.reps || 0);
      if (oneRM > (best1RMs[set.exerciseId] || 0)) {
        best1RMs[set.exerciseId] = oneRM;
      }
    }
  }

  const results = [];
  for (const [exerciseId, oneRM] of Object.entries(best1RMs)) {
    const exercise = EXERCISE_MAP[exerciseId];
    const classification = classifyLift(exerciseId, oneRM, profile);
    if (classification) {
      results.push({
        exerciseId,
        exerciseName: exercise?.name || exerciseId,
        oneRM,
        ...classification,
      });
    }
  }

  // Sort by percentile descending
  results.sort((a, b) => b.percentile - a.percentile);
  return results;
}

/**
 * Get the tier list for display.
 */
export function getTiers() {
  return TIERS;
}

/**
 * Check if an exercise has standards available.
 */
export function hasStandards(exerciseId) {
  return !!LIFT_STANDARDS_MAP[exerciseId];
}
