/**
 * questService.js
 *
 * Gemini-powered quest generation, completion tracking, and adaptive difficulty.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadData, saveData, SYNC_DOCS } from './firestoreSync';
import {
  QUEST_CATEGORIES,
  QUEST_KEYS,
  QUEST_RATINGS,
  MIN_TIER,
  MAX_TIER,
  TIER_XP_TABLE,
} from '../config/questConstants';

/* ── stat XP bridge ──────────────────── */

/** Maps quest categories → stat XP storage so quest rewards feed into real levels. */
const STAT_XP_MAP = {
  STR: { localKey: 'levelup_str_xp_v1', syncDoc: SYNC_DOCS.STR_XP },
  DEX: { localKey: 'levelup_dex_xp_v1', syncDoc: SYNC_DOCS.DEX_XP },
  INT: { localKey: 'levelup_int_xp_v1', syncDoc: SYNC_DOCS.INT_XP },
  SPD: { localKey: 'levelup_spd_xp_v1', syncDoc: SYNC_DOCS.SPD_XP },
  STM: { localKey: 'levelup_stm_xp_v1', syncDoc: SYNC_DOCS.STM_XP },
};

async function awardStatXp(category, xp) {
  const mapping = STAT_XP_MAP[category];
  if (!mapping || xp <= 0) return;

  try {
    const data = (await loadData(mapping.localKey, mapping.syncDoc)) || { totalXp: 0 };
    data.totalXp = (data.totalXp || 0) + xp;
    await saveData(mapping.localKey, mapping.syncDoc, data);
  } catch (e) {
    console.warn(`[questService] Failed to award ${xp} XP to ${category}:`, e.message);
  }
}

/* ── helpers ──────────────────────────── */

const getApiKey = () => {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY in .env');
  return key;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Strip markdown code fences and parse JSON. */
const parseGeminiJson = (text) => {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
};

/** Get dates for the next N days starting from today. */
const getNextDays = (n) => {
  const days = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
};

/* ── context loading ──────────────────── */

export async function loadQuestContext() {
  const [profile, goals, tiers, history, sleepLogs, foodLogs] = await Promise.all([
    loadData('levelup_profile_v1', SYNC_DOCS.PROFILE).catch(() => null),
    loadData(QUEST_KEYS.GOALS, SYNC_DOCS.GOALS),
    loadData(QUEST_KEYS.TIERS, SYNC_DOCS.QUEST_TIERS),
    loadData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY),
    loadData('levelup_sleep_log_v1', SYNC_DOCS.SLEEP_LOGS).catch(() => null),
    loadData('levelup_food_log_v1', SYNC_DOCS.FOOD_LOGS).catch(() => null),
  ]);
  return { profile, goals, tiers, history, sleepLogs, foodLogs };
}

/* ── quest generation ─────────────────── */

