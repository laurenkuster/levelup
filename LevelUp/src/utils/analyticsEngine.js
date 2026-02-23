/**
 * Analytics Engine — Pure computation functions.
 *
 * All functions are pure (no side effects, no AsyncStorage, no network).
 * This makes them easy to test and easy to swap for ML model calls later.
 *
 * ── Data flow ──
 *   profile + lastNightSleep  →  BMR + recovery  →  todayEnergyScore  →  energyCurve  →  recommendations
 */

import { clampMinutes, minutesToHHMM } from './timeUtils';

/* ═══════════════════════════════════════════════════
   1. BMR — Mifflin–St Jeor Equation
   ═══════════════════════════════════════════════════ */

/**
 * Compute Basal Metabolic Rate in kcal/day.
 *
 * Mifflin–St Jeor:
 *   Male:   10×weight(kg) + 6.25×height(cm) − 5×age − 5 + 5
 *   Female: 10×weight(kg) + 6.25×height(cm) − 5×age − 161
 *
 * @param {{ age:number, weight:number, height:number, sex:string }} profile
 * @returns {number} BMR in kcal/day (0 if data missing)
 */
export function computeBMR(profile) {
  const { age, weight, height, sex } = profile || {};
  if (!age || !weight || !height) return 0;

  const base = 10 * weight + 6.25 * height - 5 * age;
  if (sex === 'Female') return Math.round(base - 161);
  return Math.round(base + 5); // Male / Other / default
}

/* ═══════════════════════════════════════════════════
   2. Sleep Recovery Score (0–100)
   ═══════════════════════════════════════════════════ */

/**
 * Recommended sleep hours by age bracket.
 * Same table used in LogSleepEntryScreen.
 */
function getRequiredSleep(age) {
  if (!age || age <= 0) return 8;
  if (age <= 1) return 15.5;
  if (age <= 2) return 12.5;
  if (age <= 5) return 11.5;
  if (age <= 13) return 10;
  if (age <= 17) return 9;
  if (age <= 64) return 8;
  return 7.5;
}

/**
 * Compute sleep recovery score from last night's sleep.
 *
 * Uses the most recent sleep log entry (last night) as the primary
 * input, with an optional 48h lookback for consistency scoring.
 *
 * Factors:
 *   1. Hours slept last night vs recommended (weight: 60%)
 *   2. Sleep quality rating from last entry (weight: 25%)
 *   3. Consistency bonus — any sleep logged in last 48h? (weight: 15%)
 *
 * @param {Array} sleepLogs — raw sleep log entries from AsyncStorage
 * @param {number} age — user's age for recommended sleep calc
 * @returns {{ score:number, lastNightHours:number, requiredHours:number, quality:number, entries:number }}
 */
export function computeSleepRecovery(sleepLogs = [], age = 25) {
  const requiredHours = getRequiredSleep(age);

  // Most recent entry = last night's sleep
  const lastEntry = sleepLogs.length > 0 ? sleepLogs[0] : null;
  const lastNightHours = lastEntry?.sleepHours || 0;
  const quality = lastEntry?.quality || 3;

  // 48h lookback for consistency
  const now = new Date();
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(now.getDate() - 2);
  const recent = sleepLogs.filter((l) => l.date && new Date(l.date) >= twoDaysAgo);

  // Factor 1: last night hours vs recommended (60%)
  const hoursRatio = Math.min(1, lastNightHours / requiredHours);
  const hoursFactor = hoursRatio * 60;

  // Factor 2: quality / 5 (25%)
  const qualityFactor = (quality / 5) * 25;

  // Factor 3: consistency — recent entries in last 48h (15%)
  const uniqueDates = new Set(recent.map((l) => l.date));
  const consistencyFactor = Math.min(uniqueDates.size / 2, 1) * 15;

  const score = Math.min(100, Math.round(hoursFactor + qualityFactor + consistencyFactor));

  return {
    score,
    lastNightHours: Number(lastNightHours.toFixed(1)),
    requiredHours: Number(requiredHours.toFixed(1)),
    quality: Number(quality.toFixed(1)),
    entries: recent.length,
  };
}

/* ═══════════════════════════════════════════════════
   3. Energy Score (0–100)
   ═══════════════════════════════════════════════════ */

