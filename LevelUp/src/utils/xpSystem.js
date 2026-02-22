/**
 * XP / Leveling system shared across all stats.
 *
 * Designed so every stat (INT, STR, STM, …) uses the same curve.
 * Max level = 100.
 *
 * ── Level curve ──
 *   cumulativeXP(level) = (level − 1)² × 3
 *     Level  1 →    0 XP
 *     Level 10 →  243 XP
 *     Level 50 → 7 203 XP
 *     Level100 → 29 403 XP
 *
 * ── Ranks ──
 *   Cosmetic title that changes every tier.
 */

/* ───────── constants ───────── */
const XP_SCALE = 3;
const MAX_LEVEL = 100;

const RANKS = [
  { minLevel: 1,  title: 'NOVICE' },
  { minLevel: 10, title: 'APPRENTICE' },
  { minLevel: 25, title: 'SCHOLAR' },
  { minLevel: 50, title: 'SAGE' },
  { minLevel: 75, title: 'MASTER' },
  { minLevel: 90, title: 'GRANDMASTER' },
  { minLevel: 100, title: 'ENLIGHTENED' },
];

/* ───────── leveling helpers ───────── */

/** Total XP required to **reach** a given level (cumulative). */
export function xpToReachLevel(level) {
  if (level <= 1) return 0;
  const n = Math.min(level, MAX_LEVEL) - 1;
  return Math.floor(n * n * XP_SCALE);
}

/** XP required to go from `level` to `level + 1`. */
export function xpForNextLevel(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return xpToReachLevel(level + 1) - xpToReachLevel(level);
}

/** Derive the current level from cumulative XP. */
export function levelFromTotalXP(xp) {
  if (xp <= 0) return 1;
  const n = Math.floor(Math.sqrt(xp / XP_SCALE));
  return Math.min(n + 1, MAX_LEVEL);
}

/** Progress fraction (0‒1) within the current level. */
export function levelProgress(xp) {
  const level = levelFromTotalXP(xp);
  if (level >= MAX_LEVEL) return 1;
  const base = xpToReachLevel(level);
  const needed = xpForNextLevel(level);
  return needed > 0 ? (xp - base) / needed : 1;
}

/** Rank title for a given level. */
export function rankForLevel(level) {
  let title = RANKS[0].title;
  for (const r of RANKS) {
    if (level >= r.minLevel) title = r.title;
  }
  return title;
}

/* ───────── quiz XP formula ───────── */

const DIFF_MULT = [1.0, 1.0, 1.3, 1.6, 2.0, 2.5]; // index = difficulty

/**
 * Calculate XP earned from a single quiz.
 *
 * @param {Object}  opts
 * @param {number}  opts.score       – correct answers
 * @param {number}  opts.total       – total questions
 * @param {number}  opts.difficulty  – 1‒5
 * @param {number}  opts.timeTaken   – seconds spent
 * @param {number}  opts.timeLimit   – total seconds allowed
 * @returns {number} XP earned (≥ 5 participation minimum)
 */
export function calcQuizXP({ score, total, difficulty, timeTaken, timeLimit }) {
  if (total === 0) return 0;

  // 8 XP per correct answer (base)
  const baseXP = score * 8;

  // Harder quizzes are worth more
  const diffMult = DIFF_MULT[Math.min(Math.max(difficulty, 1), 5)] || 1.6;

  // Finishing faster earns up to 1.5× bonus
  const timeRatio = timeLimit > 0 ? Math.max(0, 1 - timeTaken / timeLimit) : 0;
  const timeBonus = 1 + timeRatio * 0.5;

  // Perfect score bonus
  const perfect = score === total && total > 0 ? 1.25 : 1;

  // Minimum participation XP
  return Math.max(5, Math.round(baseXP * diffMult * timeBonus * perfect));
}

export { MAX_LEVEL, RANKS };