function buildGenerationPrompt(context, dates) {
  const recentEntries = (context.history?.entries || []).slice(0, 98);
  const summaries = context.history?.dailySummaries || {};

  return `You are the Quest Generator for LevelUp, an RPG fitness/lifestyle app.
Generate a personalized daily quest plan for the following dates: ${dates.join(', ')}.

Rules:
- Return STRICT JSON only. No markdown, no commentary, no extra text.
- JSON schema: { "days": { "YYYY-MM-DD": [ ...quests ] } }
- Each day MUST have exactly 7 quests, one per category: ${QUEST_CATEGORIES.join(', ')}.
- Each quest object schema:
  {
    "category": "STR",
    "tier": 3,
    "title": "Short quest title (max 40 chars)",
    "description": "Specific, actionable task description (max 200 chars)",
    "completionCriteria": "How the user knows they completed it (max 100 chars)",
    "xpReward": 65
  }
- Tier range: ${MIN_TIER} (easiest) to ${MAX_TIER} (hardest). Use the current tier for each category.
- XP rewards should scale with tier: tier 1 = ~30 XP, tier 10 = ~350 XP.
- Quests should be realistic, achievable daily tasks that match the user's goals.
- Vary quests day-to-day to prevent monotony. Use progressive overload within the tier.
- If completion history shows patterns, adjust quest design to address weaknesses.
- Prioritize categories marked as "high" priority in the user's goals.

CRITICAL — Each quest MUST be something the user can log and track in the app.
The app has specific logging screens per category. Only generate quests that fit these:

STR (Strength): The user logs weight training sessions with exercises, sets, weight, and reps.
  → Quests MUST involve specific gym exercises (e.g. bench press, squat, deadlift, rows, OHP, curls).
  → Example: "Bench Press 3x8 at working weight" or "Complete 4 sets of squats".
  → Do NOT generate bodyweight-only quests (push-ups, sit-ups) unless tier 1-2.

DEX (Dexterity): The user logs stretching/mobility sessions with specific stretches and hold durations.
  → Quests MUST involve specific stretches (e.g. hamstring stretch, hip flexor stretch, shoulder stretch).
  → Example: "Hold pigeon pose 60s each side" or "Complete a 15-min full-body stretch routine".

SPD (Speed): The user logs sprint/agility sessions with distance, time, and speed.
  → Quests MUST involve sprints, interval runs, or agility drills with measurable targets.
  → Example: "Run 6x100m sprints with 90s rest" or "Complete 400m intervals x4".

STM (Stamina): The user logs endurance runs with distance, time, and pace.
  → Quests MUST involve running/jogging with distance or time targets.
  → Example: "Run 3 miles at conversational pace" or "Complete a 30-minute steady-state run".

INT (Intelligence): The user logs study sessions and takes quizzes to earn XP.
  → Quests MUST involve studying a topic then taking the in-app quiz.
  → Example: "Study a new topic for 20 min and pass the quiz" or "Score 80%+ on today's quiz".

HP (Health/Nutrition): The user logs meals with calories and macros (protein, carbs, fat).
  → Quests MUST involve specific nutrition targets the user can log.
  → Example: "Hit 150g protein today" or "Log all 3 meals with balanced macros".

MP (Recovery/Sleep): The user logs sleep duration and quality.
  → Quests MUST involve sleep or recovery habits that lead to logged sleep data.
  → Example: "Get 8+ hours of sleep tonight" or "Be in bed by 10:30 PM".

User Profile:
${JSON.stringify(context.profile || {})}

User Goals:
${JSON.stringify(context.goals || {})}

Current Difficulty Tiers:
${JSON.stringify(context.tiers || {})}

Recent Completion History (last 14 days):
${JSON.stringify(recentEntries)}

Daily Summaries:
${JSON.stringify(summaries)}`;
}

/**
 * Call Gemini to generate quests for the given dates.
 */
async function callGeminiForQuests(context, dates) {
  const prompt = buildGenerationPrompt(context, dates);
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
  });

  const text = result.response.text();
  const parsed = parseGeminiJson(text);

  // Validate and assign IDs
  for (const date of dates) {
    const dayQuests = parsed.days?.[date];
    if (!Array.isArray(dayQuests) || dayQuests.length !== 7) {
      throw new Error(`Invalid quest data for ${date}: expected 7 quests`);
    }
    dayQuests.forEach((q, i) => {
      q.id = `q_${date.replace(/-/g, '')}_${q.category}_${q.tier}`;
      q.status = 'pending';
      q.xpReward = q.xpReward || TIER_XP_TABLE[q.tier] || 30;
    });
  }

  return parsed;
}

/**
 * Generate quests for the next 7 days. Retries once on failure.
 */
export async function generateWeeklyQuests(context) {
  const dates = getNextDays(7);
  try {
    return await callGeminiForQuests(context, dates);
  } catch (e) {
    console.warn('[questService] First generation attempt failed, retrying:', e.message);
    return await callGeminiForQuests(context, dates);
  }
}

/**
 * Ensure we have quests for today. If not, generate a fresh week.
 * Returns the full plan.
 */
export async function ensurePlanForToday() {
  const plan = await loadData(QUEST_KEYS.PLAN, SYNC_DOCS.QUEST_PLAN);
  const today = todayIso();

  if (plan?.days?.[today] && Array.isArray(plan.days[today]) && plan.days[today].length === 7) {
    return plan;
  }

  const context = await loadQuestContext();
  const newWeek = await generateWeeklyQuests(context);

  const merged = {
    days: { ...(plan?.days || {}), ...newWeek.days },
    generatedAt: new Date().toISOString(),
  };

  await saveData(QUEST_KEYS.PLAN, SYNC_DOCS.QUEST_PLAN, merged);
  return merged;
}

/**
 * Get today's 7 quests.
 */
export async function getTodayQuests() {
  const plan = await ensurePlanForToday();
  return plan.days[todayIso()] || [];
}

/* ── quest completion ─────────────────── */

/**
 * Mark a quest as completed, failed, or skipped.
 * Returns { xpAwarded, summary }.
 */
