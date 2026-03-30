/**
 * statInference.js
 *
 * On-device ML inference for stat models (STR, SPD, STM, DEX).
 *
 * Each model is a Random Forest exported as JSON from the ML-Pipeline.
 * Models predict performance metrics based on user demographics and
 * training history features.
 *
 * STR: predicts Dots score (strength relative to bodyweight)
 * SPD: predicts wind-adjusted speed (m/s)
 * STM: predicts average endurance speed (km/h)
 * DEX: predicts sit-and-reach flexibility (cm)
 * FITNESS: predicts calories burned per workout session
 */

// Lazy-load model weights to avoid blocking app startup
let _models = {};
let _loaded = false;

function loadModels() {
  if (_loaded) return;
  _loaded = true;
  try {
    _models.STR = require('./str_weights.json');
  } catch (e) { console.warn('[statInference] STR model weights not available:', e.message); _models.STR = null; }
  try {
    _models.SPD = require('./spd_weights.json');
  } catch (e) { console.warn('[statInference] SPD model weights not available:', e.message); _models.SPD = null; }
  try {
    _models.STM = require('./stm_weights.json');
  } catch (e) { console.warn('[statInference] STM model weights not available:', e.message); _models.STM = null; }
  try {
    _models.DEX = require('./dex_weights.json');
  } catch { _models.DEX = null; }
  try {
    _models.FITNESS = require('./fitness_weights.json');
  } catch (e) { console.warn('[statInference] FITNESS model weights not available:', e.message); _models.FITNESS = null; }
}

/* ── Tree traversal (same as energy model) ── */

function predictTree(node, features) {
  if (node.leaf !== undefined) return node.leaf;
  if (features[node.feature] < node.threshold) {
    return predictTree(node.left, features);
  }
  return predictTree(node.right, features);
}

function predictForest(model, featureVector) {
  if (!model?.trees?.length) return null;
  const preds = model.trees.map((tree) => predictTree(tree, featureVector));
  return preds.reduce((s, p) => s + p, 0) / preds.length;
}

/* ── Feature builders per stat ── */

/**
 * STR feature vector (16 features):
 * [Age, sex_numeric, BodyweightKg, str_to_bw,
 *  squat_ratio, bench_ratio, deadlift_ratio,
 *  meet_num, career_meets, days_since_last,
 *  total_prev, dots_prev, bw_change,
 *  total_change_pct, total_rolling_mean_3, dots_rolling_mean_3]
 */
function buildStrInput(f) {
  return [
    f.age || 25,
    f.sex_numeric ?? 1,
    f.bodyweightKg || 80,
    f.strToBw || 3.0,
    f.squatRatio || 0,
    f.benchRatio || 0,
    f.deadliftRatio || 0,
    f.sessionNum || 1,
    f.totalSessions || 1,
    f.daysSinceLast || 7,
    f.totalPrev || 0,
    f.dotsPrev || 0,
    f.bwChange || 0,
    f.totalChangePct || 0,
    f.totalRollingMean3 || 0,
    f.dotsRollingMean3 || 0,
  ];
}

/**
 * SPD feature vector (15 features):
 * [age, sex_numeric, weight_kg, height_m, bmi,
 *  session_minutes, distance_km,
 *  avg_bpm, max_bpm, resting_bpm, hr_reserve,
 *  pct_hrr, pct_max_hr,
 *  calories_burned, cal_per_min]
 */
