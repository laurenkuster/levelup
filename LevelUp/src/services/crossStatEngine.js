/**
 * crossStatEngine.js
 *
 * Research-backed cross-stat interaction engine.
 *
 * Computes:
 *   1. Per-stat recovery readiness (supercompensation windows)
 *   2. XP multipliers from cross-stat interactions
 *   3. Overtraining risk assessment
 *   4. Cross-stat insights and recommendations
 *
 * Sources: See crossStatConstants.js for full citation list.
 */

import { loadData, SYNC_DOCS } from './firestoreSync';
import { levelFromTotalXP } from '../utils/xpSystem';
import {
  SLEEP_XP_MULT,
  SLEEP_STAT_SENSITIVITY,
  CONCURRENT_PENALTY,
  STR_SPD_SYNERGY,
  EXERCISE_INT_BOOST,
  NUTRITION_MULTIPLIERS,
  DEX_STR_INTERACTION,
  RECOVERY_WINDOWS,
  OVERTRAINING,
  READINESS,
} from '../config/crossStatConstants';

const STATS = ['STR', 'DEX', 'INT', 'SPD', 'STM'];
const PHYSICAL_STATS = ['STR', 'SPD', 'STM', 'DEX'];

/* ═══════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════ */

async function loadAllContext() {
  const [
    profile, sleepLogs, foodLogs,
    strLogs, strXp, dexLogs, dexXp,
    spdLogs, spdXp, stmLogs, stmXp,
    intXp, quizLogs,
  ] = await Promise.all([
    loadData('levelup_profile_v1', SYNC_DOCS.PROFILE).catch(() => null),
    loadData('levelup_sleep_log_v1', SYNC_DOCS.SLEEP_LOGS).catch(() => []),
    loadData('levelup_food_log_v1', SYNC_DOCS.FOOD_LOGS).catch(() => []),
    loadData('levelup_str_log_v1', SYNC_DOCS.STR_LOGS).catch(() => []),
    loadData('levelup_str_xp_v1', SYNC_DOCS.STR_XP).catch(() => ({ totalXp: 0 })),
    loadData('levelup_dex_log_v1', SYNC_DOCS.DEX_LOGS).catch(() => []),
    loadData('levelup_dex_xp_v1', SYNC_DOCS.DEX_XP).catch(() => ({ totalXp: 0 })),
    loadData('levelup_spd_log_v1', SYNC_DOCS.SPD_LOGS).catch(() => []),
    loadData('levelup_spd_xp_v1', SYNC_DOCS.SPD_XP).catch(() => ({ totalXp: 0 })),
    loadData('levelup_stm_log_v1', SYNC_DOCS.STM_LOGS).catch(() => []),
    loadData('levelup_stm_xp_v1', SYNC_DOCS.STM_XP).catch(() => ({ totalXp: 0 })),
    loadData('levelup_int_xp_v1', SYNC_DOCS.INT_XP).catch(() => ({ totalXp: 0 })),
    loadData('levelup_int_log_v1', SYNC_DOCS.QUIZ_LOGS).catch(() => []),
  ]);

  return {
    profile,
    sleepLogs: Array.isArray(sleepLogs) ? sleepLogs : [],
    foodLogs: Array.isArray(foodLogs) ? foodLogs : [],
    strLogs: Array.isArray(strLogs) ? strLogs : [],
    strXp, dexLogs: Array.isArray(dexLogs) ? dexLogs : [],
    dexXp, spdLogs: Array.isArray(spdLogs) ? spdLogs : [],
    spdXp, stmLogs: Array.isArray(stmLogs) ? stmLogs : [],
    stmXp, intXp,
    quizLogs: Array.isArray(quizLogs) ? quizLogs : [],
  };
}

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/**
 * Parse a date that might be an ISO timestamp ("2026-03-29T14:30:00Z")
 * or a local date-only string ("2026-03-29").
 * For date-only strings, treat as local noon to avoid timezone-boundary errors.
 */
