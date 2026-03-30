/**
 * Analytics Service — fully on-device ML + recalibration.
 *
 * Uses the bundled Random Forest model for ML predictions.
 * Every 7 days, recalibrates using the user's actual sleep data.
 * No server dependency.
 *
 * Progressive personalization:
 *   < 2 days  → rule-based (LOW confidence)
 *   2–6 days  → hybrid: rules + calibration bias (MEDIUM confidence)
 *   ≥ 7 days  → ML: Random Forest + calibration (HIGH confidence)
 *
 * Recalibration (every 7 days):
 *   bias = mean(actual_quality_scaled - predicted_energy) over last 7 days
 *   final = ml_prediction * scale_factor + bias, clamped 0–100
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { predictForest, buildModelInput, getModelInfo } from '../ml/inference';
import { getCalibration, recordPrediction } from './calibrationService';
import { loadData, SYNC_DOCS } from './firestoreSync';
import { computeFoodAnalytics } from './foodAnalyticsService';
import { rewriteInsightsWithGemini } from './analyticsNarrativeService';

const PROFILE_KEY = 'levelup_profile_v1';
const SLEEP_LOG_KEY = 'levelup_sleep_log_v1';
const FOOD_LOG_KEY = 'levelup_food_log_v1';
const INT_LOG_KEY = 'levelup_int_log_v1';

/** Local-time date string matching the format used by all log screens */
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ═══════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════ */

export async function computeDailyMetrics() {
  // ── 1. Load data ──
  const [profile, sleepLogs, foodLogs, quizLogs] = await Promise.all([
    loadData(PROFILE_KEY, SYNC_DOCS.PROFILE),
    loadData(SLEEP_LOG_KEY, SYNC_DOCS.SLEEP_LOGS),
    loadData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS),
    loadData(INT_LOG_KEY, SYNC_DOCS.QUIZ_LOGS).catch(() => []),
  ]);

  const calibration = await getCalibration();

  // ── 2. Gating ──
  const profileComplete = profile && profile.age && profile.weight && profile.height && profile.sex;
  if (!profileComplete) {
    return {
      gating: 'incomplete_profile',
      message: 'Complete your profile (age, weight, height, sex) to unlock analytics.',
      hasData: false,
    };
  }

  if (!sleepLogs || sleepLogs.length === 0) {
    return {
      gating: 'no_sleep_data',
      message: "Log last night's sleep to see your energy forecast.",
      hasData: false,
    };
  }

  // ── 3. Extract features ──
  const features = extractFeatures(profile, sleepLogs, quizLogs || [], foodLogs || []);
  const { historyDays } = features;

  // ── 4. Predict energy — ML always, confidence by history ──
  let energyScore, confidence, method;

  // Confidence based on how much we know about this user
  if (historyDays < 2) confidence = 'LOW';
  else if (historyDays < 7) confidence = 'MEDIUM';
  else confidence = 'HIGH';

  // Always try ML first
  const mlInput = buildModelInput(features);
  const mlPred = predictForest(mlInput);

  if (mlPred !== null) {
    const bias = calibration?.bias || 0;
    const scale = calibration?.scale_factor || 1;
    energyScore = clamp(Math.round(mlPred * scale + bias));
    method = 'ml';
  } else {
    // Model failed to load — emergency fallback to rules
    energyScore = predictRules(features);
    method = 'rules (fallback)';
  }

  // ── 5. Wake time + current time ──
  const wakeMinute = features.wakeMinute;
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();

  // ── 6. Energy curve ──
  const energyCurve = generateCurve(energyScore, wakeMinute);

  // ── 7. Recommendations ──
  const recommendations = generateRecommendations(energyCurve, wakeMinute);

  // ── 8. Insights ──
  const insights = generateInsights(energyScore, features, method, recommendations);

  // ── 8b. Food analytics (nutrition + recovery) ──
  const foodAnalytics = computeFoodAnalytics({ profile, foodLogs, sleepLogs });
  const combinedInsights = foodAnalytics?.hasData
    ? [...insights, ...foodAnalytics.insights.slice(0, 2)]
    : insights;

  const narrativeInsights = await rewriteInsightsWithGemini({
    energyScore,
    confidence,
    method,
    historyDays,
    features: {
      sleep_debt: features.sleepDebt,
      last_night_hours: features.lastNightHours,
      required_hours: features.requiredHours,
      recovery_ratio: features.recoveryRatio,
      bmr: features.bmr,
    },
    foodAnalytics,
    baseInsights: combinedInsights,
  });

  // ── 9. Record prediction for future calibration ──
  const todayLocal = localDateStr(now);
  await recordPrediction(todayLocal, energyScore).catch(() => {});

  // ── 10. Model info ──
  const modelInfo = getModelInfo();

  return {
    hasData: true,
    gating: null,
    energyScore,
    confidence,
    method,
    historyDays,
    energyCurve,
    events: recommendations.events,
    recommendations,
    insights: narrativeInsights,
    foodAnalytics,
    features: {
      bmr: features.bmr,
      recovery_ratio: features.recoveryRatio,
      last_night_hours: features.lastNightHours,
      required_hours: features.requiredHours,
      quality: features.quality,
      sleep_debt: features.sleepDebt,
    },
    currentMinute,
    modelInfo,
  };
}