function buildSpdInput(f) {
  const weightKg = f.weightKg || 70;
  const heightM = f.heightM || 1.70;
  const maxBpm = f.maxBpm || (220 - (f.age || 25));
  const restBpm = f.restingBpm || 65;
  const avgBpm = f.avgBpm || Math.round(maxBpm * 0.75);
  const hrReserve = maxBpm - restBpm;
  const sessionMin = f.sessionMinutes ?? 0;
  const cal = f.caloriesBurned ?? 0;
  const calPerMin = sessionMin > 0 && cal > 0 ? cal / sessionMin : (f.calPerMin ?? 0);

  return [
    f.age || 25,
    f.sex_numeric ?? 1,
    weightKg,
    heightM,
    f.bmi || Math.round((weightKg / (heightM * heightM)) * 100) / 100,
    sessionMin,
    f.distanceKm ?? 0,
    avgBpm,
    maxBpm,
    restBpm,
    hrReserve,
    hrReserve > 0 ? Math.round(((avgBpm - restBpm) / hrReserve) * 10000) / 10000 : 0.7,
    maxBpm > 0 ? Math.round((avgBpm / maxBpm) * 10000) / 10000 : 0.75,
    cal,
    Math.round(calPerMin * 100) / 100,
  ];
}

/**
 * STM feature vector (15 features):
 * [age, sex_numeric, weight_kg, height_m, bmi,
 *  session_minutes, running_speed_kmh, distance_km,
 *  avg_bpm, max_bpm, resting_bpm, hr_reserve,
 *  pct_hrr, pct_max_hr,
 *  cal_per_min]
 */
function buildStmInput(f) {
  const weightKg = f.weightKg || 70;
  const heightM = f.heightM || 1.70;
  const maxBpm = f.maxBpm || (220 - (f.age || 25));
  const restBpm = f.restingBpm || 65;
  const avgBpm = f.avgBpm || Math.round(maxBpm * 0.75);
  const hrReserve = maxBpm - restBpm;
  const sessionMin = f.sessionMinutes ?? 0;
  const distKm = f.distanceKm ?? 0;
  const speedKmh = f.speedKmh ?? (sessionMin > 0 && distKm > 0 ? distKm / (sessionMin / 60) : 0);
  const calPerMin = f.calPerMin ?? 0;

  return [
    f.age || 25,
    f.sex_numeric ?? 1,
    weightKg,
    heightM,
    f.bmi || Math.round((weightKg / (heightM * heightM)) * 100) / 100,
    sessionMin,
    Math.round(speedKmh * 10) / 10,
    distKm,
    avgBpm,
    maxBpm,
    restBpm,
    hrReserve,
    hrReserve > 0 ? Math.round(((avgBpm - restBpm) / hrReserve) * 10000) / 10000 : 0.7,
    maxBpm > 0 ? Math.round((avgBpm / maxBpm) * 10000) / 10000 : 0.75,
    Math.round(calPerMin * 100) / 100,
  ];
}

/**
 * DEX feature vector (14 features):
 * [age, sex_numeric, height_cm, weight_kg,
 *  body_fat_pct, bmi, grip_force, grip_ratio,
 *  broad_jump_cm, jump_ratio, situps_count,
 *  situps_per_kg, bp_mean, perf_class_num]
 */
function buildDexInput(f) {
  return [
    f.age || 25,
    f.sex_numeric ?? 1,
    f.heightCm || 170,
    f.weightKg || 70,
    f.bodyFatPct || 20,
    f.bmi || 24,
    f.gripForce || 35,
    f.gripRatio || 0.5,
    f.broadJumpCm || 200,
    f.jumpRatio || 2.8,
    f.situpsCount || 30,
    f.situpsPerKg || 0.43,
    f.bpMean || 85,
    f.perfClassNum ?? 2,
  ];
}

/**
 * FITNESS feature vector (25 features):
 * [age, sex_numeric, weight_kg, height_m, bmi, fat_pct,
 *  lean_mass_kg,
 *  max_bpm, avg_bpm, resting_bpm, hr_reserve, pct_hrr, pct_max_hr,
 *  session_hours, workout_type_num, difficulty_num, body_part_num,
 *  sets, reps, total_reps,
 *  workout_freq, experience_level,
 *  protein_per_kg, pct_carbs, water_intake_l]
 */