function parseLogDate(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  // If it's a date-only string (10 chars, no "T"), the Date constructor
  // parses it as midnight UTC which is wrong for local-time comparisons.
  // Shift to local noon to avoid off-by-one-day issues.
  if (typeof dateVal === 'string' && dateVal.length === 10 && !dateVal.includes('T')) {
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 720); // shift to local noon
  }
  return d;
}

const hoursAgo = (dateVal) => {
  const d = parseLogDate(dateVal);
  return d ? (Date.now() - d.getTime()) / 3600000 : 999;
};

function getLastSessionDate(logs) {
  if (!logs.length) return null;
  const newest = logs[0];
  // Prefer createdAt (full ISO timestamp) over date (date-only string)
  return newest.createdAt || newest.timestamp || newest.date || null;
}

function getSessionsOnDate(logs, dateStr) {
  return logs.filter((l) => (l.date || '').startsWith(dateStr));
}

function getSessionsInWindow(logs, hours) {
  const cutoff = Date.now() - hours * 3600000;
  return logs.filter((l) => {
    const d = parseLogDate(l.createdAt || l.timestamp || l.date);
    return d && d.getTime() > cutoff;
  });
}

function get7DaySessions(logs) {
  return getSessionsInWindow(logs, 168);
}

/* ═══════════════════════════════════════════════════
   1. SLEEP MODIFIER
   ═══════════════════════════════════════════════════ */

/**
 * Determine which sleep entry affects today's performance.
 *
 * Logic:
 *   - Sleep logged with date = yesterday  → "last night's sleep" → affects today
 *   - Sleep logged with date = today      → "tonight's sleep" (logged in advance)
 *                                            → affects TOMORROW, not today
 *   - Backfilled entries (older dates)    → included in 7-day averages/debt,
 *                                            but only yesterday's entry is "last night"
 *
 * The entry `date` field is the night you went to bed (e.g., Mon night = Mon's date,
 * even though you wake up on Tue).
 */
function computeSleepModifier(sleepLogs) {
  if (!sleepLogs || sleepLogs.length === 0) {
    return { mult: 1.0, hours: null, label: 'NO DATA', quality: null, avgHours: 8, weeklyDebt: 0 };
  }

  const today = new Date(todayStr());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Sort by date descending
  const sorted = [...sleepLogs].sort((a, b) =>
    new Date(b.date || b.timestamp || 0) - new Date(a.date || a.timestamp || 0)
  );

  // "Last night" = entry whose date is yesterday (the night before today)
  // Fall back to most recent entry that is NOT today (today's entry = tonight, affects tomorrow)
  const todayStrVal = todayStr();
  let lastNight = sorted.find((l) => (l.date || '').startsWith(yesterdayStr));
  if (!lastNight) {
    lastNight = sorted.find((l) => (l.date || '') < todayStrVal);
  }

  // Read the correct field: sleepHours (from LogSleepEntryScreen), with fallbacks
  const hours = lastNight
    ? (lastNight.sleepHours ?? lastNight.hours ?? lastNight.duration ?? 0)
    : null;
  const quality = lastNight?.quality || null;

  let baseMult = 1.0;
  if (hours != null) {
    for (const tier of SLEEP_XP_MULT) {
      if (hours <= tier.maxHours) {
        baseMult = tier.mult;
        break;
      }
    }
  }

  // Quality adjustment (1-5 scale): poor quality reduces benefit
  if (quality && quality <= 2) baseMult *= 0.92;
  else if (quality && quality >= 4) baseMult *= 1.03;

  // 7-day sleep debt — use actual date window via string comparison (local dates)
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoStr = `${weekAgoDate.getFullYear()}-${String(weekAgoDate.getMonth() + 1).padStart(2, '0')}-${String(weekAgoDate.getDate()).padStart(2, '0')}`;
  const entriesInWindow = sorted.filter((l) => {
    const d = l.date || '';
    return d >= weekAgoStr && d < todayStrVal; // exclude today's entry (tonight)
  });
  const avgHours = entriesInWindow.length > 0
    ? entriesInWindow.reduce((s, l) => s + (l.sleepHours ?? l.hours ?? l.duration ?? 0), 0) / entriesInWindow.length
    : 8;
  const weeklyDebt = Math.max(0, Math.round((8 - avgHours) * entriesInWindow.length * 10) / 10);

  return {
    mult: Math.round(baseMult * 100) / 100,
    hours,
    quality,
    label: hours != null
      ? (SLEEP_XP_MULT.find((t) => hours <= t.maxHours)?.label || 'UNKNOWN')
      : 'NO DATA',
    avgHours: Math.round(avgHours * 10) / 10,
    weeklyDebt: Math.round(weeklyDebt * 10) / 10,
  };
}

