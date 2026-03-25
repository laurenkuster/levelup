/**
 * strConstants.js
 *
 * Muscle group hierarchy, exercise database, and STR scoring constants.
 *
 * ── Body Part Hierarchy ──
 *   CHEST   → Upper Chest, Lower Chest
 *   BACK    → Lats, Traps, Lower Back
 *   SHOULDERS → Front Delts, Side Delts, Rear Delts
 *   ARMS    → Biceps, Triceps, Forearms
 *   LEGS    → Quads, Hamstrings, Calves, Glutes
 *   CORE    → Abs, Obliques
 *
 * ── Strength Score (per-session, from reference pipeline) ──
 *   strength_score = max_1rm × 0.4 + total_volume × 0.3 + total_weight × 0.2 + num_sets × 0.1
 *
 * ── XP Distribution ──
 *   Primary muscle group:   70% of session XP
 *   Secondary muscle groups: 30% split evenly
 */

/* ═══════════════════════════════════════════════════
   MUSCLE GROUPS & SUBSECTIONS
   ═══════════════════════════════════════════════════ */

export const BODY_PARTS = [
  {
    key: 'CHEST',
    label: 'Chest',
    icon: 'chest',
    color: '#ef4444',
    subsections: [
      { key: 'UPPER_CHEST', label: 'Upper Chest' },
      { key: 'LOWER_CHEST', label: 'Lower Chest' },
    ],
  },
  {
    key: 'BACK',
    label: 'Back',
    icon: 'back',
    color: '#3b82f6',
    subsections: [
      { key: 'LATS', label: 'Lats' },
      { key: 'TRAPS', label: 'Traps' },
      { key: 'LOWER_BACK', label: 'Lower Back' },
    ],
  },
  {
    key: 'SHOULDERS',
    label: 'Shoulders',
    icon: 'shoulders',
    color: '#f59e0b',
    subsections: [
      { key: 'FRONT_DELTS', label: 'Front Delts' },
      { key: 'SIDE_DELTS', label: 'Side Delts' },
      { key: 'REAR_DELTS', label: 'Rear Delts' },
    ],
  },
  {
    key: 'ARMS',
    label: 'Arms',
    icon: 'arms',
    color: '#22c55e',
    subsections: [
      { key: 'BICEPS', label: 'Biceps' },
      { key: 'TRICEPS', label: 'Triceps' },
      { key: 'FOREARMS', label: 'Forearms' },
    ],
  },
  {
    key: 'LEGS',
    label: 'Legs',
    icon: 'legs',
    color: '#a855f7',
    subsections: [
      { key: 'QUADS', label: 'Quads' },
      { key: 'HAMSTRINGS', label: 'Hamstrings' },
      { key: 'CALVES', label: 'Calves' },
      { key: 'GLUTES', label: 'Glutes' },
    ],
  },
  {
    key: 'CORE',
    label: 'Core',
    icon: 'core',
    color: '#06b6d4',
    subsections: [
      { key: 'ABS', label: 'Abs' },
      { key: 'OBLIQUES', label: 'Obliques' },
    ],
  },
];

/* ═══════════════════════════════════════════════════
   EXERCISE DATABASE
   ═══════════════════════════════════════════════════
   Each exercise maps to a primary body part + subsection(s)
   and optional secondary targets.
   `type`: 'weighted' (uses weight/reps) or 'bodyweight' (reps only)
   ═══════════════════════════════════════════════════ */

