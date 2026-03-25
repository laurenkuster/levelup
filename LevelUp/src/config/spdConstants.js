/**
 * spdConstants.js
 *
 * Speed stat — sprint/burst tracking via device sensors.
 *
 * SPD measures maximum throughput speed. The phone goes in the user's
 * pocket, accelerometer + pedometer detect strides, and the user's
 * height determines stride length for distance/speed calculation.
 */

/* ── metric subsections ── */
export const SPD_METRICS = [
  { key: 'SPRINT', label: 'Sprint', description: 'Short bursts < 60s', color: '#f59e0b' },
  { key: 'INTERVALS', label: 'Intervals', description: 'Repeated sprint sets', color: '#fb923c' },
  { key: 'AGILITY', label: 'Agility', description: 'Direction-change drills', color: '#fbbf24' },
];

/* ── preset sprint durations (seconds) ── */
export const PRESET_DURATIONS = [15, 30, 45, 60, 90];

/* ── countdown before recording starts ── */
export const COUNTDOWN_SECONDS = 5;

/* ── scoring weights (per session) ── */
export const SPD_SCORE_WEIGHTS = {
  MAX_SPEED: 0.35,
  AVG_SPEED: 0.25,
  DISTANCE: 0.20,
  CONSISTENCY: 0.20,
};

/* ── XP ── */
export const BASE_XP_PER_SESSION = 15;
export const MAX_XP_PER_SESSION = 200;

/** Speed → XP multiplier (mph thresholds) */
export const SPEED_XP_MULT = [
  { minMph: 10, mult: 2.0 },
  { minMph: 8, mult: 1.6 },
  { minMph: 6, mult: 1.3 },
  { minMph: 4, mult: 1.0 },
  { minMph: 0, mult: 0.8 },
];

export const DISTANCE_BONUS_PER_KM = 2;

/* ── stride length from height ── */
/** Running stride ≈ height(cm) × 0.415 → metres */
export const STRIDE_FACTOR_RUN = 0.415;

/* ── unit helpers ── */
export const MS_TO_MPH = 2.23694;
export const M_TO_MI = 0.000621371;
export const M_TO_KM = 0.001;