function sleepMultForStat(baseMult, stat) {
  // Apply stat-specific sensitivity
  const sensitivity = SLEEP_STAT_SENSITIVITY[stat] || 0.5;
  // Scale the deviation from 1.0 by sensitivity
  const deviation = baseMult - 1.0;
  return Math.round((1.0 + deviation * sensitivity) * 100) / 100;
}

/* ═══════════════════════════════════════════════════
   2. CONCURRENT TRAINING MODIFIER
   ═══════════════════════════════════════════════════ */

function computeConcurrentModifiers(strLogs, stmLogs, dexLogs) {
  const today = todayStr();
  const strToday = getSessionsOnDate(strLogs, today).length;
  const stmToday = getSessionsOnDate(stmLogs, today).length;
  const dexToday = getSessionsOnDate(dexLogs, today).length;

  const mods = { STR: 1.0, STM: 1.0, SPD: 1.0, DEX: 1.0, INT: 1.0 };

  // STR + STM same day = interference
  if (strToday > 0 && stmToday > 0) {
    mods.STR *= CONCURRENT_PENALTY.STR_STM_SAME_DAY;
    mods.STM *= CONCURRENT_PENALTY.STM_STR_SAME_DAY;
  }

  // DEX (long stretching) before STR same day
  if (dexToday > 0 && strToday > 0) {
    mods.STR *= DEX_STR_INTERACTION.SAME_DAY_PENALTY;
  }

  return mods;
}

/* ═══════════════════════════════════════════════════
   3. STRENGTH → SPEED SYNERGY
   ═══════════════════════════════════════════════════ */

function computeStrSpdSynergy(strXp) {
  const strLevel = levelFromTotalXP(strXp?.totalXp || 0);
  let bonus = 1.0;
  for (const tier of STR_SPD_SYNERGY) {
    if (strLevel >= tier.minStrLevel) bonus = tier.spdBonus;
  }
  return bonus;
}

/* ═══════════════════════════════════════════════════
   4. EXERCISE → INT (BDNF) BOOST
   ═══════════════════════════════════════════════════ */

function computeBdnfBoost(strLogs, spdLogs, stmLogs, dexLogs) {
  // Acute: any physical training in last 24h
  const allPhysical = [...strLogs, ...spdLogs, ...stmLogs, ...dexLogs];
  const recent24h = getSessionsInWindow(allPhysical, EXERCISE_INT_BOOST.ACUTE_WINDOW_HOURS);
  const hasAcuteExercise = recent24h.length > 0;

  // Chronic: 3+ physical sessions in last 7 days
  const recent7d = get7DaySessions(allPhysical);
  // Count unique training days
  const uniqueDays = new Set(recent7d.map((l) => (l.date || '').slice(0, 10)));
  const hasChronic = uniqueDays.size >= EXERCISE_INT_BOOST.CHRONIC_SESSIONS_WEEK;

  let mult = 1.0;
  if (hasChronic) mult = EXERCISE_INT_BOOST.CHRONIC_BOOST;
  else if (hasAcuteExercise) mult = EXERCISE_INT_BOOST.ACUTE_BOOST;

  return { mult, hasAcuteExercise, chronicDays: uniqueDays.size };
}

/* ═══════════════════════════════════════════════════
   5. NUTRITION MODIFIER
   ═══════════════════════════════════════════════════ */