/* ═══════════════════════════════════════════════════
   FEATURE EXTRACTION
   ═══════════════════════════════════════════════════ */

function extractFeatures(profile, sleepLogs, quizLogs, foodLogs) {
  const age = profile?.age || 25;
  const weight = profile?.weight || 70;
  const height = profile?.height || 170;
  const sex = profile?.sex || 'Male';

  // BMR (Mifflin–St Jeor)
  const base = 10 * weight + 6.25 * height - 5 * age;
  const bmr = Math.round(sex === 'Female' ? base - 161 : base + 5);

  // Last night = entry whose date is yesterday (the night before today)
  // Today's entry = tonight's sleep (logged in advance), doesn't affect today
  const todayDate = localDateStr();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdayDate = localDateStr(yest);
  const lastEntry = sleepLogs.find((l) => l.date === yesterdayDate)
    || sleepLogs.find((l) => l.date && l.date < todayDate)
    || {};
  const lastNightHours = lastEntry.sleepHours || 0;
  const quality = lastEntry.quality || 3;

  // sleep_satisfaction: (quality - 1) / 4 → 0.0–1.0 (matches training preprocessing)
  const sleep_satisfaction = Math.max(0, Math.min(1, (quality - 1) / 4));

  // Wake time
  let wakeMinute = 420;
  if (lastEntry.wakeTime) {
    const p = lastEntry.wakeTime.split(':');
    wakeMinute = (parseInt(p[0]) || 7) * 60 + (parseInt(p[1]) || 0);
  }

  // Required sleep
  let requiredHours = 8;
  if (age <= 13) requiredHours = 10;
  else if (age <= 17) requiredHours = 9;
  else if (age > 64) requiredHours = 7.5;

  const recoveryRatio = requiredHours > 0
    ? Math.min(1.5, lastNightHours / requiredHours) : 0;

  // History days
  const uniqueDates = new Set(sleepLogs.map((l) => l.date).filter(Boolean));
  const historyDays = uniqueDates.size;

  // ── 7-day sleep features (match training preprocessing) ──
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const recentLogs = sleepLogs.filter((l) => l.date && new Date(l.date) >= weekAgo);
  const totalSlept = recentLogs.reduce((s, l) => s + (l.sleepHours || 0), 0);
  const sleepDebt = Math.max(0, requiredHours * Math.min(historyDays, 7) - totalSlept);

  // rolling_sleep_hours_7d: 7-day average of sleep hours
  const rolling_sleep_hours_7d = recentLogs.length > 0
    ? Math.round((totalSlept / recentLogs.length) * 100) / 100
    : lastNightHours || 7;

  // bedtime_variability_7d: std dev of bedtime start minutes over 7 days
  const bedtimeMinutes = recentLogs
    .map((l) => {
      if (!l.bedTime) return null;
      const p = l.bedTime.split(':');
      return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
    })
    .filter((v) => v !== null);

  let bedtime_variability_7d = 30; // default
  if (bedtimeMinutes.length >= 2) {
    const mean = bedtimeMinutes.reduce((s, v) => s + v, 0) / bedtimeMinutes.length;
    const variance = bedtimeMinutes.reduce((s, v) => s + (v - mean) ** 2, 0) / (bedtimeMinutes.length - 1);
    bedtime_variability_7d = Math.round(Math.sqrt(variance) * 100) / 100;
  }

  // ── Quiz / INT features ──
  const today = localDateStr(now);
  const todayQuizzes = (quizLogs || []).filter((q) => q.date && q.date.slice(0, 10) === today);
  const attempts_count = todayQuizzes.length;

  // avg_accuracy: today's quiz accuracy (0–1)
  const avg_accuracy = attempts_count > 0
    ? Math.round(todayQuizzes.reduce((s, q) => s + (q.percent || 0), 0) / attempts_count) / 100
    : 0.5; // default when no quizzes today

  // int_score: accuracy * 60 + improvement * 25 + streak * 15 (simplified)
  const int_score = attempts_count > 0
    ? Math.min(100, Math.round(avg_accuracy * 60 + Math.min(1, attempts_count / 5) * 10))
    : 50; // default

  // rolling_int_7d: 7-day rolling avg of INT scores
  const recentQuizzes = (quizLogs || []).filter((q) => q.date && new Date(q.date) >= weekAgo);
  const quizByDate = {};
  for (const q of recentQuizzes) {
    const d = q.date.slice(0, 10);
    if (!quizByDate[d]) quizByDate[d] = [];
    quizByDate[d].push(q);
  }
  const dailyIntScores = Object.values(quizByDate).map((dayQs) => {
    const dayAcc = dayQs.reduce((s, q) => s + (q.percent || 0), 0) / dayQs.length / 100;
    return Math.min(100, Math.round(dayAcc * 60 + Math.min(1, dayQs.length / 5) * 10));
  });
  const rolling_int_7d = dailyIntScores.length > 0
    ? Math.round(dailyIntScores.reduce((s, v) => s + v, 0) / dailyIntScores.length)
    : 50;

  // BMI numeric (for ML input)
  const bmiValue = weight / ((height / 100) ** 2);
  const bmi_numeric = bmiValue >= 30 ? 2 : bmiValue >= 25 ? 1 : 0;

  // ── Food / nutrition features ──
  const todayFoodLogs = (foodLogs || []).filter((f) => {
    const d = f.date || (f.createdAt && localDateStr(new Date(f.createdAt)));
    return d && d.slice(0, 10) === today;
  });

  let daily_calories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFats = 0;
  for (const f of todayFoodLogs) {
    daily_calories += Number(f.calories) || 0;
    totalProtein += Number(f.protein) || 0;
    totalCarbs += Number(f.carbs) || 0;
    totalFats += Number(f.fats) || 0;
  }

  const hasFoodData = todayFoodLogs.length > 0 && daily_calories > 0;

  // protein_per_kg: grams of protein per kg bodyweight
  const protein_per_kg = hasFoodData
    ? Math.round((totalProtein / weight) * 100) / 100
    : 1.0; // default

  // pct_carbs: fraction of total macros from carbs (by grams)
  const totalMacros = totalProtein + totalCarbs + totalFats;
  const pct_carbs = hasFoodData && totalMacros > 0
    ? Math.round((totalCarbs / totalMacros) * 1000) / 1000
    : 0.45; // default

  // water_intake_l: use default if not tracked
  const water_intake_l = 2.0; // TODO: add water tracking to food logs

  // cal_balance: calories consumed - BMR
  const cal_balance = hasFoodData
    ? Math.round(daily_calories - bmr)
    : 0; // default (neutral)

  // Use defaults for food features when no food data logged
  const foodFeatures = {
    daily_calories: hasFoodData ? daily_calories : 2000,
    protein_per_kg,
    pct_carbs,
    water_intake_l,
    cal_balance,
  };

  return {
    age,
    weight,
    height,
    sex,
    sex_numeric: sex === 'Female' ? 0 : 1,
    bmi_numeric,
    bmr,
    lastNightHours,
    quality,
    sleep_satisfaction,
    sleep_hours: lastNightHours,
    rolling_sleep_hours_7d,
    bedtime_variability_7d,
    avg_accuracy,
    int_score,
    rolling_int_7d,
    attempts_count,
    ...foodFeatures,
    wakeMinute,
    requiredHours,
    recoveryRatio,
    historyDays,
    sleepDebt,
    last_night_hours: lastNightHours,
  };
}

