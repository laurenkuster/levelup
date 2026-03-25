/**
 * Client-side ML Inference — Random Forest in React Native.
 *
 * Loads the trained model (bundled as JSON) and runs inference
 * directly on-device. No server needed.
 *
 * The model was trained on 572 samples from sleep + quiz + food data
 * using 17 features → energy score (0–100).
 *
 * Feature vector (must match training order):
 *   [age, sex_numeric, bmi_numeric, sleep_hours,
 *    sleep_satisfaction, rolling_sleep_hours_7d,
 *    bedtime_variability_7d, avg_accuracy,
 *    int_score, rolling_int_7d, bmr, attempts_count,
 *    daily_calories, protein_per_kg, pct_carbs,
 *    water_intake_l, cal_balance]
 */

// Import bundled model weights (loaded at build time by Metro)
import modelWeights from './model_weights.json';

/**
 * Traverse a single decision tree node.
 */
function predictTree(node, features) {
  if (node.leaf !== undefined) return node.leaf;
  if (features[node.feature] < node.threshold) {
    return predictTree(node.left, features);
  }
  return predictTree(node.right, features);
}

/**
 * Run Random Forest inference.
 * Returns average prediction across all trees.
 *
 * @param {number[]} featureVector — 17 features in training order
 * @returns {number|null} energy 0–100, or null if model unavailable
 */
export function predictForest(featureVector) {
  if (!modelWeights || !modelWeights.trees || modelWeights.trees.length === 0) {
    return null;
  }

  const predictions = modelWeights.trees.map((tree) => predictTree(tree, featureVector));
  const avg = predictions.reduce((s, p) => s + p, 0) / predictions.length;
  return Math.min(100, Math.max(0, Math.round(avg)));
}

/**
 * Build a 17-element feature vector from the app's analytics features.
 *
 * Maps what we have in the app → what the model expects.
 * Must match the training feature order exactly (see config.py FEATURE_COLUMNS).
 *
 * @param {Object} f — features from the analytics computation
 * @returns {number[]}
 */
export function buildModelInput(f) {
  return [
    f.age || 30,                          // 0: age
    f.sex_numeric ?? 1,                   // 1: sex_numeric (Male=1)
    f.bmi_numeric ?? 0,                   // 2: bmi_numeric (Normal=0)
    f.sleep_hours ?? 7,                   // 3: sleep_hours (last night)
    f.sleep_satisfaction ?? 0.5,          // 4: sleep_satisfaction (0–1, mapped from quality)
    f.rolling_sleep_hours_7d ?? 7,        // 5: 7-day rolling avg sleep hours
    f.bedtime_variability_7d ?? 30,       // 6: 7-day std dev of bedtime (minutes)
    f.avg_accuracy ?? 0.5,               // 7: quiz accuracy (0–1)
    f.int_score ?? 50,                    // 8: INT score (0–100)
    f.rolling_int_7d ?? 50,              // 9: 7-day rolling avg INT score
    f.bmr ?? 1600,                        // 10: BMR (Mifflin-St Jeor)
    f.attempts_count ?? 1,                // 11: daily quiz attempt count
    // Food / nutrition features
    f.daily_calories ?? 2000,             // 12: daily calorie intake
    f.protein_per_kg ?? 1.0,             // 13: protein g per kg bodyweight
    f.pct_carbs ?? 0.45,                 // 14: fraction of cals from carbs
    f.water_intake_l ?? 2.0,             // 15: water intake in liters
    f.cal_balance ?? 0,                   // 16: calorie intake - BMR
  ];
}

/**
 * Get model metadata.
 */
export function getModelInfo() {
  if (!modelWeights) return null;
  return {
    type: modelWeights.type,
    n_trees: modelWeights.n_trees,
    training_samples: modelWeights.training_samples,
    mae: modelWeights.in_sample_mae,
  };
}
