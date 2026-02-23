/**
 * Time utilities for analytics engine.
 * Shared by all analytics modules on the server.
 *
 * "minutes" = minute-of-day (0–1439).
 */

/** Convert minute-of-day to "HH:MM" string. */
export function minutesToHHMM(m) {
  const c = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

/** Convert "HH:MM" to minute-of-day. */
export function hhmmToMinutes(s) {
  if (!s || typeof s !== 'string') return 420; // default 7 AM
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Display-friendly label: "6 AM", "2 PM". */
export function minutesToLabel(m) {
  const c = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(c / 60);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Wrap minutes into 0–1439. */
export function clampMinutes(m) {
  return ((m % 1440) + 1440) % 1440;
}
