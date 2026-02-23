/**
 * Rule-based energy prediction (baseline).
 *
 * Used when history_days < 2 (cold start).
 * Formula designed to be interpretable and reasonable:
 *
 *   base_energy = (recovery_ratio × 50) + (quality_norm × 25) + (bmr_norm × 15) + (debt_penalty)
 *
 * Where:
 *   recovery_ratio: sleep_hours/required_hours, capped at 1.0 for the 50-point component
 *   quality_norm:   quality/5 (1–5 scale)
 *   bmr_norm:       BMR normalized from 1200–2200 range to 0–1
 *   debt_penalty:   -2 points per hour of sleep debt (max -10)
 *
 * @param {Object} features — from extractFeatures()
 * @returns {number} energy score 0–100
 */
export function predictRules(features) {
  const {
    recovery_ratio = 0,
    quality = 3,
    bmr = 1600,
    sleep_debt = 0,
  } = features;

  // Component 1: Recovery (50 points max)
  const recoveryComponent = Math.min(1, recovery_ratio) * 50;

  // Component 2: Quality (25 points max)
  const qualityComponent = (quality / 5) * 25;

  // Component 3: BMR fitness indicator (15 points max)
  const bmrNorm = Math.min(1, Math.max(0, (bmr - 1200) / 1000));
  const bmrComponent = bmrNorm * 15;

  // Component 4: Base (10 points) minus sleep debt penalty
  const debtPenalty = Math.min(10, sleep_debt * 2);
  const baseComponent = 10 - debtPenalty;

  const raw = recoveryComponent + qualityComponent + bmrComponent + baseComponent;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
