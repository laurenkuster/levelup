/**
 * Calculate age from a DOB string (YYYY-MM-DD format).
 * Returns age as a string, or '' if invalid.
 */
export function calcAgeFromString(dobStr) {
  if (!dobStr) return '';
  const parts = dobStr.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
  return a >= 0 && a < 150 ? String(a) : '';
}

/**
 * Calculate age from a Date object.
 * Returns age as a number.
 */
export function calcAgeFromDate(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/** Validate a hunter ID format: 3-16 chars, letters/numbers/underscores only. */
export function isValidHunterId(id) {
  return /^[a-zA-Z0-9_]{3,16}$/.test(id);
}
