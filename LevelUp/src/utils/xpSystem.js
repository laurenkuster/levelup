/**
 * XP / Leveling system shared across all stats.
 *
 * Designed so every stat (INT, STR, STM, …) uses the same curve.
 * Max level = 100.
 *
 * ── Level curve (progressive) ──
 *   Levels  1–5:   300 XP each
 *   Levels  6–10:  400 XP each
 *   Levels 11–15:  500 XP each
 *   Levels 16–20:  600 XP each
 *   Levels 21–30:  800 XP each
 *   Levels 31–50: 1000 XP each
 *   Levels 51–75: 1500 XP each
 *   Levels 76–100: 2000 XP each
 *
 * ── Ranks ──
 *   Cosmetic title that changes every tier.
 */

/* ───────── constants ───────── */
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

/* ───────── XP per level tier ───────── */

function xpForLevel(level) {
  if (level <= 5)  return 300;
  if (level <= 10) return 400;
  if (level <= 15) return 500;
  if (level <= 20) return 600;
  if (level <= 30) return 800;
  if (level <= 50) return 1000;
  if (level <= 75) return 1500;
  return 2000;
}

/* ───────── leveling helpers ───────── */

/** Total XP required to **reach** a given level (cumulative). */
export function xpToReachLevel(level) {
  if (level <= 1) return 0;
  const n = Math.min(level, MAX_LEVEL);
  let total = 0;
  for (let l = 1; l < n; l++) {
    total += xpForLevel(l);
  }
  return total;
}

/** XP required to go from `level` to `level + 1`. */
export function xpForNextLevel(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return xpForLevel(level);
}

/** Derive the current level from cumulative XP. */
export function levelFromTotalXP(xp) {
  if (xp <= 0) return 1;
  let cumulative = 0;
  for (let l = 1; l < MAX_LEVEL; l++) {
    cumulative += xpForLevel(l);
    if (xp < cumulative) return l;
  }
  return MAX_LEVEL;
}

/** Progress fraction (0–1) within the current level. */
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
 * @param {number}  opts.difficulty  – 1–5
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
