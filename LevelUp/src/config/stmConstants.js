/**
 * stmConstants.js
 *
 * Stamina stat — endurance/cardio tracking via device sensors.
 *
 * STM measures sustained effort. User starts an open-ended timer,
 * runs at their own pace, and stops when done. Sensors track distance,
 * pace, and consistency over the full duration.
 */

/* ── metric subsections ── */
export const STM_METRICS = [
  { key: 'SHORT_RUN', label: 'Short Run', description: 'Under 15 min', color: '#ec4899' },
  { key: 'MEDIUM_RUN', label: 'Medium Run', description: '15–45 min', color: '#f472b6' },
  { key: 'LONG_RUN', label: 'Long Run', description: 'Over 45 min', color: '#db2777' },
  { key: 'RECOVERY', label: 'Recovery', description: 'Easy pace, active recovery', color: '#f9a8d4' },
];

/* ── countdown before recording starts ── */
export const COUNTDOWN_SECONDS = 5;

/* ── scoring weights (per session) ── */
export const STM_SCORE_WEIGHTS = {
  TOTAL_DISTANCE: 0.30,
  DURATION: 0.25,
  AVG_PACE: 0.25,
  CONSISTENCY: 0.20,
};

/* ── XP ── */
export const BASE_XP_PER_MINUTE = 3;
export const DISTANCE_BONUS_PER_KM = 8;
export const MAX_XP_PER_SESSION = 500;

/** Pace (min/mile) → XP multiplier */
export const PACE_XP_MULT = [
  { maxPace: 6, mult: 1.6 },
  { maxPace: 8, mult: 1.3 },
  { maxPace: 10, mult: 1.0 },
  { maxPace: 12, mult: 0.9 },
  { maxPace: Infinity, mult: 0.8 },
];

/** Threshold: anything slower than 12 min/mi is considered recovery */
export const RECOVERY_PACE_THRESHOLD = 12; // min/mile

/* ── stride / unit helpers (shared with SPD) ── */
export const STRIDE_FACTOR_RUN = 0.415;
export const MS_TO_MPH = 2.23694;
export const M_TO_MI = 0.000621371;
export const M_TO_KM = 0.001;