export const EXERCISES = [
  // ── CHEST ──
  { id: 'bench_press', name: 'Bench Press', type: 'weighted', primary: 'CHEST', subsections: ['UPPER_CHEST', 'LOWER_CHEST'], secondary: ['TRICEPS', 'FRONT_DELTS'] },
  { id: 'incline_bench', name: 'Incline Bench Press', type: 'weighted', primary: 'CHEST', subsections: ['UPPER_CHEST'], secondary: ['TRICEPS', 'FRONT_DELTS'] },
  { id: 'decline_bench', name: 'Decline Bench Press', type: 'weighted', primary: 'CHEST', subsections: ['LOWER_CHEST'], secondary: ['TRICEPS'] },
  { id: 'dumbbell_fly', name: 'Dumbbell Fly', type: 'weighted', primary: 'CHEST', subsections: ['UPPER_CHEST', 'LOWER_CHEST'], secondary: [] },
  { id: 'cable_crossover', name: 'Cable Crossover', type: 'weighted', primary: 'CHEST', subsections: ['LOWER_CHEST'], secondary: [] },
  { id: 'pushups', name: 'Push-ups', type: 'bodyweight', primary: 'CHEST', subsections: ['UPPER_CHEST', 'LOWER_CHEST'], secondary: ['TRICEPS', 'FRONT_DELTS'] },
  { id: 'chest_dips', name: 'Chest Dips', type: 'bodyweight', primary: 'CHEST', subsections: ['LOWER_CHEST'], secondary: ['TRICEPS'] },

  // ── BACK ──
  { id: 'deadlift', name: 'Deadlift', type: 'weighted', primary: 'BACK', subsections: ['LOWER_BACK', 'LATS'], secondary: ['HAMSTRINGS', 'GLUTES', 'TRAPS'] },
  { id: 'barbell_row', name: 'Barbell Row', type: 'weighted', primary: 'BACK', subsections: ['LATS', 'TRAPS'], secondary: ['BICEPS', 'REAR_DELTS'] },
  { id: 'lat_pulldown', name: 'Lat Pulldown', type: 'weighted', primary: 'BACK', subsections: ['LATS'], secondary: ['BICEPS'] },
  { id: 'pull_ups', name: 'Pull-ups', type: 'bodyweight', primary: 'BACK', subsections: ['LATS'], secondary: ['BICEPS', 'FOREARMS'] },
  { id: 'seated_row', name: 'Seated Cable Row', type: 'weighted', primary: 'BACK', subsections: ['LATS', 'TRAPS'], secondary: ['BICEPS'] },
  { id: 'face_pull', name: 'Face Pull', type: 'weighted', primary: 'BACK', subsections: ['TRAPS'], secondary: ['REAR_DELTS'] },
  { id: 'back_extension', name: 'Back Extension', type: 'bodyweight', primary: 'BACK', subsections: ['LOWER_BACK'], secondary: ['GLUTES'] },
  { id: 'shrugs', name: 'Shrugs', type: 'weighted', primary: 'BACK', subsections: ['TRAPS'], secondary: ['FOREARMS'] },
  { id: 't_bar_row', name: 'T-Bar Row', type: 'weighted', primary: 'BACK', subsections: ['LATS', 'TRAPS'], secondary: ['BICEPS'] },

  // ── SHOULDERS ──
  { id: 'overhead_press', name: 'Overhead Press', type: 'weighted', primary: 'SHOULDERS', subsections: ['FRONT_DELTS', 'SIDE_DELTS'], secondary: ['TRICEPS'] },
  { id: 'lateral_raise', name: 'Lateral Raise', type: 'weighted', primary: 'SHOULDERS', subsections: ['SIDE_DELTS'], secondary: [] },
  { id: 'front_raise', name: 'Front Raise', type: 'weighted', primary: 'SHOULDERS', subsections: ['FRONT_DELTS'], secondary: [] },
  { id: 'reverse_fly', name: 'Reverse Fly', type: 'weighted', primary: 'SHOULDERS', subsections: ['REAR_DELTS'], secondary: ['TRAPS'] },
  { id: 'arnold_press', name: 'Arnold Press', type: 'weighted', primary: 'SHOULDERS', subsections: ['FRONT_DELTS', 'SIDE_DELTS'], secondary: ['TRICEPS'] },
  { id: 'upright_row', name: 'Upright Row', type: 'weighted', primary: 'SHOULDERS', subsections: ['SIDE_DELTS', 'FRONT_DELTS'], secondary: ['TRAPS'] },

  // ── ARMS ──
  { id: 'barbell_curl', name: 'Barbell Curl', type: 'weighted', primary: 'ARMS', subsections: ['BICEPS'], secondary: ['FOREARMS'] },
  { id: 'dumbbell_curl', name: 'Dumbbell Curl', type: 'weighted', primary: 'ARMS', subsections: ['BICEPS'], secondary: [] },
  { id: 'hammer_curl', name: 'Hammer Curl', type: 'weighted', primary: 'ARMS', subsections: ['BICEPS', 'FOREARMS'], secondary: [] },
  { id: 'tricep_pushdown', name: 'Tricep Pushdown', type: 'weighted', primary: 'ARMS', subsections: ['TRICEPS'], secondary: [] },
  { id: 'skull_crusher', name: 'Skull Crusher', type: 'weighted', primary: 'ARMS', subsections: ['TRICEPS'], secondary: [] },
  { id: 'overhead_tricep', name: 'Overhead Tricep Extension', type: 'weighted', primary: 'ARMS', subsections: ['TRICEPS'], secondary: [] },
  { id: 'close_grip_bench', name: 'Close-Grip Bench Press', type: 'weighted', primary: 'ARMS', subsections: ['TRICEPS'], secondary: ['UPPER_CHEST'] },
  { id: 'wrist_curl', name: 'Wrist Curl', type: 'weighted', primary: 'ARMS', subsections: ['FOREARMS'], secondary: [] },
  { id: 'preacher_curl', name: 'Preacher Curl', type: 'weighted', primary: 'ARMS', subsections: ['BICEPS'], secondary: [] },
  { id: 'diamond_pushups', name: 'Diamond Push-ups', type: 'bodyweight', primary: 'ARMS', subsections: ['TRICEPS'], secondary: ['UPPER_CHEST'] },

  // ── LEGS ──
  { id: 'squat', name: 'Squat', type: 'weighted', primary: 'LEGS', subsections: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS', 'LOWER_BACK'] },
  { id: 'leg_press', name: 'Leg Press', type: 'weighted', primary: 'LEGS', subsections: ['QUADS', 'GLUTES'], secondary: [] },
  { id: 'leg_extension', name: 'Leg Extension', type: 'weighted', primary: 'LEGS', subsections: ['QUADS'], secondary: [] },
  { id: 'leg_curl', name: 'Leg Curl', type: 'weighted', primary: 'LEGS', subsections: ['HAMSTRINGS'], secondary: [] },
  { id: 'romanian_deadlift', name: 'Romanian Deadlift', type: 'weighted', primary: 'LEGS', subsections: ['HAMSTRINGS', 'GLUTES'], secondary: ['LOWER_BACK'] },
  { id: 'calf_raise', name: 'Calf Raise', type: 'weighted', primary: 'LEGS', subsections: ['CALVES'], secondary: [] },
  { id: 'hip_thrust', name: 'Hip Thrust', type: 'weighted', primary: 'LEGS', subsections: ['GLUTES'], secondary: ['HAMSTRINGS'] },
  { id: 'lunges', name: 'Lunges', type: 'weighted', primary: 'LEGS', subsections: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS'] },
  { id: 'bulgarian_split', name: 'Bulgarian Split Squat', type: 'weighted', primary: 'LEGS', subsections: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS'] },
  { id: 'leg_press_calf', name: 'Leg Press Calf Raise', type: 'weighted', primary: 'LEGS', subsections: ['CALVES'], secondary: [] },

  // ── CORE ──
  { id: 'crunches', name: 'Crunches', type: 'bodyweight', primary: 'CORE', subsections: ['ABS'], secondary: [] },
  { id: 'plank', name: 'Plank', type: 'bodyweight', primary: 'CORE', subsections: ['ABS', 'OBLIQUES'], secondary: [] },
  { id: 'russian_twist', name: 'Russian Twist', type: 'bodyweight', primary: 'CORE', subsections: ['OBLIQUES'], secondary: ['ABS'] },
  { id: 'leg_raise', name: 'Leg Raise', type: 'bodyweight', primary: 'CORE', subsections: ['ABS'], secondary: [] },
  { id: 'cable_crunch', name: 'Cable Crunch', type: 'weighted', primary: 'CORE', subsections: ['ABS'], secondary: [] },
  { id: 'woodchop', name: 'Cable Woodchop', type: 'weighted', primary: 'CORE', subsections: ['OBLIQUES'], secondary: ['ABS'] },
  { id: 'ab_wheel', name: 'Ab Wheel Rollout', type: 'bodyweight', primary: 'CORE', subsections: ['ABS'], secondary: [] },
  { id: 'side_plank', name: 'Side Plank', type: 'bodyweight', primary: 'CORE', subsections: ['OBLIQUES'], secondary: [] },
];

/** Quick lookup: exerciseId → exercise object */
export const EXERCISE_MAP = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

/** Exercises grouped by primary body part key */
export const EXERCISES_BY_BODY_PART = BODY_PARTS.reduce((acc, bp) => {
  acc[bp.key] = EXERCISES.filter((e) => e.primary === bp.key);
  return acc;
}, {});

/* ═══════════════════════════════════════════════════
   SCORING CONSTANTS (from reference pipeline)
   ═══════════════════════════════════════════════════ */

/** Strength score weights */
export const SCORE_WEIGHTS = {
  MAX_1RM: 0.4,
  TOTAL_VOLUME: 0.3,
  TOTAL_WEIGHT: 0.2,
  NUM_SETS: 0.1,
};

/** XP distribution: primary vs secondary muscle groups */
export const XP_SPLIT = {
  PRIMARY: 0.7,
  SECONDARY: 0.3,
};

/** Base XP per set for STR workouts */
export const BASE_XP_PER_SET = 12;

/** Bodyweight exercise base XP per set (no external load) */
export const BODYWEIGHT_XP_PER_SET = 8;

/**
 * Epley formula: estimate 1-rep max from weight × reps.
 * 1RM = weight × (1 + reps / 30)
 */
export const epley1RM = (weight, reps) => {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};
