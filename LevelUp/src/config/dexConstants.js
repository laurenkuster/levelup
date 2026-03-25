/**
 * dexConstants.js
 *
 * Flexibility zone hierarchy, stretch/exercise database, and DEX scoring constants.
 *
 * DEX (Dexterity) = Flexibility & Mobility tracking.
 *
 * ── Flexibility Zones ──
 *   HIPS       → Hip Flexors, Glutes, Adductors
 *   LEGS       → Hamstrings, Quads, Calves
 *   SPINE      → Upper Back (Thoracic), Lower Back (Lumbar)
 *   SHOULDERS  → Anterior, Posterior, Overhead
 *   NECK       → Cervical, Upper Traps
 *   CORE       → Lateral (Obliques), Rotational
 *
 * ── Exercise Types ──
 *   static  — hold for time (seconds)
 *   dynamic — reps of movement
 *   yoga    — hold for time with difficulty level
 *
 * ── DEX Score (per session) ──
 *   dex_score = total_hold_time × 0.3 + total_reps × 0.2
 *             + avg_difficulty × 0.3 + num_stretches × 0.2
 *
 * ── XP Distribution ──
 *   Primary zone:   70% of stretch XP
 *   Secondary zones: 30% split evenly
 */

/* ═══════════════════════════════════════════════════
   FLEXIBILITY ZONES & SUBSECTIONS
   ═══════════════════════════════════════════════════ */

export const FLEX_ZONES = [
  {
    key: 'HIPS',
    label: 'Hips',
    icon: 'hips',
    color: '#f97316', // orange
    subsections: [
      { key: 'HIP_FLEXORS', label: 'Hip Flexors' },
      { key: 'GLUTES_FLEX', label: 'Glutes' },
      { key: 'ADDUCTORS', label: 'Adductors' },
    ],
  },
  {
    key: 'LEGS',
    label: 'Legs',
    icon: 'legs',
    color: '#a855f7', // purple
    subsections: [
      { key: 'HAMSTRINGS_FLEX', label: 'Hamstrings' },
      { key: 'QUADS_FLEX', label: 'Quads' },
      { key: 'CALVES_FLEX', label: 'Calves' },
    ],
  },
  {
    key: 'SPINE',
    label: 'Spine',
    icon: 'spine',
    color: '#3b82f6', // blue
    subsections: [
      { key: 'THORACIC', label: 'Upper Back' },
      { key: 'LUMBAR', label: 'Lower Back' },
    ],
  },
  {
    key: 'SHOULDERS',
    label: 'Shoulders',
    icon: 'shoulders',
    color: '#22c55e', // green
    subsections: [
      { key: 'ANTERIOR', label: 'Anterior' },
      { key: 'POSTERIOR', label: 'Posterior' },
      { key: 'OVERHEAD', label: 'Overhead' },
    ],
  },
  {
    key: 'NECK',
    label: 'Neck',
    icon: 'neck',
    color: '#eab308', // yellow
    subsections: [
      { key: 'CERVICAL', label: 'Cervical' },
      { key: 'UPPER_TRAPS_FLEX', label: 'Upper Traps' },
    ],
  },
  {
    key: 'CORE',
    label: 'Core',
    icon: 'core',
    color: '#06b6d4', // cyan
    subsections: [
      { key: 'LATERAL', label: 'Lateral' },
      { key: 'ROTATIONAL', label: 'Rotational' },
    ],
  },
];

/* ═══════════════════════════════════════════════════
   STRETCH / EXERCISE DATABASE
   ═══════════════════════════════════════════════════
   type: 'static' (hold for seconds), 'dynamic' (reps), 'yoga' (hold + difficulty)
   difficulty: 1-5 (only for yoga, ignored for static/dynamic)
   ═══════════════════════════════════════════════════ */