/**
 * Predict today's energy level from BMR + last night's sleep.
 *
 * Formula (baseline heuristic — replaceable with ML):
 *   energy = sleepRecovery × 0.7 + bmrFactor × 0.3
 *
 * BMR factor: higher BMR (relative to baseline 1600) slightly boosts energy
 * because it indicates higher lean mass / fitness.
 *
 * @param {number} recoveryScore — 0–100 from computeSleepRecovery (last night)
 * @param {number} bmr — kcal/day from computeBMR
 * @returns {number} 0–100
 */
export function computeEnergyScore(recoveryScore, bmr) {
  const safeBMR = bmr || 1600;
  // Normalize BMR: 1200–2200 mapped to 30–80
  const bmrNorm = Math.min(80, Math.max(30, ((safeBMR - 1200) / 1000) * 50 + 30));
  const score = recoveryScore * 0.7 + bmrNorm * 0.3;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/* ═══════════════════════════════════════════════════
   4. 24-Hour Energy Curve
   ═══════════════════════════════════════════════════ */

/**
 * Generate a 24h energy prediction curve at 15-minute intervals.
 *
 * Uses a circadian rhythm model:
 *   - Post-wake ramp-up (0–2h after wake)
 *   - Morning peak (2–5h after wake)
 *   - Post-lunch dip (5–7h after wake)
 *   - Afternoon recovery (7–10h after wake)
 *   - Evening decline (10h+ after wake)
 *
 * The overall amplitude is scaled by the energy score.
 *
 * @param {number} energyScore — base energy 0–100
 * @param {number} wakeMinute — minute-of-day the user wakes (default 420 = 7 AM)
 * @returns {Array<{minute:number, energy:number}>} 96 data points
 */
export function generateEnergyCurve(energyScore, wakeMinute = 420) {
  const points = [];
  const amplitude = energyScore / 100;

  for (let i = 0; i < 96; i++) {
    const minute = clampMinutes(i * 15); // 0, 15, 30, ... 1425
    const hoursAfterWake = (((minute - wakeMinute) % 1440) + 1440) % 1440 / 60;

    let base;
    if (hoursAfterWake < 0.5) {
      // Just woke up — low energy
      base = 25 + hoursAfterWake * 40;
    } else if (hoursAfterWake < 2) {
      // Ramp-up
      base = 45 + (hoursAfterWake - 0.5) * 23;
    } else if (hoursAfterWake < 5) {
      // Morning peak
      base = 80 + Math.sin((hoursAfterWake - 2) * Math.PI / 6) * 15;
    } else if (hoursAfterWake < 7) {
      // Post-lunch dip
      base = 80 - (hoursAfterWake - 5) * 15;
    } else if (hoursAfterWake < 10) {
      // Afternoon recovery
      base = 50 + (hoursAfterWake - 7) * 10;
    } else if (hoursAfterWake < 14) {
      // Evening decline
      base = 80 - (hoursAfterWake - 10) * 10;
    } else if (hoursAfterWake < 16) {
      // Late evening — winding down
      base = 40 - (hoursAfterWake - 14) * 10;
    } else {
      // Sleep time — very low
      base = 15;
    }

    // Scale by energy score and add slight randomness for natural look
    const energy = Math.min(100, Math.max(0, Math.round(base * amplitude +
      Math.sin(i * 0.7) * 2))); // subtle wave

    points.push({ minute, energy });
  }

  return points;
}

/* ═══════════════════════════════════════════════════
   5. Recommended Activity Windows
   ═══════════════════════════════════════════════════ */

/**
 * Generate recommended time windows based on energy curve.
 *
 * Strategy:
 *   - Deep study → top 20% energy periods (morning peak)
 *   - Light study → 50–80% energy periods (afternoon)
 *   - Workout → high energy periods, prefer late morning / afternoon
 *   - Meals → scheduled relative to wake time (breakfast, lunch, dinner)
 *   - Sleep → 15–16h after wake or when energy drops below 20%
 *
 * @param {Array<{minute:number, energy:number}>} curve
 * @param {number} wakeMinute
 * @returns {Object} recommended windows
 */
export function generateRecommendations(curve, wakeMinute = 420) {
  // Find energy threshold for "high" and "medium"
  const energies = curve.map((p) => p.energy);
  const maxE = Math.max(...energies);
  const highThreshold = maxE * 0.75;
  const medThreshold = maxE * 0.5;

  // Find contiguous blocks above thresholds
  const findWindows = (threshold, minDuration = 4) => {
    const windows = [];
    let start = null;
    for (let i = 0; i < curve.length; i++) {
      const aboveThreshold = curve[i].energy >= threshold;
      // Skip sleep hours (16h+ after wake)
      const hoursAfterWake = (((curve[i].minute - wakeMinute) % 1440) + 1440) % 1440 / 60;
      const awake = hoursAfterWake < 16;

      if (aboveThreshold && awake) {
        if (start === null) start = i;
      } else {
        if (start !== null && (i - start) >= minDuration) {
          windows.push({
            startMinute: curve[start].minute,
            endMinute: curve[i - 1].minute + 15,
            startLabel: minutesToHHMM(curve[start].minute),
            endLabel: minutesToHHMM(curve[i - 1].minute + 15),
          });
        }
        start = null;
      }
    }
    if (start !== null && (curve.length - start) >= minDuration) {
      windows.push({
        startMinute: curve[start].minute,
        endMinute: curve[curve.length - 1].minute + 15,
        startLabel: minutesToHHMM(curve[start].minute),
        endLabel: minutesToHHMM(curve[curve.length - 1].minute + 15),
      });
    }
    return windows;
  };

  const deepStudy = findWindows(highThreshold, 4);
  const lightStudy = findWindows(medThreshold, 4).filter(
    (w) => !deepStudy.some((d) => d.startMinute === w.startMinute)
  );

  // Meals — relative to wake time
  const breakfast = clampMinutes(wakeMinute + 30);
  const lunch = clampMinutes(wakeMinute + 300);    // 5h after wake
  const dinner = clampMinutes(wakeMinute + 660);   // 11h after wake

  const meals = [
    { label: 'Breakfast', minute: breakfast, time: minutesToHHMM(breakfast) },
    { label: 'Lunch', minute: lunch, time: minutesToHHMM(lunch) },
    { label: 'Dinner', minute: dinner, time: minutesToHHMM(dinner) },
  ];

  // Workout — prefer 3–5h after wake or 8–10h after wake
  const workoutStart = clampMinutes(wakeMinute + 180);
  const workoutEnd = clampMinutes(wakeMinute + 300);

  const workout = {
    startMinute: workoutStart,
    endMinute: workoutEnd,
    startLabel: minutesToHHMM(workoutStart),
    endLabel: minutesToHHMM(workoutEnd),
  };

  // Sleep window — 15–16h after wake
  const sleepStart = clampMinutes(wakeMinute + 960);   // 16h after wake
  const sleepEnd = clampMinutes(wakeMinute + 1440);     // next wake

  const sleep = {
    startMinute: sleepStart,
    endMinute: sleepEnd,
    startLabel: minutesToHHMM(sleepStart),
    endLabel: minutesToHHMM(sleepEnd),
  };

  return { deepStudy, lightStudy, meals, workout, sleep };
}

/* ═══════════════════════════════════════════════════
   6. Personalized Insight Message
   ═══════════════════════════════════════════════════ */

/**
 * Generate a short personalized insight based on analytics results.
 *
 * @param {number} energyScore
 * @param {{ score:number, totalHours:number }} recovery
 * @param {Object} recs — recommendations from generateRecommendations
 * @returns {string}
 */
export function generateInsight(energyScore, recovery, recs) {
  if (recovery.entries === 0) {
    return 'Log some sleep data to unlock personalized energy predictions!';
  }

  const parts = [];

  if (energyScore >= 80) {
    parts.push('Your energy levels look excellent today! 🔥');
  } else if (energyScore >= 60) {
    parts.push('Solid energy levels predicted for today.');
  } else if (energyScore >= 40) {
    parts.push('Your energy might be moderate today. Take it easy.');
  } else {
    parts.push('Low energy predicted today. Consider resting when you can. 😴');
  }

  if (recovery.score < 50) {
    parts.push(`Sleep recovery is at ${recovery.score}% — try to get closer to ${recovery.requiredHours}h tonight.`);
  }

  if (recs.deepStudy.length > 0) {
    parts.push(`Best focus window: ${recs.deepStudy[0].startLabel}–${recs.deepStudy[0].endLabel}.`);
  }

  return parts.join(' ');
}