function computeNutritionModifier(foodLogs, profile) {
  const today = todayStr();
  const todayMeals = (foodLogs || []).filter((l) => (l.date || '').startsWith(today));

  if (todayMeals.length === 0) return { mult: 1.0, hasData: false };

  const totalProtein = todayMeals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCalories = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);

  // Protein goal: 1.6g/kg
  const weightKg = profile?.weight
    ? (profile.weight > 200 ? profile.weight * 0.453592 : profile.weight) // handle lbs vs kg
    : 70;
  const proteinGoal = weightKg * 1.6;
  const proteinRatio = proteinGoal > 0 ? totalProtein / proteinGoal : 0;

  // BMR for energy balance
  let bmr = 1800;
  if (profile?.age && profile?.weight && profile?.height) {
    const h = profile.height > 100 ? profile.height : profile.height * 2.54;
    const w = weightKg;
    const a = profile.age;
    bmr = profile.sex === 'female'
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
  }
  const energyBalance = totalCalories - bmr;

  let mult = 1.0;
  // Protein boost/penalty for STR
  if (proteinRatio >= NUTRITION_MULTIPLIERS.PROTEIN_ADEQUATE_RATIO) {
    mult = NUTRITION_MULTIPLIERS.PROTEIN_STR_BOOST;
  } else if (proteinRatio < 0.5) {
    mult = NUTRITION_MULTIPLIERS.PROTEIN_STR_PENALTY;
  }

  // Caloric deficit penalty
  if (energyBalance < NUTRITION_MULTIPLIERS.DEFICIT_THRESHOLD_KCAL) {
    mult *= NUTRITION_MULTIPLIERS.DEFICIT_STR_PENALTY;
  } else if (energyBalance > 0 && energyBalance <= NUTRITION_MULTIPLIERS.SURPLUS_MAX_KCAL) {
    mult *= NUTRITION_MULTIPLIERS.SURPLUS_STR_BOOST;
  }

  return {
    mult: Math.round(mult * 100) / 100,
    hasData: true,
    proteinRatio: Math.round(proteinRatio * 100) / 100,
    energyBalance: Math.round(energyBalance),
    totalProtein: Math.round(totalProtein),
    proteinGoal: Math.round(proteinGoal),
  };
}

/* ═══════════════════════════════════════════════════
   6. RECOVERY READINESS PER STAT
   ═══════════════════════════════════════════════════ */

/**
 * Dynamically adjust recovery windows based on:
 *  - Training frequency: >4 sessions/week = shorter recovery (trained athlete)
 *  - Sleep quality: good sleep = faster recovery, poor sleep = longer
 *  - Age: older = slightly longer recovery
 */
function adjustedWindow(stat, ctx, sleepMod) {
  const base = RECOVERY_WINDOWS[stat];
  let factor = 1.0;

  // Training frequency adaptation: frequent trainers recover faster
  const sessions7d = get7DaySessions(
    stat === 'STR' ? ctx.strLogs
      : stat === 'DEX' ? ctx.dexLogs
      : stat === 'SPD' ? ctx.spdLogs
      : stat === 'STM' ? ctx.stmLogs
      : ctx.quizLogs || []
  ).length;
  if (sessions7d >= 5) factor *= 0.85;       // well-trained: 15% faster recovery
  else if (sessions7d >= 3) factor *= 0.93;   // moderately trained: 7% faster

  // Sleep: good sleep accelerates recovery, poor sleep extends it
  if (sleepMod.mult >= 1.05) factor *= 0.90;  // great sleep: 10% faster
  else if (sleepMod.mult <= 0.80) factor *= 1.25; // poor sleep: 25% slower

  // Age: older adults need slightly more recovery
  const age = ctx.profile?.age || 25;
  if (age > 50) factor *= 1.15;
  else if (age > 40) factor *= 1.08;

  const min = Math.round(base.min * factor);
  const optimal = Math.round(base.optimal * factor);
  return { min, optimal, label: `${min}-${optimal}h` };
}

