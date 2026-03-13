/**
 * BMR — Mifflin–St Jeor Equation (client-side).
 *
 * Computes Basal Metabolic Rate (kcal/day) from profile data.
 *
 *   Male:   10×weight(kg) + 6.25×height(cm) − 5×age + 5
 *   Female: 10×weight(kg) + 6.25×height(cm) − 5×age − 161
 *
 * @param {{ age:number, weight:number, height:number, sex:string }} profile
 * @returns {number} BMR in kcal/day, or 0 if data is missing
 */
export function computeBMR(profile) {
  const { age, weight, height, sex } = profile || {};
  if (!age || !weight || !height) return 0;

  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(sex === 'Female' ? base - 161 : base + 5);
}

/**
 * Calculate how many kcal the user has burned so far today via BMR.
 * Burns linearly from midnight → midnight.
 *
 * @param {number} dailyBMR – total kcal burned per day at rest
 * @returns {number} kcal burned so far today
 */
export function bmrBurnedSoFar(dailyBMR) {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hoursElapsed = (now - midnight) / 3_600_000; // ms → hours
  return Math.round((hoursElapsed / 24) * dailyBMR);
}
