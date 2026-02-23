/**
 * ML Model Inference — Random Forest in pure JS.
 *
 * Loads the trained model from model_weights.json and provides
 * prediction via traversing the decision trees.
 *
 * The model was trained on the Sleep Health & Lifestyle dataset
 * (374 samples) using features aligned with the app's data.
 *
 * Feature vector (order matters — must match training):
 *   [age, sex_numeric, bmi_numeric, sleep_duration, quality,
 *    physical_activity, stress, heart_rate, systolic_bp,
 *    diastolic_bp, daily_steps_k, has_sleep_disorder]
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load model weights at startup ──
let model = null;

function loadModel() {
  if (model) return model;
  try {
    const raw = readFileSync(join(__dirname, 'model_weights.json'), 'utf8');
    model = JSON.parse(raw);
    console.log(`[ML] Loaded Random Forest: ${model.n_trees} trees, MAE=${model.in_sample_mae}`);
    return model;
  } catch (err) {
    console.error('[ML] Failed to load model:', err.message);
    return null;
  }
}

/**
 * Traverse a single decision tree to get a prediction.
 */
function predictTree(node, features) {
  if (node.leaf !== undefined) return node.leaf;
  if (features[node.feature] < node.threshold) {
    return predictTree(node.left, features);
  }
  return predictTree(node.right, features);
}

/**
 * Predict energy score using the Random Forest ensemble.
 * Returns the average prediction across all trees.
 *
 * @param {number[]} featureVector — 12 features in training order
 * @returns {number} predicted energy 0–100
 */
export function predictForest(featureVector) {
  const m = loadModel();
  if (!m || !m.trees || m.trees.length === 0) {
    return null; // model not available
  }

  const predictions = m.trees.map((tree) => predictTree(tree, featureVector));
  const avg = predictions.reduce((s, p) => s + p, 0) / predictions.length;
  return Math.min(100, Math.max(0, Math.round(avg)));
}

/**
 * Build a feature vector from the app's feature object.
 * Maps the analytics features → model's expected input order.
 *
 * @param {Object} features — from extractFeatures()
 * @returns {number[]} 12-element vector
 */
export function buildModelInput(features) {
  return [
    features.age || 30,
    features.sex_numeric ?? 1,
    0, // bmi_numeric — derive from BMI or default Normal
    features.last_night_hours || 7,
    features.quality || 5,
    50, // physical_activity — default moderate (not tracked in app yet)
    5,  // stress — default moderate (not tracked in app yet)
    72, // heart_rate — default (not tracked yet)
    120, // systolic_bp — default
    80,  // diastolic_bp — default
    6,   // daily_steps_k — default 6000 steps
    0,   // has_sleep_disorder — default no
  ];
}

/**
 * Get model metadata for debugging/display.
 */
export function getModelInfo() {
  const m = loadModel();
  if (!m) return null;
  return {
    type: m.type,
    n_trees: m.n_trees,
    training_samples: m.training_samples,
    mae: m.in_sample_mae,
    rmse: m.in_sample_rmse,
    features: m.feature_names,
  };
}