/* ═══════════════════════════════════════════════════
   RULE-BASED PREDICTION
   ═══════════════════════════════════════════════════ */

function predictRules(f) {
  const recoveryComp = Math.min(1, f.recoveryRatio) * 50;
  const qualityComp = (f.quality / 5) * 25;
  const bmrNorm = Math.min(1, Math.max(0, (f.bmr - 1200) / 1000));
  const bmrComp = bmrNorm * 15;
  const debtPen = Math.min(10, f.sleepDebt * 2);
  return clamp(Math.round(recoveryComp + qualityComp + bmrComp + 10 - debtPen));
}

/* ═══════════════════════════════════════════════════
   ENERGY CURVE (24h, 96 points)
   ═══════════════════════════════════════════════════ */

function generateCurve(energyScore, wakeMinute) {
  const amplitude = energyScore / 100;
  const curve = [];
  for (let i = 0; i < 96; i++) {
    const minute = (i * 15) % 1440;
    const haw = (((minute - wakeMinute) % 1440) + 1440) % 1440 / 60;
    let b;
    if (haw < 0.5) b = 25 + haw * 40;
    else if (haw < 2) b = 45 + (haw - 0.5) * 23;
    else if (haw < 5) b = 80 + Math.sin((haw - 2) * Math.PI / 6) * 15;
    else if (haw < 7) b = 80 - (haw - 5) * 15;
    else if (haw < 10) b = 50 + (haw - 7) * 10;
    else if (haw < 14) b = 80 - (haw - 10) * 10;
    else if (haw < 16) b = 40 - (haw - 14) * 10;
    else b = 15;
    const energy = Math.min(100, Math.max(0, Math.round(b * amplitude + Math.sin(i * 0.7) * 2)));
    const h = Math.floor(minute / 60);
    const m = minute % 60;
    curve.push({
      t: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      minute,
      energy,
    });
  }
  return curve;
}

