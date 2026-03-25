/**
 * sensorService.js
 *
 * Shared motion-sensor abstraction for SPD and STM tracking.
 * Uses expo-sensors Pedometer (primary) + Accelerometer (fallback/enrichment).
 *
 * Sensors are loaded lazily to avoid crashing if native modules
 * haven't been rebuilt yet (expo-sensors has native code).
 */

import { loadData, SYNC_DOCS } from './firestoreSync';

let _Accelerometer = null;
let _Pedometer = null;
let _sensorsLoaded = false;

function loadSensors() {
  if (_sensorsLoaded) return;
  _sensorsLoaded = true;
  try {
    const sensors = require('expo-sensors');
    _Accelerometer = sensors.Accelerometer;
    _Pedometer = sensors.Pedometer;
  } catch (e) {
    console.warn('[sensorService] expo-sensors not available:', e.message);
  }
}

const PROFILE_KEY = 'levelup_profile_v1';
const STRIDE_FACTOR = 0.415; // height(cm) * 0.415 → stride(m) for running
const ACCEL_INTERVAL = 50; // ms (20 Hz)

/* ── permissions ───────────────────── */

export async function requestSensorPermissions() {
  loadSensors();
  const results = { accelerometer: false, pedometer: false };

  if (!_Accelerometer && !_Pedometer) {
    console.warn('[sensorService] Sensors not available — native rebuild required');
    return results;
  }

  try {
    if (_Accelerometer) {
      const accelPerm = await _Accelerometer.requestPermissionsAsync();
      results.accelerometer = accelPerm.status === 'granted';
    }
  } catch { results.accelerometer = true; } // some platforms don't require permission

  try {
    if (_Pedometer) {
      const pedAvailable = await _Pedometer.isAvailableAsync();
      if (pedAvailable) {
        const pedPerm = await _Pedometer.requestPermissionsAsync();
        results.pedometer = pedPerm.status === 'granted';
      }
    }
  } catch { /* pedometer not available */ }

  return results;
}

/* ── stride length from user profile ── */

export async function getStrideLengthM() {
  try {
    const profile = await loadData(PROFILE_KEY, SYNC_DOCS.PROFILE);
    const heightCm = parseFloat(profile?.height);
    if (heightCm && heightCm > 0) return heightCm * STRIDE_FACTOR / 100; // convert cm→m
  } catch { /* ignore */ }
  return 0.75; // default ~5'9" person
}

/* ── session recorder ──────────────── */

/**
 * Creates a recording session that tracks motion sensors.
 * Call start() to begin, stop() to end and get computed metrics.
 */
export function createSensorSession(strideLengthM) {
  loadSensors();
  let accelSub = null;
  let accelSamples = []; // [{ x, y, z, mag, t }]
  let startTime = null;
  let pedometerStart = null;

  const start = () => {
    accelSamples = [];
    startTime = Date.now();
    pedometerStart = new Date();

    if (_Accelerometer) {
      _Accelerometer.setUpdateInterval(ACCEL_INTERVAL);
      accelSub = _Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        accelSamples.push({ x, y, z, mag, t: Date.now() });
      });
    }
  };

  const stop = async () => {
    if (accelSub) {
      accelSub.remove();
      accelSub = null;
    }

    const endTime = Date.now();
    const pedometerEnd = new Date();
    const elapsedMs = endTime - (startTime || endTime);
    const elapsedS = elapsedMs / 1000;

    // Try pedometer for step count
    let steps = 0;
    try {
      if (_Pedometer) {
        const pedAvailable = await _Pedometer.isAvailableAsync();
        if (pedAvailable && pedometerStart) {
          const result = await _Pedometer.getStepCountAsync(pedometerStart, pedometerEnd);
          steps = result?.steps || 0;
        }
      }
    } catch { /* pedometer unavailable */ }

    // Fallback: estimate steps from accelerometer peaks if pedometer gave nothing
    if (steps === 0 && accelSamples.length > 10) {
      steps = estimateStepsFromAccel(accelSamples);
    }

    return computeMetrics(steps, elapsedS, strideLengthM, accelSamples);
  };

  const getElapsed = () => (startTime ? (Date.now() - startTime) / 1000 : 0);

  const getLiveSteps = () => {
    if (accelSamples.length < 10) return 0;
    return estimateStepsFromAccel(accelSamples);
  };

  return { start, stop, getElapsed, getLiveSteps };
}

/* ── step estimation from accelerometer ── */

