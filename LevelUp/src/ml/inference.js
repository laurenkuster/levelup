/**
 * Client-side ML Inference — Random Forest in React Native.
 *
 * Loads the trained model (bundled as JSON) and runs inference
 * directly on-device. No server needed.
 *
 * The model was trained on 374 samples from the Sleep Health
 * dataset using 12 features → energy score (0–100).
 *
 * Feature vector (must match training order):
 *   [age, sex_numeric, bmi_numeric, sleep_duration, quality,
 *    physical_activity, stress, heart_rate, systolic_bp,
 *    diastolic_bp, daily_steps_k, has_sleep_disorder]
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
 * @param {number[]} featureVector — 12 features in training order
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
 * Build a 12-element feature vector from the app's analytics features.
 *
 * Maps what we have in the app → what the model expects.
 * Features we don't track yet get sensible defaults.
 *
 * @param {Object} f — features from the analytics computation
 * @returns {number[]}
 */
export function buildModelInput(f) {
  return [
    f.age || 30,                   // age
    f.sex_numeric ?? 1,            // sex_numeric (Male=1)
    f.bmi_numeric ?? 0,            // bmi_numeric (Normal=0)
    f.last_night_hours || 7,       // sleep_duration
    f.quality || 3,                // quality (1–9 in training, app uses 1–5 → scale)
    f.physical_activity || 50,     // physical_activity (default moderate)
    f.stress || 5,                 // stress (default moderate)
    f.heart_rate || 72,            // heart_rate
    f.systolic_bp || 120,          // systolic_bp
    f.diastolic_bp || 80,          // diastolic_bp
    f.daily_steps_k || 6,          // daily_steps_k
    f.has_sleep_disorder || 0,     // has_sleep_disorder
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
