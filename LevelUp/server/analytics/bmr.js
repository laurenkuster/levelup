/**
 * BMR — Mifflin–St Jeor Equation.
 *
 * Computes Basal Metabolic Rate (kcal/day) from profile data.
 * This is a core feature for energy prediction.
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