export const STRETCHES = [
  // ── HIPS ──
  { id: 'pigeon_pose', name: 'Pigeon Pose', type: 'yoga', difficulty: 3, primary: 'HIPS', subsections: ['GLUTES_FLEX', 'HIP_FLEXORS'], secondary: ['HAMSTRINGS_FLEX'] },
  { id: 'hip_flexor_lunge', name: 'Hip Flexor Lunge Stretch', type: 'static', difficulty: 2, primary: 'HIPS', subsections: ['HIP_FLEXORS'], secondary: ['QUADS_FLEX'] },
  { id: 'butterfly_stretch', name: 'Butterfly Stretch', type: 'static', difficulty: 1, primary: 'HIPS', subsections: ['ADDUCTORS', 'HIP_FLEXORS'], secondary: [] },
  { id: 'hip_90_90', name: 'Hip Stretch', type: 'static', difficulty: 3, primary: 'HIPS', subsections: ['GLUTES_FLEX', 'HIP_FLEXORS'], secondary: [] },
  { id: 'hip_circles', name: 'Hip Circles', type: 'dynamic', difficulty: 1, primary: 'HIPS', subsections: ['HIP_FLEXORS', 'GLUTES_FLEX', 'ADDUCTORS'], secondary: [] },
  { id: 'frog_stretch', name: 'Frog Stretch', type: 'static', difficulty: 3, primary: 'HIPS', subsections: ['ADDUCTORS', 'HIP_FLEXORS'], secondary: [] },
  { id: 'lizard_pose', name: 'Lizard Pose', type: 'yoga', difficulty: 3, primary: 'HIPS', subsections: ['HIP_FLEXORS', 'ADDUCTORS'], secondary: ['HAMSTRINGS_FLEX'] },
  { id: 'happy_baby', name: 'Happy Baby Pose', type: 'yoga', difficulty: 1, primary: 'HIPS', subsections: ['ADDUCTORS', 'GLUTES_FLEX'], secondary: ['LUMBAR'] },

  // ── LEGS ──
  { id: 'standing_hamstring', name: 'Standing Hamstring Stretch', type: 'static', difficulty: 1, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX'], secondary: ['CALVES_FLEX'] },
  { id: 'seated_forward_fold', name: 'Seated Forward Fold', type: 'yoga', difficulty: 2, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX'], secondary: ['LUMBAR'] },
  { id: 'standing_quad_stretch', name: 'Standing Quad Stretch', type: 'static', difficulty: 1, primary: 'LEGS', subsections: ['QUADS_FLEX'], secondary: ['HIP_FLEXORS'] },
  { id: 'couch_stretch', name: 'Couch Stretch', type: 'static', difficulty: 3, primary: 'LEGS', subsections: ['QUADS_FLEX', 'HIP_FLEXORS'], secondary: [] },
  { id: 'calf_wall_stretch', name: 'Wall Calf Stretch', type: 'static', difficulty: 1, primary: 'LEGS', subsections: ['CALVES_FLEX'], secondary: [] },
  { id: 'downward_dog', name: 'Downward Dog', type: 'yoga', difficulty: 2, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX', 'CALVES_FLEX'], secondary: ['POSTERIOR', 'LUMBAR'] },
  { id: 'leg_swings', name: 'Leg Swings', type: 'dynamic', difficulty: 1, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX', 'QUADS_FLEX'], secondary: ['HIP_FLEXORS'] },
  { id: 'splits_progression', name: 'Splits Progression', type: 'static', difficulty: 5, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX', 'QUADS_FLEX'], secondary: ['ADDUCTORS', 'HIP_FLEXORS'] },
  { id: 'pyramid_pose', name: 'Pyramid Pose', type: 'yoga', difficulty: 2, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX'], secondary: ['CALVES_FLEX'] },

  // ── SPINE ──
  { id: 'cat_cow', name: 'Cat-Cow', type: 'dynamic', difficulty: 1, primary: 'SPINE', subsections: ['THORACIC', 'LUMBAR'], secondary: [] },
  { id: 'childs_pose', name: "Child's Pose", type: 'yoga', difficulty: 1, primary: 'SPINE', subsections: ['LUMBAR', 'THORACIC'], secondary: ['POSTERIOR'] },
  { id: 'seated_twist', name: 'Seated Spinal Twist', type: 'static', difficulty: 2, primary: 'SPINE', subsections: ['THORACIC', 'LUMBAR'], secondary: ['ROTATIONAL'] },
  { id: 'thoracic_extension', name: 'Thoracic Extension', type: 'static', difficulty: 2, primary: 'SPINE', subsections: ['THORACIC'], secondary: [] },
  { id: 'cobra_pose', name: 'Cobra Pose', type: 'yoga', difficulty: 2, primary: 'SPINE', subsections: ['LUMBAR', 'THORACIC'], secondary: ['ANTERIOR'] },
  { id: 'thread_needle', name: 'Thread the Needle', type: 'yoga', difficulty: 2, primary: 'SPINE', subsections: ['THORACIC'], secondary: ['POSTERIOR'] },
  { id: 'sphinx_pose', name: 'Sphinx Pose', type: 'yoga', difficulty: 1, primary: 'SPINE', subsections: ['LUMBAR'], secondary: [] },
  { id: 'supine_twist', name: 'Supine Twist', type: 'static', difficulty: 1, primary: 'SPINE', subsections: ['THORACIC', 'LUMBAR'], secondary: ['LATERAL'] },

  // ── SHOULDERS ──
  { id: 'cross_body_shoulder', name: 'Cross-Body Shoulder Stretch', type: 'static', difficulty: 1, primary: 'SHOULDERS', subsections: ['POSTERIOR'], secondary: [] },
  { id: 'doorway_chest_stretch', name: 'Doorway Chest Stretch', type: 'static', difficulty: 1, primary: 'SHOULDERS', subsections: ['ANTERIOR'], secondary: [] },
  { id: 'overhead_tricep_stretch', name: 'Overhead Tricep Stretch', type: 'static', difficulty: 1, primary: 'SHOULDERS', subsections: ['OVERHEAD'], secondary: [] },
  { id: 'arm_circles', name: 'Arm Circles', type: 'dynamic', difficulty: 1, primary: 'SHOULDERS', subsections: ['ANTERIOR', 'POSTERIOR', 'OVERHEAD'], secondary: [] },
  { id: 'eagle_arms', name: 'Eagle Arms', type: 'yoga', difficulty: 2, primary: 'SHOULDERS', subsections: ['POSTERIOR', 'OVERHEAD'], secondary: ['UPPER_TRAPS_FLEX'] },
  { id: 'cow_face_arms', name: 'Cow Face Arms', type: 'yoga', difficulty: 3, primary: 'SHOULDERS', subsections: ['ANTERIOR', 'OVERHEAD'], secondary: [] },
  { id: 'wall_angels', name: 'Wall Angels', type: 'dynamic', difficulty: 2, primary: 'SHOULDERS', subsections: ['OVERHEAD', 'POSTERIOR'], secondary: ['THORACIC'] },
  { id: 'shoulder_dislocates', name: 'Shoulder Dislocates (Band)', type: 'dynamic', difficulty: 3, primary: 'SHOULDERS', subsections: ['ANTERIOR', 'POSTERIOR', 'OVERHEAD'], secondary: [] },

  // ── NECK ──
  { id: 'neck_tilts', name: 'Neck Side Tilts', type: 'static', difficulty: 1, primary: 'NECK', subsections: ['CERVICAL', 'UPPER_TRAPS_FLEX'], secondary: [] },
  { id: 'chin_tucks', name: 'Chin Tucks', type: 'dynamic', difficulty: 1, primary: 'NECK', subsections: ['CERVICAL'], secondary: [] },
  { id: 'neck_rotations', name: 'Neck Rotations', type: 'dynamic', difficulty: 1, primary: 'NECK', subsections: ['CERVICAL'], secondary: [] },
  { id: 'upper_trap_stretch', name: 'Upper Trap Stretch', type: 'static', difficulty: 1, primary: 'NECK', subsections: ['UPPER_TRAPS_FLEX'], secondary: [] },
  { id: 'levator_scap_stretch', name: 'Levator Scap Stretch', type: 'static', difficulty: 2, primary: 'NECK', subsections: ['UPPER_TRAPS_FLEX', 'CERVICAL'], secondary: [] },

  // ── CORE ──
  { id: 'standing_side_bend', name: 'Standing Side Bend', type: 'static', difficulty: 1, primary: 'CORE', subsections: ['LATERAL'], secondary: [] },
  { id: 'seated_side_stretch', name: 'Seated Side Stretch', type: 'static', difficulty: 1, primary: 'CORE', subsections: ['LATERAL'], secondary: [] },
  { id: 'trunk_rotations', name: 'Trunk Rotations', type: 'dynamic', difficulty: 1, primary: 'CORE', subsections: ['ROTATIONAL'], secondary: ['THORACIC'] },
  { id: 'open_book', name: 'Open Book Stretch', type: 'static', difficulty: 2, primary: 'CORE', subsections: ['ROTATIONAL'], secondary: ['THORACIC'] },
  { id: 'scorpion_stretch', name: 'Scorpion Stretch', type: 'static', difficulty: 3, primary: 'CORE', subsections: ['ROTATIONAL', 'LATERAL'], secondary: ['HIP_FLEXORS'] },
  { id: 'windmill_stretch', name: 'Windmill Stretch', type: 'dynamic', difficulty: 2, primary: 'CORE', subsections: ['LATERAL', 'ROTATIONAL'], secondary: ['HAMSTRINGS_FLEX'] },

  // ── FULL BODY / YOGA FLOWS ──
  { id: 'sun_salutation', name: 'Sun Salutation', type: 'yoga', difficulty: 3, primary: 'SPINE', subsections: ['THORACIC', 'LUMBAR'], secondary: ['HAMSTRINGS_FLEX', 'ANTERIOR', 'HIP_FLEXORS'] },
  { id: 'warrior_1', name: 'Warrior I', type: 'yoga', difficulty: 2, primary: 'HIPS', subsections: ['HIP_FLEXORS'], secondary: ['QUADS_FLEX', 'OVERHEAD'] },
  { id: 'warrior_2', name: 'Warrior II', type: 'yoga', difficulty: 2, primary: 'HIPS', subsections: ['ADDUCTORS', 'HIP_FLEXORS'], secondary: ['QUADS_FLEX'] },
  { id: 'triangle_pose', name: 'Triangle Pose', type: 'yoga', difficulty: 2, primary: 'LEGS', subsections: ['HAMSTRINGS_FLEX'], secondary: ['LATERAL', 'ADDUCTORS'] },
  { id: 'tree_pose', name: 'Tree Pose', type: 'yoga', difficulty: 2, primary: 'HIPS', subsections: ['ADDUCTORS'], secondary: [] },
  { id: 'camel_pose', name: 'Camel Pose', type: 'yoga', difficulty: 4, primary: 'SPINE', subsections: ['THORACIC', 'LUMBAR'], secondary: ['ANTERIOR', 'HIP_FLEXORS', 'QUADS_FLEX'] },
  { id: 'bridge_pose', name: 'Bridge Pose', type: 'yoga', difficulty: 2, primary: 'SPINE', subsections: ['LUMBAR'], secondary: ['HIP_FLEXORS', 'ANTERIOR'] },
  { id: 'wheel_pose', name: 'Wheel Pose', type: 'yoga', difficulty: 5, primary: 'SPINE', subsections: ['THORACIC', 'LUMBAR'], secondary: ['ANTERIOR', 'HIP_FLEXORS', 'OVERHEAD'] },
];

/** Quick lookup: stretchId → stretch object */
export const STRETCH_MAP = Object.fromEntries(STRETCHES.map((s) => [s.id, s]));

/** Stretches grouped by primary zone */
export const STRETCHES_BY_ZONE = FLEX_ZONES.reduce((acc, zone) => {
  acc[zone.key] = STRETCHES.filter((s) => s.primary === zone.key);
  return acc;
}, {});

/* ═══════════════════════════════════════════════════
   SCORING CONSTANTS
   ═══════════════════════════════════════════════════ */

/** DEX score weights (per session) */
export const DEX_SCORE_WEIGHTS = {
  TOTAL_HOLD_TIME: 0.3,  // total seconds held across all stretches
  TOTAL_REPS: 0.2,       // total reps for dynamic stretches
  AVG_DIFFICULTY: 0.3,   // average difficulty of stretches performed
  NUM_STRETCHES: 0.2,    // number of distinct stretches
};

/** XP distribution: primary vs secondary zones */
export const DEX_XP_SPLIT = {
  PRIMARY: 0.7,
  SECONDARY: 0.3,
};

/** Base XP per stretch performed */
export const BASE_XP_PER_STRETCH = 10;

/** Bonus XP per 30s of hold time */
export const HOLD_TIME_XP_PER_30S = 3;

/** Difficulty multipliers for XP */
export const DIFFICULTY_MULT = {
  1: 1.0,
  2: 1.2,
  3: 1.5,
  4: 1.8,
  5: 2.2,
};
