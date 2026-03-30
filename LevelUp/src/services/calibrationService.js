/**
 * Calibration Service — per-user bias management.
 *
 * Stores calibration data in AsyncStorage:
 *   key: 'levelup_calibration_v1'
 *   value: {
 *     bias: number,
 *     window_days: number,
 *     last_updated: string,
 *     predictions: [{ date, predicted, actual }]
 *   }
 *
 * The bias is sent to the server with each analytics request.
 * When the user provides actual energy feedback (or a proxy like MP),
 * call updateCalibration() to improve predictions over time.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveData, loadData } from './firestoreSync';

const CALIBRATION_KEY = 'levelup_calibration_v1';
const CALIBRATION_DOC = 'calibration';

/**
 * Get the current calibration object.
 * @returns {Promise<{bias:number, window_days:number, predictions:Array}|null>}
 */
export async function getCalibration() {
  try {
    return await loadData(CALIBRATION_KEY, CALIBRATION_DOC);
  } catch (e) {
    console.warn('[calibrationService] Failed to load calibration data:', e.message);
    return null;
  }
}

/**
 * Get just the bias value (for quick access).
 * @returns {Promise<number>}
 */
export async function getBias() {
  const cal = await getCalibration();
  return cal?.bias || 0;
}

/**
 * Record a prediction for today (called after getting analytics).
 * @param {string} date — YYYY-MM-DD
 * @param {number} predicted — energy score returned by server
 */
export async function recordPrediction(date, predicted) {
  try {
    const cal = (await getCalibration()) || { bias: 0, window_days: 0, predictions: [] };

    // Don't duplicate same date
    if (!cal.predictions.some((p) => p.date === date)) {
      cal.predictions.push({ date, predicted, actual: null });
      // Keep last 14 entries
      cal.predictions = cal.predictions.slice(-14);
      await saveData(CALIBRATION_KEY, CALIBRATION_DOC, cal);
    }
  } catch (e) {
    console.warn('[calibrationService] Failed to record prediction:', e.message);
  }
}

/**
 * Update calibration with an actual energy value.
 * Recomputes bias from all entries that have both predicted and actual.
 *
 * @param {string} date — YYYY-MM-DD
 * @param {number} actual — actual energy (0–100)
 */
export async function updateCalibration(date, actual) {
  try {
    const cal = (await getCalibration()) || { bias: 0, window_days: 0, predictions: [] };

    // Update the entry for this date
    const entry = cal.predictions.find((p) => p.date === date);
    if (entry) {
      entry.actual = actual;
    } else {
      cal.predictions.push({ date, predicted: null, actual });
    }

    // Recompute bias from entries that have both predicted and actual
    const complete = cal.predictions.filter((p) => p.predicted != null && p.actual != null);
    const recent = complete.slice(-7);

    if (recent.length > 0) {
      const errors = recent.map((p) => p.actual - p.predicted);
      cal.bias = Math.round((errors.reduce((s, e) => s + e, 0) / errors.length) * 10) / 10;
      cal.window_days = recent.length;
    }

    cal.last_updated = new Date().toISOString();
    cal.predictions = cal.predictions.slice(-14);

    await saveData(CALIBRATION_KEY, CALIBRATION_DOC, cal);

    // Track calibration event
    try {
      const { trackMLCalibration } = require('./trackingService');
      trackMLCalibration({ bias: cal.bias, scaleFactor: cal.scale_factor || 1, dataPoints: recent.length });
    } catch { /* silent */ }

    return cal;
  } catch (e) {
    console.warn('[calibrationService] Failed to update calibration:', e.message);
    return null;
  }
}

/**
 * Save calibration update from server response.
 * @param {{ bias:number, window_days:number }} update
 */
export async function saveCalibrationUpdate(update) {
  try {
    const cal = (await getCalibration()) || { bias: 0, window_days: 0, predictions: [] };
    cal.bias = update.bias;
    cal.window_days = update.window_days;
    cal.last_updated = new Date().toISOString();
    await saveData(CALIBRATION_KEY, CALIBRATION_DOC, cal);
  } catch (e) {
    console.warn('[calibrationService] Failed to save calibration update:', e.message);
  }
}
