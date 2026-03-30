/**
 * trackingService.js
 *
 * Google Analytics 4 event tracking via the Measurement Protocol.
 * Works in React Native without native Firebase SDK — pure HTTP POST.
 *
 * Event naming convention: CamelCase categories for readability in GA4 dashboard.
 *   Auth_*       — sign up, login, onboarding
 *   Training_*   — workout logging per stat
 *   Nutrition_*  — food and sleep logging
 *   Quest_*      — quest interactions
 *   Coach_*      — AI coach usage
 *   ML_*         — model predictions, calibration, inference
 *   Nav_*        — screen views, tab switches
 *   Profile_*    — profile edits
 *
 * Requires in .env:
 *   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
 *   EXPO_PUBLIC_GA_API_SECRET=<your-api-secret>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MEASUREMENT_ID = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;
const API_SECRET = process.env.EXPO_PUBLIC_GA_API_SECRET;
const GA_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;
const CLIENT_ID_KEY = 'levelup_ga_client_id';
const SESSION_ID_KEY = 'levelup_ga_session_id';

let _clientId = null;
let _userId = null;
let _sessionId = null;
let _sessionStart = Date.now();

async function getClientId() {
  if (_clientId) return _clientId;
  try {
    let stored = await AsyncStorage.getItem(CLIENT_ID_KEY);
    if (!stored) {
      stored = `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;
      await AsyncStorage.setItem(CLIENT_ID_KEY, stored);
    }
    _clientId = stored;
    return stored;
  } catch {
    return `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;
  }
}

async function getSessionId() {
  if (_sessionId) return _sessionId;
  try {
    let stored = await AsyncStorage.getItem(SESSION_ID_KEY);
    const now = Date.now();
    if (!stored || now - _sessionStart > 30 * 60 * 1000) {
      stored = String(Math.floor(now / 1000));
      await AsyncStorage.setItem(SESSION_ID_KEY, stored);
      _sessionStart = now;
    }
    _sessionId = stored;
    return stored;
  } catch {
    return String(Math.floor(Date.now() / 1000));
  }
}

/* ── Core sender ── */

