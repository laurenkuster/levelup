/**
 * Recommended activity windows.
 *
 * Generates time-based recommendations for:
 *   - Deep study (high energy periods)
 *   - Light study / review (moderate energy)
 *   - Meals (relative to wake time)
 *   - Workout (high energy, prefer morning/afternoon)
 *   - Sleep (16h after wake)
 */

import { clampMinutes, minutesToHHMM } from './time.js';

/**
 * Generate recommended activity windows.
 *
 * @param {Array} curve — energy curve from generateCurve()
 * @param {number} wakeMinute — minute-of-day user woke
 * @returns {{ events: Array, deepStudy: Array, lightStudy: Array, meals: Array, workout: Object, sleep: Object }}
 */
export function generateRecommendations(curve, wakeMinute = 420) {
  const energies = curve.map((p) => p.energy);
  const maxE = Math.max(...energies);
  const highThreshold = maxE * 0.75;
  const medThreshold = maxE * 0.5;

  // Find contiguous windows above a threshold
  const findWindows = (threshold, minDuration = 4) => {
    const windows = [];
    let start = null;
    for (let i = 0; i < curve.length; i++) {
      const above = curve[i].energy >= threshold;
      const hoursAfterWake = (((curve[i].minute - wakeMinute) % 1440) + 1440) % 1440 / 60;
      const awake = hoursAfterWake < 16;

      if (above && awake) {
        if (start === null) start = i;
      } else {
        if (start !== null && (i - start) >= minDuration) {
          windows.push({
            startMinute: curve[start].minute,
            endMinute: curve[i - 1].minute + 15,
            start: minutesToHHMM(curve[start].minute),
            end: minutesToHHMM(curve[i - 1].minute + 15),
          });
        }
        start = null;
      }
    }
    if (start !== null && (curve.length - start) >= minDuration) {
      windows.push({
        startMinute: curve[start].minute,
        endMinute: curve[curve.length - 1].minute + 15,
        start: minutesToHHMM(curve[start].minute),
        end: minutesToHHMM(curve[curve.length - 1].minute + 15),
      });
    }
    return windows;
  };

  const deepStudy = findWindows(highThreshold, 4);
  const lightStudy = findWindows(medThreshold, 4).filter(
    (w) => !deepStudy.some((d) => d.startMinute === w.startMinute)
  );

  // Meals — relative to wake
  const breakfast = clampMinutes(wakeMinute + 30);
  const lunch = clampMinutes(wakeMinute + 300);
  const dinner = clampMinutes(wakeMinute + 660);
  const meals = [
    { label: 'Breakfast', minute: breakfast, t: minutesToHHMM(breakfast) },
    { label: 'Lunch', minute: lunch, t: minutesToHHMM(lunch) },
    { label: 'Dinner', minute: dinner, t: minutesToHHMM(dinner) },
  ];

  // Workout — 3–5h after wake
  const workoutStart = clampMinutes(wakeMinute + 180);
  const workoutEnd = clampMinutes(wakeMinute + 300);
  const workout = {
    start: minutesToHHMM(workoutStart),
    end: minutesToHHMM(workoutEnd),
    startMinute: workoutStart,
    endMinute: workoutEnd,
  };

  // Sleep — 16h after wake
  const sleepStart = clampMinutes(wakeMinute + 960);
  const sleepEnd = clampMinutes(wakeMinute + 1440);
  const sleep = {
    start: minutesToHHMM(sleepStart),
    end: minutesToHHMM(sleepEnd),
    startMinute: sleepStart,
    endMinute: sleepEnd,
  };

  // Flat event list for chart markers
  const events = [
    ...meals.map((m) => ({ t: m.t, type: 'meal', label: m.label })),
    ...deepStudy.slice(0, 2).map((w) => ({ t: w.start, type: 'study', label: `Deep Study ${w.start}–${w.end}` })),
    ...lightStudy.slice(0, 1).map((w) => ({ t: w.start, type: 'study', label: `Light Study ${w.start}–${w.end}` })),
    { t: workout.start, type: 'workout', label: `Workout ${workout.start}–${workout.end}` },
    { t: sleep.start, type: 'sleep', label: `Sleep ${sleep.start}–${sleep.end}` },
  ];

  return { events, deepStudy, lightStudy, meals, workout, sleep };
}