/* ═══════════════════════════════════════════════════
   RECOMMENDATIONS
   ═══════════════════════════════════════════════════ */

function generateRecommendations(curve, wakeMinute) {
  const energies = curve.map((p) => p.energy);
  const maxE = Math.max(...energies);
  const highThr = maxE * 0.75;
  const medThr = maxE * 0.5;

  const findWindows = (threshold, minDur = 4) => {
    const wins = [];
    let start = null;
    for (let i = 0; i < curve.length; i++) {
      const above = curve[i].energy >= threshold;
      const haw = (((curve[i].minute - wakeMinute) % 1440) + 1440) % 1440 / 60;
      if (above && haw < 16) {
        if (start === null) start = i;
      } else {
        if (start !== null && (i - start) >= minDur) {
          wins.push({
            startMinute: curve[start].minute,
            endMinute: curve[i - 1].minute + 15,
            start: fmt(curve[start].minute),
            end: fmt(curve[i - 1].minute + 15),
          });
        }
        start = null;
      }
    }
    if (start !== null && (curve.length - start) >= minDur) {
      wins.push({
        startMinute: curve[start].minute,
        endMinute: curve[curve.length - 1].minute + 15,
        start: fmt(curve[start].minute),
        end: fmt(curve[curve.length - 1].minute + 15),
      });
    }
    return wins;
  };

  const deepStudy = findWindows(highThr, 4);
  const lightStudy = findWindows(medThr, 4).filter(
    (w) => !deepStudy.some((d) => d.startMinute === w.startMinute)
  );

  const cl = (m) => ((m % 1440) + 1440) % 1440;
  const bM = cl(wakeMinute + 30), lM = cl(wakeMinute + 300), dM = cl(wakeMinute + 660);
  const meals = [
    { label: 'Breakfast', minute: bM, t: fmt(bM) },
    { label: 'Lunch', minute: lM, t: fmt(lM) },
    { label: 'Dinner', minute: dM, t: fmt(dM) },
  ];

  const wS = cl(wakeMinute + 180), wE = cl(wakeMinute + 300);
  const workout = { startMinute: wS, endMinute: wE, start: fmt(wS), end: fmt(wE) };

  const sS = cl(wakeMinute + 960), sE = cl(wakeMinute + 1440);
  const sleep = { startMinute: sS, endMinute: sE, start: fmt(sS), end: fmt(sE) };

  const events = [
    ...meals.map((m) => ({ t: m.t, type: 'meal', label: m.label })),
    ...deepStudy.slice(0, 2).map((w) => ({ t: w.start, type: 'study', label: `Deep Study ${w.start}–${w.end}` })),
    { t: workout.start, type: 'workout', label: `Workout ${workout.start}–${workout.end}` },
    { t: sleep.start, type: 'sleep', label: `Sleep ${sleep.start}–${sleep.end}` },
  ];

  return { deepStudy, lightStudy, meals, workout, sleep, events };
}

/* ═══════════════════════════════════════════════════
   INSIGHTS
   ═══════════════════════════════════════════════════ */

function generateInsights(energyScore, features, method, recs) {
  const insights = [];

  if (energyScore >= 80) insights.push('Your energy levels look excellent today! 🔥');
  else if (energyScore >= 60) insights.push('Solid energy predicted for today.');
  else if (energyScore >= 40) insights.push('Moderate energy today. Pace yourself.');
  else insights.push('Low energy predicted. Rest when you can. 😴');

  if (features.sleepDebt > 3) {
    insights.push(`${features.sleepDebt.toFixed(1)}h of sleep debt this week.`);
  }

  if (recs.deepStudy.length > 0) {
    insights.push(`Best focus window: ${recs.deepStudy[0].start}–${recs.deepStudy[0].end}.`);
  }

  if (method === 'ml') {
    insights.push('🧠 Powered by ML (Random Forest, 572 training samples).');
  } else if (method === 'rules') {
    insights.push('Confidence improves as you log more sleep data.');
  } else if (method === 'hybrid') {
    insights.push('Using calibrated predictions. Log 7+ days for ML mode.');
  }

  return insights;
}

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

function clamp(v) { return Math.min(100, Math.max(0, Math.round(v))); }

function fmt(m) {
  const c = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}