function scoreFromWindow(hoursSinceLast, window) {
  let score = 100;
  if (hoursSinceLast < window.min) {
    score = 20 + Math.round((hoursSinceLast / window.min) * 50);
  } else if (hoursSinceLast < window.optimal) {
    score = 70 + Math.round(((hoursSinceLast - window.min) / (window.optimal - window.min)) * 30);
  }
  if (hoursSinceLast > window.optimal * 3) {
    score = Math.max(60, 100 - Math.round((hoursSinceLast - window.optimal * 3) / 24) * 2);
  }
  return score;
}

/**
 * Compute per-muscle-group readiness from STR logs.
 * Returns { [bodyPart]: { score, status, color, hoursSinceLast } }
 */
function computeMuscleGroupReadiness(strLogs, strWindow, sleepImpact) {
  const muscleGroups = {};
  const recent = getSessionsInWindow(strLogs, 168); // last 7 days
  const partLastTrained = {};

  for (const session of recent) {
    const sessionDate = session.createdAt || session.date;
    const dist = session.distribution || {};
    for (const part of Object.keys(dist)) {
      if (!partLastTrained[part] || sessionDate > partLastTrained[part]) {
        partLastTrained[part] = sessionDate;
      }
    }
  }

  for (const [part, lastTrained] of Object.entries(partLastTrained)) {
    const hSince = hoursAgo(lastTrained);
    const mgScore = scoreFromWindow(hSince, strWindow);
    const adjusted = Math.round(Math.max(0, Math.min(100, mgScore + sleepImpact)));
    let mgStatus = READINESS.DEPLETED;
    if (adjusted >= READINESS.FULL.min) mgStatus = READINESS.FULL;
    else if (adjusted >= READINESS.MODERATE.min) mgStatus = READINESS.MODERATE;
    else if (adjusted >= READINESS.LOW.min) mgStatus = READINESS.LOW;

    muscleGroups[part] = {
      score: adjusted,
      status: mgStatus.label,
      color: mgStatus.color,
      hoursSinceLast: Math.round(hSince),
    };
  }

  return muscleGroups;
}

function computeRecoveryReadiness(ctx) {
  const readiness = {};
  const sleepMod = computeSleepModifier(ctx.sleepLogs);

  const logMap = {
    STR: ctx.strLogs,
    DEX: ctx.dexLogs,
    SPD: ctx.spdLogs,
    STM: ctx.stmLogs,
    INT: ctx.quizLogs,
  };

  // Pre-compute STR muscle group readiness so SPD/STM can check leg status
  const strWindow = adjustedWindow('STR', ctx, sleepMod);
  const strSleepImpact = (sleepMod.mult - 1.0) * SLEEP_STAT_SENSITIVITY.STR * 40;
  const muscleGroups = (ctx.strLogs || []).length > 0
    ? computeMuscleGroupReadiness(ctx.strLogs, strWindow, strSleepImpact)
    : {};
  const legReadiness = muscleGroups.LEGS || null;

  for (const stat of STATS) {
    const logs = logMap[stat] || [];
    const lastDate = getLastSessionDate(logs);
    const window = adjustedWindow(stat, ctx, sleepMod);

    let hoursSinceLast = lastDate ? hoursAgo(lastDate) : 999;
    let score = scoreFromWindow(hoursSinceLast, window);

    // Sleep impact on readiness
    const sleepImpact = (sleepMod.mult - 1.0) * SLEEP_STAT_SENSITIVITY[stat] * 40;
    score = Math.round(Math.max(0, Math.min(100, score + sleepImpact)));

    // Cross-stat interference: if STR LEGS are recovering, SPD and STM are affected
    // Sprinting and running depend on leg recovery
    let legPenalty = null;
    if ((stat === 'SPD' || stat === 'STM') && legReadiness && legReadiness.score < 70) {
      // Legs not fully recovered → cap SPD/STM readiness
      // Blend: 60% own readiness + 40% leg readiness
      const blended = Math.round(score * 0.6 + legReadiness.score * 0.4);
      if (blended < score) {
        legPenalty = score - blended;
        score = blended;
      }
    }

    let status = READINESS.DEPLETED;
    if (score >= READINESS.FULL.min) status = READINESS.FULL;
    else if (score >= READINESS.MODERATE.min) status = READINESS.MODERATE;
    else if (score >= READINESS.LOW.min) status = READINESS.LOW;

    const entry = {
      score,
      status: status.label,
      color: status.color,
      hoursSinceLast: Math.round(hoursSinceLast),
      supercompWindow: window.label,
      inSupercomp: hoursSinceLast >= window.min && hoursSinceLast <= window.optimal,
    };

    if (legPenalty) {
      entry.legInterference = `Leg recovery from STR (−${legPenalty}%)`;
    }

    // Attach muscle groups to STR
    if (stat === 'STR' && Object.keys(muscleGroups).length > 0) {
      entry.muscleGroups = muscleGroups;
    }

    readiness[stat] = entry;
  }

  return readiness;
}