async function send(eventName, params = {}) {
  if (!MEASUREMENT_ID || !API_SECRET) return;
  try {
    const clientId = await getClientId();
    const sessionId = await getSessionId();
    const enrichedParams = {
      session_id: sessionId,
      engagement_time_msec: String(Math.max(1000, Date.now() - _sessionStart)),
      ...params,
    };
    const body = {
      client_id: clientId,
      events: [{ name: eventName, params: enrichedParams }],
    };
    if (_userId) body.user_id = _userId;

    fetch(GA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
    _sessionStart = Date.now();
  } catch { /* silent */ }
}

/* ══════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════ */

export function identifyUser(uid) {
  _userId = uid;
  send('Auth_UserIdentified', { uid });
}

export function trackSignUp(method = 'email') {
  send('Auth_SignUp', { method });
}

export function trackLogin(method = 'email') {
  send('Auth_Login', { method });
}

export function trackOnboardingComplete() {
  send('Auth_OnboardingComplete');
}

export function trackGoalsSet(filledCount) {
  send('Auth_GoalsConfigured', { goals_count: String(filledCount) });
}

/* ══════════════════════════════════════════
   NAVIGATION / SCREENS
   ══════════════════════════════════════════ */

export function trackScreenView(screenName) {
  send('Nav_ScreenView', { screen_name: screenName });
}

export function trackAnalyticsTabViewed(tab) {
  send('Nav_AnalyticsTab', { tab });
}

export function trackStatDetailViewed(stat) {
  send('Nav_StatDetail', { stat });
}

/* ══════════════════════════════════════════
   TRAINING — per stat
   ══════════════════════════════════════════ */

export function trackWorkoutLogged(stat, params = {}) {
  send('Training_WorkoutLogged', { stat, ...params });
}

export function trackStrSession({ totalXp, setsCount, strengthScore }) {
  send('Training_STR', {
    xp: String(totalXp),
    sets: String(setsCount),
    score: String(strengthScore),
  });
}

export function trackDexSession({ totalXp, stretchCount }) {
  send('Training_DEX', {
    xp: String(totalXp),
    stretches: String(stretchCount),
  });
}

export function trackSpdSession({ totalXp, distanceMi, avgSpeedMph }) {
  send('Training_SPD', {
    xp: String(totalXp),
    distance_mi: String(distanceMi),
    avg_mph: String(avgSpeedMph),
  });
}

export function trackStmSession({ totalXp, distanceMi, elapsedMin }) {
  send('Training_STM', {
    xp: String(totalXp),
    distance_mi: String(distanceMi),
    duration_min: String(elapsedMin),
  });
}

/* ══════════════════════════════════════════
   NUTRITION & SLEEP
   ══════════════════════════════════════════ */

export function trackSleepLogged({ sleepHours, quality }) {
  send('Nutrition_SleepLogged', {
    hours: String(sleepHours),
    quality: String(quality),
  });
}

export function trackFoodLogged({ calories, protein }) {
  send('Nutrition_FoodLogged', {
    calories: String(calories),
    protein_g: String(protein),
  });
}

/* ══════════════════════════════════════════
   QUESTS
   ══════════════════════════════════════════ */

export function trackQuestCompleted({ category, tier, xpReward }) {
  send('Quest_Completed', {
    category,
    tier: String(tier),
    xp: String(xpReward),
  });
}

export function trackQuestSkipped({ category, tier }) {
  send('Quest_Skipped', { category, tier: String(tier) });
}

/* ══════════════════════════════════════════
   INTELLIGENCE — study & quiz
   ══════════════════════════════════════════ */

export function trackStudySessionStarted(topic) {
  send('INT_StudyStarted', { topic });
}

export function trackQuizCompleted({ topic, score, xpEarned }) {
  send('INT_QuizCompleted', {
    topic,
    score: String(score),
    xp: String(xpEarned),
  });
}

/* ══════════════════════════════════════════
   AI COACH
   ══════════════════════════════════════════ */

export function trackCoachMessage() {
  send('Coach_MessageSent');
}

export function trackPlanSaved(planType) {
  send('Coach_PlanSaved', { plan_type: planType || 'unknown' });
}

/* ══════════════════════════════════════════
   ML MODEL INTERACTIONS
   ══════════════════════════════════════════ */

/** Energy prediction ran (on Analytics → Energy tab) */
export function trackMLEnergyPrediction({ score, confidence }) {
  send('ML_EnergyPrediction', {
    score: String(score),
    confidence,
  });
}

/** Per-stat ML prediction ran (STR/SPD/STM/DEX tabs) */
export function trackMLStatPrediction({ stat, prediction, r2 }) {
  send('ML_StatPrediction', {
    stat,
    prediction: String(prediction),
    r2: r2 != null ? String(Math.round(r2 * 100)) : 'unknown',
  });
}

/** Energy model recalibrated (every 7 days) */
export function trackMLCalibration({ bias, scaleFactor, dataPoints }) {
  send('ML_Calibration', {
    bias: String(Math.round(bias * 100) / 100),
    scale_factor: String(Math.round(scaleFactor * 100) / 100),
    data_points: String(dataPoints),
  });
}

/** Cross-stat recovery engine ran */
export function trackMLRecoveryComputed({ statsReady, overtrainingRisk }) {
  send('ML_RecoveryComputed', {
    stats_ready: String(statsReady),
    overtrain_risk: overtrainingRisk,
  });
}

/** Stat inference model loaded */
export function trackMLModelLoaded({ stat, available }) {
  send('ML_ModelLoaded', {
    stat,
    available: String(available),
  });
}

/* ══════════════════════════════════════════
   PROFILE & ENGAGEMENT
   ══════════════════════════════════════════ */

export function trackLevelUp(stat, newLevel) {
  send('Engagement_LevelUp', {
    stat,
    level: String(newLevel),
  });
}

export function trackProfileEdited(field) {
  send('Profile_Edited', { field });
}
