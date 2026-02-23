/**
 * Global ML prediction — powered by trained Random Forest.
 *
 * Uses a 15-tree Random Forest trained on the Sleep Health &
 * Lifestyle dataset (374 samples, 12 features).
 *
 * The model predicts energy (0–100) from:
 *   age, sex, BMI category, sleep duration, quality,
 *   physical activity, stress, heart rate, BP, steps, sleep disorder.
 *
 * Falls back to rule-based prediction if model fails.
 */

import { predictForest, buildModelInput } from './model_inference.js';
import { predictRules } from './predict_rules.js';

/**
 * Get energy prediction from the global ML model.
 *
 * @param {Object} features — feature vector from extractFeatures()
 * @returns {number} predicted energy 0–100
 */
export function getGlobalPrediction(features) {
  try {
    const input = buildModelInput(features);
    const prediction = predictForest(input);

    if (prediction !== null) {
      return prediction;
    }
  } catch (err) {
    console.warn('[ML] Prediction failed, falling back to rules:', err.message);
  }

  // Fallback to rule-based if model unavailable
  return predictRules(features);
}