export async function updateQuestStatus(questId, status) {
  const plan = await loadData(QUEST_KEYS.PLAN, SYNC_DOCS.QUEST_PLAN);
  const history = await loadData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY) || {
    entries: [],
    dailySummaries: {},
  };
  const today = todayIso();

  // Find quest in today's plan
  const todayQuests = plan?.days?.[today] || [];
  const quest = todayQuests.find((q) => q.id === questId);
  if (!quest) throw new Error(`Quest ${questId} not found for ${today}`);

  // Build history entry
  const xpAwarded = status === 'completed' ? (quest.xpReward || 0) : 0;
  const entry = {
    questId,
    category: quest.category,
    tier: quest.tier,
    date: today,
    completedAt: new Date().toISOString(),
    status,
    xpAwarded,
  };

  // Prepend to entries, cap at 500
  history.entries = [entry, ...(history.entries || [])].slice(0, 500);

  // Update daily summary
  const summary = history.dailySummaries[today] || {
    completed: 0,
    failed: 0,
    skipped: 0,
    totalXp: 0,
  };
  summary[status] = (summary[status] || 0) + 1;
  summary.totalXp += xpAwarded;
  summary.rating = computeRatingGrade(summary.completed, 7);
  history.dailySummaries[today] = summary;

  await saveData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY, history);

  // Award XP to the corresponding stat system (STR, DEX, INT)
  if (status === 'completed' && xpAwarded > 0) {
    await awardStatXp(quest.category, xpAwarded);
  }

  // Update quest status in plan
  quest.status = status;
  await saveData(QUEST_KEYS.PLAN, SYNC_DOCS.QUEST_PLAN, plan);

  return { xpAwarded, summary };
}

/* ── rating ───────────────────────────── */

function computeRatingGrade(completed, total) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  for (const [grade, info] of Object.entries(QUEST_RATINGS)) {
    if (pct >= info.min) return grade;
  }
  return 'F';
}

/**
 * Compute the day rating from history for a given date.
 */
export function computeDayRating(history, dateStr) {
  const summary = history?.dailySummaries?.[dateStr];
  if (!summary) return { completed: 0, failed: 0, skipped: 0, totalXp: 0, rating: 'F', percent: 0 };
  const pct = Math.round((summary.completed / 7) * 100);
  return {
    ...summary,
    rating: summary.rating || computeRatingGrade(summary.completed, 7),
    percent: pct,
  };
}

/* ── adaptive difficulty (tier evaluation) ─── */

function buildTierEvalPrompt(context) {
  const recentEntries = (context.history?.entries || []).slice(0, 140);
  const summaries = context.history?.dailySummaries || {};

  return `You are analyzing quest completion patterns for the LevelUp app.
Based on the completion history, determine if difficulty tiers should change.

Rules:
- Return STRICT JSON only. No markdown, no commentary.
- JSON schema: { "tierChanges": { "STR": { "newTier": 2, "reason": "..." }, ... } }
- Only include categories that should change. Omit unchanged categories.
- Tier range: ${MIN_TIER}-${MAX_TIER}. Never go below ${MIN_TIER} or above ${MAX_TIER}.
- Increase tier when: consistent completion (5+ in a row), fast completion, user exceeding requirements.
- Decrease tier when: 3+ failures in last 7 days, repeated skipping, signs of burnout.
- Consider the PATTERN, not just raw counts:
  - Completing all except one category consistently = avoidance (don't penalize other categories).
  - Sporadic completions across all = motivation issue (hold tiers, don't increase).
  - Perfect streak then sudden drop = possible burnout (decrease by 1-2).
- Tier changes should be gradual: typically +1 or -1, max +2 or -2 for extreme patterns.

Current Tiers:
${JSON.stringify(context.tiers || {})}

Completion History (last 14 days):
${JSON.stringify(recentEntries)}

Daily Summaries:
${JSON.stringify(summaries)}`;
}

/**
 * Call Gemini to evaluate tier transitions based on history patterns.
 */
export async function evaluateTierTransitions(context) {
  const prompt = buildTierEvalPrompt(context);
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  });

  const text = result.response.text();
  return parseGeminiJson(text);
}

/**
 * Check if tier evaluation is due (once per day) and run if needed.
 * Returns current tiers.
 */