/* ═══════════════════════════════════════════════════
   7. OVERTRAINING RISK
   ═══════════════════════════════════════════════════ */

function computeOvertrainingRisk(ctx) {
  // Count total sessions in last 7 days across all physical stats
  const allPhysical = [
    ...get7DaySessions(ctx.strLogs),
    ...get7DaySessions(ctx.spdLogs),
    ...get7DaySessions(ctx.stmLogs),
    ...get7DaySessions(ctx.dexLogs),
  ];

  const totalSessions = allPhysical.length;
  // Rough intensity estimate: each session counts as ~5 on a 1-10 scale
  const loadIndex = totalSessions * 5;

  // Consecutive training days
  const daySet = new Set();
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const allLogs = [...ctx.strLogs, ...ctx.spdLogs, ...ctx.stmLogs, ...ctx.dexLogs];
    if (allLogs.some((l) => (l.date || '').startsWith(key))) daySet.add(key);
  }

  // Count consecutive days from today backwards
  let consecutive = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (daySet.has(d.toISOString().slice(0, 10))) consecutive++;
    else break;
  }

  // Sleep debt
  const sleepMod = computeSleepModifier(ctx.sleepLogs);
  const sleepDebt = sleepMod.weeklyDebt || 0;

  let risk = 'LOW';
  let riskScore = 0;
  const factors = [];

  if (loadIndex >= OVERTRAINING.NONFUNCTIONAL_THRESHOLD) {
    risk = 'HIGH';
    riskScore += 40;
    factors.push(`Training load very high (${totalSessions} sessions/7d)`);
  } else if (loadIndex >= OVERTRAINING.FUNCTIONAL_MAX) {
    risk = 'MODERATE';
    riskScore += 20;
    factors.push(`Training load elevated (${totalSessions} sessions/7d)`);
  }

  if (consecutive >= OVERTRAINING.MAX_CONSECUTIVE_DAYS) {
    riskScore += 25;
    factors.push(`${consecutive} consecutive training days — rest day needed`);
  }

  if (sleepDebt >= OVERTRAINING.SLEEP_DEBT_DANGER) {
    riskScore += 30;
    factors.push(`Sleep debt critical (${sleepDebt}h deficit this week)`);
  } else if (sleepDebt >= OVERTRAINING.SLEEP_DEBT_WARNING) {
    riskScore += 15;
    factors.push(`Sleep debt accumulating (${sleepDebt}h deficit this week)`);
  }

  if (riskScore >= 40) risk = 'HIGH';
  else if (riskScore >= 20) risk = 'MODERATE';

  return {
    risk,
    riskScore: Math.min(100, riskScore),
    loadIndex,
    totalSessions,
    consecutiveDays: consecutive,
    sleepDebt,
    factors,
    color: risk === 'HIGH' ? '#ef4444' : risk === 'MODERATE' ? '#f59e0b' : '#22c55e',
  };
}

/* ═══════════════════════════════════════════════════
   8. COMBINED XP MODIFIERS
   ═══════════════════════════════════════════════════ */