function estimateStepsFromAccel(samples) {
  if (samples.length < 4) return 0;

  // Compute mean magnitude
  const meanMag = samples.reduce((s, v) => s + v.mag, 0) / samples.length;

  // Count peaks above mean + threshold (zero-crossing approach)
  const threshold = 0.3;
  let peaks = 0;
  let above = false;
  for (const s of samples) {
    if (s.mag > meanMag + threshold) {
      if (!above) peaks++;
      above = true;
    } else {
      above = false;
    }
  }

  return peaks;
}

/* ── metrics computation ───────────── */

function computeMetrics(steps, elapsedS, strideLengthM, samples) {
  if (elapsedS <= 0) {
    return {
      steps: 0, distanceM: 0, distanceMi: 0, distanceKm: 0,
      avgSpeedMs: 0, avgSpeedMph: 0, maxSpeedMph: 0,
      paceMinPerMi: 0, cadence: 0, consistency: 0, elapsedS: 0,
    };
  }

  const distanceM = steps * strideLengthM;
  const distanceMi = distanceM * 0.000621371;
  const distanceKm = distanceM * 0.001;

  const avgSpeedMs = distanceM / elapsedS;
  const avgSpeedMph = avgSpeedMs * 2.23694;

  // Pace (min per mile) — guard div-by-zero
  const paceMinPerMi = distanceMi > 0 ? (elapsedS / 60) / distanceMi : 0;

  // Cadence (steps per minute)
  const cadence = elapsedS > 0 ? Math.round((steps / elapsedS) * 60) : 0;

  // Max speed from 5-second sliding windows of step rate
  let maxSpeedMph = avgSpeedMph;
  if (samples.length > 20) {
    const windowMs = 5000;
    const windowSamples = [];
    let windowStart = samples[0]?.t || 0;
    let windowPeaks = 0;
    let maxWindowSpeed = 0;

    const meanMag = samples.reduce((s, v) => s + v.mag, 0) / samples.length;
    let above = false;

    for (const s of samples) {
      if (s.t - windowStart > windowMs && windowSamples.length > 0) {
        const windowElapsed = (s.t - windowStart) / 1000;
        const windowDist = windowPeaks * strideLengthM;
        const windowSpeed = (windowDist / windowElapsed) * 2.23694;
        if (windowSpeed > maxWindowSpeed) maxWindowSpeed = windowSpeed;

        // Slide window forward
        windowStart = s.t - windowMs;
        windowPeaks = 0;
        above = false;
      }

      if (s.mag > meanMag + 0.3) {
        if (!above) windowPeaks++;
        above = true;
      } else {
        above = false;
      }

      windowSamples.push(s);
    }

    if (maxWindowSpeed > 0) maxSpeedMph = maxWindowSpeed;
  }

  // Consistency: 1 - (std_dev of per-10s speeds / avgSpeed), clamped 0-1
  let consistency = 1.0;
  if (samples.length > 20 && avgSpeedMs > 0) {
    const chunkMs = 10000;
    const speeds = [];
    let chunkStart = samples[0]?.t || 0;
    let chunkSteps = 0;
    let abv = false;
    const meanMag = samples.reduce((s, v) => s + v.mag, 0) / samples.length;

    for (const s of samples) {
      if (s.t - chunkStart >= chunkMs) {
        const chunkElapsed = (s.t - chunkStart) / 1000;
        speeds.push((chunkSteps * strideLengthM) / chunkElapsed);
        chunkStart = s.t;
        chunkSteps = 0;
        abv = false;
      }
      if (s.mag > meanMag + 0.3) {
        if (!abv) chunkSteps++;
        abv = true;
      } else {
        abv = false;
      }
    }

    if (speeds.length >= 2) {
      const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const variance = speeds.reduce((a, v) => a + (v - mean) ** 2, 0) / speeds.length;
      const stdDev = Math.sqrt(variance);
      consistency = Math.max(0, Math.min(1, 1 - stdDev / (mean || 1)));
    }
  }

  return {
    steps,
    distanceM: Math.round(distanceM),
    distanceMi: +distanceMi.toFixed(2),
    distanceKm: +distanceKm.toFixed(2),
    avgSpeedMs: +avgSpeedMs.toFixed(2),
    avgSpeedMph: +avgSpeedMph.toFixed(1),
    maxSpeedMph: +maxSpeedMph.toFixed(1),
    paceMinPerMi: +paceMinPerMi.toFixed(1),
    cadence,
    consistency: +consistency.toFixed(2),
    elapsedS: +elapsedS.toFixed(1),
  };
}