function buildFitnessInput(f) {
  const weightKg = f.weightKg || 70;
  const heightM = f.heightM || 1.70;
  const bmi = f.bmi || weightKg / (heightM * heightM);
  const fatPct = f.fatPct || 20;
  const leanMass = f.leanMassKg || (weightKg * (1 - fatPct / 100));
  const maxBpm = f.maxBpm || 190;
  const avgBpm = f.avgBpm || 140;
  const restBpm = f.restingBpm || 65;
  const hrReserve = maxBpm - restBpm;

  return [
    f.age || 25,
    f.sex_numeric ?? 1,
    weightKg,
    heightM,
    Math.round(bmi * 100) / 100,
    fatPct,
    Math.round(leanMass * 100) / 100,
    maxBpm,
    avgBpm,
    restBpm,
    hrReserve,
    hrReserve > 0 ? Math.round(((avgBpm - restBpm) / hrReserve) * 10000) / 10000 : 0.7,
    maxBpm > 0 ? Math.round((avgBpm / maxBpm) * 10000) / 10000 : 0.74,
    f.sessionHours ?? 0,
    f.workoutTypeNum ?? 0, // 0=Strength, 1=HIIT, 2=Cardio, 3=Yoga
    f.difficultyNum ?? 1,  // 0=Beginner, 1=Intermediate, 2=Advanced
    f.bodyPartNum ?? 0,
    f.sets ?? 0,
    f.reps ?? 0,
    (f.sets ?? 0) * (f.reps ?? 0),
    f.workoutFreq ?? 0,
    f.experienceLevel ?? 1,
    f.proteinPerKg ?? 0,
    f.pctCarbs ?? 0,
    f.waterIntakeL ?? 0,
  ];
}

const INPUT_BUILDERS = {
  STR: buildStrInput,
  SPD: buildSpdInput,
  STM: buildStmInput,
  DEX: buildDexInput,
  FITNESS: buildFitnessInput,
};

/* ── Public API ── */

/**
 * Predict a stat metric using the ML model.
 *
 * @param {string} stat - 'STR' | 'SPD' | 'STM' | 'DEX'
 * @param {Object} features - stat-specific feature object
 * @returns {{ prediction: number, model: string, confidence: string } | null}
 */
export function predictStat(stat, features) {
  loadModels();
  const model = _models[stat];
  if (!model) return null;

  const builder = INPUT_BUILDERS[stat];
  if (!builder) return null;

  // Guard: skip calorie/speed predictions for sessions too short to be meaningful
  // Models were trained on 30+ minute sessions — anything under 5 min is out of distribution
  const sessionMin = features.sessionMinutes ?? features.sessionHours * 60 ?? null;
  if (sessionMin !== null && sessionMin < 5 && (stat === 'SPD' || stat === 'STM' || stat === 'FITNESS')) {
    return null;
  }

  const input = builder(features);
  const raw = predictForest(model, input);
  if (raw === null) return null;

  const [lo, hi] = model.target_range || [0, 100];
  const clamped = Math.max(lo, Math.min(hi, raw));

  return {
    prediction: Math.round(clamped * 100) / 100,
    stat,
    target: model.target,
    targetLabel: model.target_label,
    nTrees: model.n_trees,
    mae: model.test_mae,
    r2: model.test_r2,
  };
}

/**
 * Check which stat models are available.
 * @returns {Object} { STR: boolean, SPD: boolean, STM: boolean, DEX: boolean }
 */
export function getAvailableModels() {
  loadModels();
  return {
    STR: !!_models.STR?.trees?.length,
    SPD: !!_models.SPD?.trees?.length,
    STM: !!_models.STM?.trees?.length,
    DEX: !!_models.DEX?.trees?.length,
    FITNESS: !!_models.FITNESS?.trees?.length,
  };
}

/**
 * Get model info for a stat.
 * @param {string} stat
 * @returns {Object|null}
 */
export function getStatModelInfo(stat) {
  loadModels();
  const m = _models[stat];
  if (!m) return null;
  return {
    stat,
    type: m.type,
    nTrees: m.n_trees,
    maxDepth: m.max_depth,
    features: m.feature_names,
    target: m.target,
    targetLabel: m.target_label,
    targetRange: m.target_range,
    trainingSamples: m.training_samples,
    mae: m.test_mae,
    r2: m.test_r2,
  };
}
