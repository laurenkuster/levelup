/**
 * 24-hour energy curve generator.
 *
 * Produces 96 data points (15-min intervals) modeling the circadian
 * rhythm of energy levels throughout the day, scaled by the user's
 * predicted energy score.
 *
 * Circadian model (hours after wake):
 *   0–0.5h:  sleep inertia, low energy (25–45)
 *   0.5–2h:  morning ramp-up (45–80)
 *   2–5h:    morning peak (80–95)
 *   5–7h:    post-lunch dip (80→50)
 *   7–10h:   afternoon recovery (50→80)
 *   10–14h:  evening decline (80→40)
 *   14–16h:  wind-down (40→20)
 *   16h+:    sleep zone (15)
 */

import { clampMinutes, minutesToHHMM } from './time.js';

/**
 * Generate 24h energy curve.
 *
 * @param {number} energyScore — base energy 0–100
 * @param {number} wakeMinute — minute-of-day the user woke
 * @returns {Array<{t:string, minute:number, energy:number}>}
 */
export function generateCurve(energyScore, wakeMinute = 420) {
  const points = [];
  const amplitude = energyScore / 100;

  for (let i = 0; i < 96; i++) {
    const minute = clampMinutes(i * 15);
    const hoursAfterWake = (((minute - wakeMinute) % 1440) + 1440) % 1440 / 60;

    let base;
    if (hoursAfterWake < 0.5) {
      base = 25 + hoursAfterWake * 40;
    } else if (hoursAfterWake < 2) {
      base = 45 + (hoursAfterWake - 0.5) * 23;
    } else if (hoursAfterWake < 5) {
      base = 80 + Math.sin((hoursAfterWake - 2) * Math.PI / 6) * 15;
    } else if (hoursAfterWake < 7) {
      base = 80 - (hoursAfterWake - 5) * 15;
    } else if (hoursAfterWake < 10) {
      base = 50 + (hoursAfterWake - 7) * 10;
    } else if (hoursAfterWake < 14) {
      base = 80 - (hoursAfterWake - 10) * 10;
    } else if (hoursAfterWake < 16) {
      base = 40 - (hoursAfterWake - 14) * 10;
    } else {
      base = 15;
    }

    const energy = Math.min(100, Math.max(0, Math.round(
      base * amplitude + Math.sin(i * 0.7) * 2
    )));

    points.push({
      t: minutesToHHMM(minute),
      minute,
      energy,
    });
  }

  return points;
}
