/**
 * Per-user calibration — bias correction.
 *
 * Applies a learned bias to the base prediction to personalize
 * the output for each user.
 *
 * bias = mean(actual_energy - predicted_energy) over recent days
 *
 * The calibration object is maintained client-side (AsyncStorage)
 * and sent with each request. The server applies the bias and
 * can suggest an updated bias if new actual data is available.
 *
 * Schema (stored client-side in `levelup_calibration_v1`):
 *   {
 *     bias: number,          // current bias correction
 *     window_days: number,   // how many days of data the bias is computed from
 *     last_updated: string,  // ISO timestamp
 *     predictions: [         // rolling history for bias computation
 *       { date, predicted, actual }
 *     ]
 *   }
 */

/**
 * Apply calibration bias to a base prediction.
 *
 * @param {number} basePrediction — raw prediction 0–100
 * @param {Object|null} calibration — { bias } from client
 * @returns {number} calibrated prediction, clamped 0–100
 */
export function applyCalibration(basePrediction, calibration) {
  const bias = calibration?.bias || 0;
  return Math.min(100, Math.max(0, Math.round(basePrediction + bias)));
}

/**
 * Compute updated bias from prediction history.
 *
 * Called when the client has actual energy labels (or proxy like MP).
 * Uses last N days (N = min(history_days, 7)).
 *
 * @param {Array<{predicted:number, actual:number}>} predictions
 * @returns {{ bias:number, window_days:number }}
 */
export function computeBias(predictions = []) {
  if (!predictions || predictions.length === 0) {
    return { bias: 0, window_days: 0 };
  }

  // Use last 7 entries max
  const recent = predictions.slice(-7);
  const errors = recent.map((p) => (p.actual || 0) - (p.predicted || 0));
  const meanError = errors.reduce((s, e) => s + e, 0) / errors.length;

  return {
    bias: Math.round(meanError * 10) / 10, // 1 decimal place
    window_days: recent.length,
  };
}
