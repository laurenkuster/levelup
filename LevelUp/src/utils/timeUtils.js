/**
 * Time conversion utilities for the analytics system.
 *
 * All "minutes" values represent minute-of-day (0–1439).
 * Designed for easy swapping when ML services are added later.
 */

/**
 * Convert minute-of-day to "HH:MM" string (24h format).
 * @param {number} m — minute of day (0–1439)
 * @returns {string} e.g. "06:30", "14:00"
 */
export function minutesToHHMM(m) {
  const clamped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Convert "HH:MM" string to minute-of-day.
 * @param {string} s — e.g. "06:30"
 * @returns {number} minute of day
 */
export function hhmmToMinutes(s) {
  if (!s || typeof s !== 'string') return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convert minute-of-day to a display-friendly label.
 * @param {number} m — minute of day
 * @returns {string} e.g. "6 AM", "2 PM", "12 PM"
 */
export function minutesToLabel(m) {
  const clamped = ((m % 1440) + 1440) % 1440;
  const h24 = Math.floor(clamped / 60);
  if (h24 === 0) return '12 AM';
  if (h24 === 12) return '12 PM';
  if (h24 < 12) return `${h24} AM`;
  return `${h24 - 12} PM`;
}

/**
 * Wrap minutes into 0–1439 range.
 * @param {number} m
 * @returns {number}
 */
export function clampMinutes(m) {
  return ((m % 1440) + 1440) % 1440;
}

/**
 * Format a duration in hours to a readable string.
 * @param {number} hours
 * @returns {string} e.g. "7.5h", "8h"
 */
export function formatHours(hours) {
  if (!hours || hours <= 0) return '0h';
  return `${Number(hours.toFixed(1))}h`;
}