export async function checkAndEvaluateTiers() {
  const tiers = await loadData(QUEST_KEYS.TIERS, SYNC_DOCS.QUEST_TIERS);
  if (!tiers) return null;

  const today = todayIso();
  if (tiers.lastUpdated?.slice(0, 10) === today) {
    return tiers; // Already evaluated today
  }

  // Need at least some history to evaluate
  const history = await loadData(QUEST_KEYS.HISTORY, SYNC_DOCS.QUEST_HISTORY);
  if (!history?.entries?.length || history.entries.length < 7) {
    return tiers; // Not enough data yet
  }

  try {
    const context = await loadQuestContext();
    const evaluation = await evaluateTierTransitions(context);

    const updated = { ...tiers };
    if (evaluation?.tierChanges) {
      for (const [cat, change] of Object.entries(evaluation.tierChanges)) {
        if (QUEST_CATEGORIES.includes(cat) && typeof change.newTier === 'number') {
          updated[cat] = Math.max(MIN_TIER, Math.min(MAX_TIER, change.newTier));
        }
      }
    }
    updated.lastUpdated = new Date().toISOString();

    await saveData(QUEST_KEYS.TIERS, SYNC_DOCS.QUEST_TIERS, updated);
    return updated;
  } catch (e) {
    console.warn('[questService] Tier evaluation failed:', e.message);
    // Mark as evaluated today so we don't retry on every screen focus
    tiers.lastUpdated = new Date().toISOString();
    await saveData(QUEST_KEYS.TIERS, SYNC_DOCS.QUEST_TIERS, tiers).catch(() => {});
    return tiers;
  }
}

/* ── profile analysis ─────────────────── */

function buildProfilePrompt(context) {
  const entries = (context.history?.entries || []).slice(0, 210);
  const summaries = context.history?.dailySummaries || {};

  return `You are a behavioral analyst for the LevelUp fitness/lifestyle app.
Analyze the user's quest completion history to build two profiles.

Rules:
- Return STRICT JSON only.
- JSON schema:
  {
    "healthProfile": {
      "physicalStrengthTrend": "improving|stable|declining",
      "cardioEnduranceTrend": "improving|stable|declining",
      "nutritionConsistency": "high|moderate|low",
      "sleepQuality": "good|moderate|poor",
      "overallFitnessTrajectory": "string (max 100 chars)"
    },
    "psychProfile": {
      "consistencyScore": <0-100>,
      "avoidanceCategories": ["category names the user tends to skip"],
      "strongCategories": ["categories with highest completion"],
      "motivationPattern": "streak-driven|goal-driven|social-driven|sporadic",
      "completionTimePreference": "morning|afternoon|evening|inconsistent",
      "burnoutRisk": "low|medium|high",
      "recommendation": "string (max 150 chars)"
    }
  }
- Base analysis on actual patterns, not assumptions.
- No medical diagnoses or alarming language.
- Be constructive in recommendations.

User Goals:
${JSON.stringify(context.goals || {})}

Current Tiers:
${JSON.stringify(context.tiers || {})}

Quest History (last 30 days, up to 210 entries):
${JSON.stringify(entries)}

Daily Summaries:
${JSON.stringify(summaries)}`;
}

/**
 * Analyze quest history to build health and psychological profiles.
 * Triggered weekly or after 30+ new entries.
 */
export async function analyzeQuestProfile() {
  const context = await loadQuestContext();

  if (!context.history?.entries?.length || context.history.entries.length < 14) {
    return null; // Not enough data
  }

  // Check if we analyzed recently (within 7 days)
  const existing = await loadData(QUEST_KEYS.PROFILE, SYNC_DOCS.QUEST_PROFILE);
  if (existing?.lastAnalyzed) {
    const daysSince = (Date.now() - new Date(existing.lastAnalyzed).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) return existing;
  }

  try {
    const prompt = buildProfilePrompt(context);
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });

    const text = result.response.text();
    const parsed = parseGeminiJson(text);
    parsed.lastAnalyzed = new Date().toISOString();

    await saveData(QUEST_KEYS.PROFILE, SYNC_DOCS.QUEST_PROFILE, parsed);
    return parsed;
  } catch (e) {
    console.warn('[questService] Profile analysis failed:', e.message);
    return existing || null;
  }
}

/**
 * Check if goals exist. Returns true if goals are loaded and have data.
 */
export async function hasGoals() {
  const goals = await loadData(QUEST_KEYS.GOALS, SYNC_DOCS.GOALS);
  if (!goals) return false;
  const filledCount = QUEST_CATEGORIES.filter((c) => goals[c]?.goal?.trim()).length;
  return filledCount >= 1;
}