function computeXpModifiers(ctx) {
  const sleep = computeSleepModifier(ctx.sleepLogs);
  const concurrent = computeConcurrentModifiers(ctx.strLogs, ctx.stmLogs, ctx.dexLogs);
  const strSpdSynergy = computeStrSpdSynergy(ctx.strXp);
  const bdnf = computeBdnfBoost(ctx.strLogs, ctx.spdLogs, ctx.stmLogs, ctx.dexLogs);
  const nutrition = computeNutritionModifier(ctx.foodLogs, ctx.profile);

  const modifiers = {};
  for (const stat of STATS) {
    let mult = 1.0;
    const factors = [];

    // Sleep
    const sleepM = sleepMultForStat(sleep.mult, stat);
    if (sleepM !== 1.0) {
      mult *= sleepM;
      const sleepHoursStr = sleep.hours != null && sleep.hours > 0
        ? `${sleep.hours}h sleep`
        : sleep.hours === 0
          ? 'No sleep logged'
          : 'No sleep data';
      factors.push({ label: 'Sleep', mult: sleepM, detail: `${sleepHoursStr} (${sleep.label})` });
    }

    // Concurrent training
    if (concurrent[stat] !== 1.0) {
      mult *= concurrent[stat];
      factors.push({ label: 'Concurrent', mult: concurrent[stat], detail: 'Same-day interference' });
    }

    // STR→SPD synergy
    if (stat === 'SPD' && strSpdSynergy > 1.0) {
      mult *= strSpdSynergy;
      const strLv = levelFromTotalXP(ctx.strXp?.totalXp || 0);
      factors.push({ label: 'STR synergy', mult: strSpdSynergy, detail: `STR LV${strLv} boosts acceleration` });
    }

    // BDNF → INT
    if (stat === 'INT' && bdnf.mult > 1.0) {
      mult *= bdnf.mult;
      factors.push({ label: 'Brain Boost', mult: bdnf.mult, detail: bdnf.chronicDays >= 3 ? 'Chronic exercise benefit' : 'Recent exercise boost' });
    }

    // Nutrition → STR, SPD, STM
    if (['STR', 'SPD', 'STM'].includes(stat) && nutrition.hasData && nutrition.mult !== 1.0) {
      mult *= nutrition.mult;
      factors.push({ label: 'Nutrition', mult: nutrition.mult, detail: `Protein ${Math.round(nutrition.proteinRatio * 100)}% of goal (${nutrition.totalProtein || 0}g / ${nutrition.proteinGoal || '?'}g)` });
    }

    modifiers[stat] = {
      finalMult: Math.round(mult * 100) / 100,
      factors,
    };
  }

  return { modifiers, sleep, nutrition, bdnf };
}

/* ═══════════════════════════════════════════════════
   9. CROSS-STAT INSIGHTS
   ═══════════════════════════════════════════════════ */

