/**
 * crossStatConstants.js
 *
 * Research-backed constants for cross-stat interactions.
 *
 * Sources:
 *   Sleep:       Craven et al. 2022 meta-analysis (Frontiers Physiology)
 *                Mah et al. 2011 (sleep extension, Stanford basketball)
 *                Milewski et al. 2014 (sleep & injury risk)
 *   Concurrent:  Wilson et al. 2012 meta-analysis (J Strength Cond Res)
 *   STR→SPD:     Wisloff et al. 2004 (Br J Sports Med)
 *   BDNF:        Szuhany et al. 2015 meta-analysis (J Psychiatr Res)
 *   Nutrition:   Morton et al. 2018 (Br J Sports Med)
 *   Stretching:  Behm et al. 2021 (Scand J Med Sci Sports)
 *   Overtraining: Meeusen et al. 2013 (Med Sci Sports Exerc)
 */

/* ── sleep → performance multipliers ─────────────── */
// Based on Craven et al. 2022: mean 7.56% decrement with deprivation
// Mah 2011: 4.3% improvement with extension to 10h
export const SLEEP_XP_MULT = [
  { maxHours: 4,  mult: 0.60, label: 'SEVERE DEPRIVATION' },
  { maxHours: 5,  mult: 0.70, label: 'HEAVY DEPRIVATION' },
  { maxHours: 6,  mult: 0.80, label: 'MILD DEPRIVATION' },
  { maxHours: 7,  mult: 0.92, label: 'SUBOPTIMAL' },
  { maxHours: 8,  mult: 1.00, label: 'ADEQUATE' },
  { maxHours: 9,  mult: 1.08, label: 'OPTIMAL' },
  { maxHours: 24, mult: 1.12, label: 'EXTENDED' },
];

// Sleep affects stats differently (effect sizes from meta-analysis)
// Skill: -0.87, Endurance: -0.76, Speed: -0.58, Power: -0.46, Strength: -0.24
export const SLEEP_STAT_SENSITIVITY = {
  INT: 1.0,   // skill/cognitive most affected
  STM: 0.87,  // endurance heavily affected
  SPD: 0.67,  // speed moderately affected
  DEX: 0.53,  // power/flexibility moderately affected
  STR: 0.28,  // strength least affected
};

/* ── concurrent training interference ─────────────── */
// Wilson et al. 2012: power gains reduced ~28% with concurrent training
// Running interference stronger than cycling (Type I fiber SMD = -0.81)
export const CONCURRENT_PENALTY = {
  // Same-day STR + STM: penalize power/strength XP
  STR_STM_SAME_DAY: 0.85,  // 15% penalty on STR XP when STM also done same day
  STM_STR_SAME_DAY: 0.95,  // 5% penalty on STM (endurance less affected)
  // Minimum hours between sessions to avoid interference
  MIN_SEPARATION_HOURS: 6,
};

/* ── strength → speed synergy ────────────────────── */
// Wisloff 2004: r = -0.71 to -0.85 between squat and sprint
// Higher STR level = bonus SPD XP
export const STR_SPD_SYNERGY = [
  { minStrLevel: 1,  spdBonus: 1.00 },
  { minStrLevel: 5,  spdBonus: 1.05 },
  { minStrLevel: 10, spdBonus: 1.10 },
  { minStrLevel: 20, spdBonus: 1.15 },
  { minStrLevel: 30, spdBonus: 1.20 },
];

/* ── exercise → BDNF → INT boost ─────────────────── */
// Szuhany 2015: single bout increases BDNF 28-38%
// Benefits last ~2 hours post-exercise
// 3+ sessions/week for chronic benefit
export const EXERCISE_INT_BOOST = {
  ACUTE_WINDOW_HOURS: 24,     // any physical training in last 24h
  ACUTE_BOOST: 1.08,          // +8% INT XP if exercised recently
  CHRONIC_SESSIONS_WEEK: 3,   // minimum sessions/week for chronic boost
  CHRONIC_BOOST: 1.12,        // +12% INT XP with consistent exercise
};

/* ── nutrition → training adaptation ─────────────── */
// Morton 2018: 1.6-2.2 g/kg/day protein optimal for MPS
// Energy deficit fully blunts lean mass gains
export const NUTRITION_MULTIPLIERS = {
  PROTEIN_ADEQUATE_RATIO: 0.8,   // ratio of actual/goal that counts as "adequate"
  PROTEIN_STR_BOOST: 1.10,       // +10% STR XP when protein adequate
  PROTEIN_STR_PENALTY: 0.85,     // -15% STR XP when protein very low
  DEFICIT_THRESHOLD_KCAL: -500,  // kcal balance below this = penalty
  DEFICIT_STR_PENALTY: 0.90,     // -10% STR XP in significant deficit
  SURPLUS_STR_BOOST: 1.05,       // +5% STR XP in moderate surplus (300-500kcal)
  SURPLUS_MAX_KCAL: 500,
};

/* ── stretching timing → strength impact ──────────── */
// Behm 2021: static stretch >60s = ES -0.84 on max strength
// <30s has no significant effect (-1.1%)
export const DEX_STR_INTERACTION = {
  // DEX session before STR on same day → small STR penalty
  SAME_DAY_PENALTY: 0.95,  // -5% (conservative; full effect is larger)
  // DEX done day before → no effect
  RECOVERY_HOURS: 12,
};

/* ── supercompensation windows (hours) ───────────── */
// Meeusen 2013; standard sports science periodization
export const RECOVERY_WINDOWS = {
  STR: { min: 48, optimal: 72, label: '48-72h' },
  STM: { min: 18, optimal: 36, label: '18-36h' },
  SPD: { min: 24, optimal: 48, label: '24-48h' },
  DEX: { min: 6,  optimal: 12, label: '6-12h' },
  INT: { min: 4,  optimal: 8,  label: '4-8h' },
};

/* ── overtraining risk thresholds ─────────────────── */
// Based on Meeusen 2013 continuum model
export const OVERTRAINING = {
  // Weekly training load index (sessions × avg intensity 1-10)
  FUNCTIONAL_MAX: 35,     // above this = functional overreaching
  NONFUNCTIONAL_THRESHOLD: 50, // above this = nonfunctional overreaching risk
  // Consecutive training days without rest
  MAX_CONSECUTIVE_DAYS: 6,
  // Sleep debt (hours below 8h accumulated over 7 days)
  SLEEP_DEBT_WARNING: 7,   // 7h total debt = 1h/night average
  SLEEP_DEBT_DANGER: 14,   // 2h/night average deficit
};

/* ── recovery readiness thresholds ───────────────── */
export const READINESS = {
  FULL: { min: 80, label: 'READY', color: '#22c55e' },
  MODERATE: { min: 60, label: 'MODERATE', color: '#f59e0b' },
  LOW: { min: 40, label: 'FATIGUED', color: '#f97316' },
  DEPLETED: { min: 0, label: 'RECOVER', color: '#ef4444' },
};
