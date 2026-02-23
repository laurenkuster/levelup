/**
 * Feature extraction for analytics engine.
 *
 * Extracts a flat feature vector from profile + sleep logs.
 * This module is the single source of truth for feature preparation,
 * making it reusable by a future Python ML service.
 *
 * Features:
 *   - bmr:            Basal metabolic rate (kcal/day)
 *   - recovery_ratio: last-night sleep hours / recommended hours (0–1+)
 *   - quality:        last-night sleep quality (1–5, default 3)
 *   - sleep_debt:     cumulative deficit over last 7 days (hours)
 *   - quality_avg:    average quality over recent logs
 *   - history_days:   number of unique dates in sleep logs
 *   - wake_minute:    minute-of-day user woke up
 *   - age, weight, height, sex_numeric (for ML)
 */

import { computeBMR } from './bmr.js';
import { hhmmToMinutes } from './time.js';

/**
 * Recommended sleep hours by age (same table as LogSleepEntryScreen).
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
 * Extract feature vector from raw profile + sleep data.
 *
 * @param {{ age, weight, height, sex }} profile
 * @param {Array} sleepLogs — sorted newest-first
 * @returns {Object} feature vector
 */
export function extractFeatures(profile, sleepLogs = []) {
  const age = profile?.age || 25;
  const requiredHours = getRequiredSleep(age);

  // Last night's entry (most recent)
  const lastEntry = sleepLogs.length > 0 ? sleepLogs[0] : null;
  const lastNightHours = lastEntry?.sleepHours || 0;
  const quality = lastEntry?.quality || 3;
  const wakeMinute = lastEntry?.wakeTime
    ? hhmmToMinutes(lastEntry.wakeTime)
    : 420; // default 7 AM

  // Recovery ratio: how well they slept vs. what they need
  const recovery_ratio = requiredHours > 0
    ? Math.min(1.5, lastNightHours / requiredHours)
    : 0;

  // History: unique dates in logs
  const uniqueDates = new Set(sleepLogs.map((l) => l.date).filter(Boolean));
  const history_days = uniqueDates.size;

  // Sleep debt over last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const recentLogs = sleepLogs.filter((l) => l.date && new Date(l.date) >= weekAgo);
  const totalSlept = recentLogs.reduce((s, l) => s + (l.sleepHours || 0), 0);
  const daysInWindow = Math.min(history_days, 7);
  const sleep_debt = Math.max(0, requiredHours * daysInWindow - totalSlept);

  // Average quality over recent logs
  const qualityEntries = recentLogs.filter((l) => l.quality != null);
  const quality_avg = qualityEntries.length > 0
    ? qualityEntries.reduce((s, l) => s + l.quality, 0) / qualityEntries.length
    : 3;

  return {
    bmr: computeBMR(profile),
    recovery_ratio,
    quality,
    sleep_debt,
    quality_avg,
    history_days,
    wake_minute: wakeMinute,
    required_hours: requiredHours,
    last_night_hours: lastNightHours,
    // Raw profile features (for ML)
    age,
    weight: profile?.weight || 0,
    height: profile?.height || 0,
    sex_numeric: profile?.sex === 'Female' ? 0 : 1,
  };
}