function generateInsights(ctx, readiness, overtraining, xpMods) {
  const insights = [];
  const today = todayStr();

  // Sleep insights
  if (xpMods.sleep.hours !== null) {
    if (xpMods.sleep.hours < 6) {
      insights.push({ type: 'warning', stat: 'ALL', text: `Only ${xpMods.sleep.hours}h sleep last night — XP reduced across all stats. Aim for 8h+.` });
    } else if (xpMods.sleep.hours >= 9) {
      insights.push({ type: 'positive', stat: 'ALL', text: `${xpMods.sleep.hours}h sleep — extended recovery boosting all XP gains.` });
    }
    if (xpMods.sleep.weeklyDebt >= 7) {
      insights.push({ type: 'warning', stat: 'ALL', text: `Sleep debt of ${xpMods.sleep.weeklyDebt}h this week. Prioritize 9h+ tonight for recovery.` });
    }
  }

  // Concurrent training
  const strToday = getSessionsOnDate(ctx.strLogs, today).length;
  const stmToday = getSessionsOnDate(ctx.stmLogs, today).length;
  if (strToday > 0 && stmToday > 0) {
    insights.push({ type: 'info', stat: 'STR/STM', text: 'STR + STM on same day — power gains reduced ~15%. Separate by 6+ hours when possible.' });
  }

  // STR→SPD synergy
  const strLevel = levelFromTotalXP(ctx.strXp?.totalXp || 0);
  if (strLevel >= 5) {
    const bonus = xpMods.modifiers.SPD?.factors.find((f) => f.label === 'STR synergy');
    if (bonus) {
      insights.push({ type: 'positive', stat: 'SPD', text: `STR Level ${strLevel} boosting sprint acceleration — SPD XP +${Math.round((bonus.mult - 1) * 100)}%.` });
    }
  }

  // BDNF → INT
  if (xpMods.bdnf.mult > 1.0) {
    const pct = Math.round((xpMods.bdnf.mult - 1) * 100);
    insights.push({ type: 'positive', stat: 'INT', text: `Physical training boosting INT XP +${pct}%. Exercise enhances learning and memory.` });
  } else if (xpMods.bdnf.chronicDays < 3) {
    insights.push({ type: 'tip', stat: 'INT', text: 'Train 3+ days/week to unlock Brain Boost (+12% INT XP). Exercise improves cognitive function.' });
  }

  // Nutrition
  if (xpMods.nutrition.hasData) {
    if (xpMods.nutrition.proteinRatio < 0.5) {
      insights.push({ type: 'warning', stat: 'STR', text: `Protein only ${Math.round(xpMods.nutrition.proteinRatio * 100)}% of goal (${xpMods.nutrition.proteinGoal}g). Muscle growth impaired.` });
    }
    if (xpMods.nutrition.energyBalance < -500) {
      insights.push({ type: 'warning', stat: 'STR', text: `Large caloric deficit (${xpMods.nutrition.energyBalance} kcal). Lean mass gains blunted — strength gains preserved.` });
    }
  }

  // Recovery readiness
  for (const stat of STATS) {
    const r = readiness[stat];
    if (r.inSupercomp) {
      insights.push({ type: 'positive', stat, text: `${stat} in supercompensation window — optimal time to train for maximum gains.` });
    }
  }

  // Overtraining
  for (const factor of overtraining.factors) {
    insights.push({ type: overtraining.risk === 'HIGH' ? 'warning' : 'info', stat: 'ALL', text: factor });
  }

  // Recommended focus
  const sortedReadiness = STATS
    .map((s) => ({ stat: s, score: readiness[s].score }))
    .sort((a, b) => b.score - a.score);
  const bestStat = sortedReadiness[0];
  if (bestStat && bestStat.score >= 80) {
    insights.push({ type: 'tip', stat: bestStat.stat, text: `${bestStat.stat} is fully recovered (${bestStat.score}%) — best stat to train today.` });
  }

  return insights;
}

/* ═══════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════ */

/**
 * Compute the full cross-stat analysis.
 * Returns recovery readiness, XP modifiers, overtraining risk, and insights.
 */
export async function computeCrossStatAnalysis() {
  const ctx = await loadAllContext();

  const readiness = computeRecoveryReadiness(ctx);
  const overtraining = computeOvertrainingRisk(ctx);
  const xpMods = computeXpModifiers(ctx);
  const insights = generateInsights(ctx, readiness, overtraining, xpMods);

  return {
    hasData: ctx.sleepLogs.length > 0 || ctx.strLogs.length > 0 || ctx.stmLogs.length > 0,
    readiness,
    overtraining,
    xpModifiers: xpMods.modifiers,
    sleep: xpMods.sleep,
    nutrition: xpMods.nutrition,
    bdnf: xpMods.bdnf,
    insights,
    recommendedFocus: Object.entries(readiness)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3)
      .map(([stat, r]) => ({ stat, ...r })),
  };
}

/**
 * Get the current XP multiplier for a specific stat.
 * Call this from individual stat services when awarding XP.
 */
export async function getStatXpMultiplier(stat) {
  try {
    const ctx = await loadAllContext();
    const xpMods = computeXpModifiers(ctx);
    return xpMods.modifiers[stat]?.finalMult || 1.0;
  } catch (e) {
    console.warn('[crossStatEngine] Failed to compute XP multiplier for', stat, ':', e.message);
    return 1.0;
  }
}
