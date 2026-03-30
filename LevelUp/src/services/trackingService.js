/**
 * trackingService.js
 *
 * Google Analytics 4 event tracking via the Measurement Protocol.
 * Works in React Native without native Firebase SDK — pure HTTP POST.
 *
 * All events are fire-and-forget — failures are silently ignored
 * so tracking never blocks user interactions.
 *
 * Requires in .env:
 *   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
 *   EXPO_PUBLIC_GA_API_SECRET=<your-api-secret>
 *
 * Get the API secret from: GA4 Admin → Data Streams → your stream → Measurement Protocol API secrets
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MEASUREMENT_ID = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;
const API_SECRET = process.env.EXPO_PUBLIC_GA_API_SECRET;
const GA_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;
const CLIENT_ID_KEY = 'levelup_ga_client_id';

let _clientId = null;
let _userId = null;

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

/* ── Core sender ── */

async function send(eventName, params = {}) {
  if (!MEASUREMENT_ID || !API_SECRET) return;
  try {
    const clientId = await getClientId();
    const body = {
      client_id: clientId,
      events: [{ name: eventName, params }],
    };
    if (_userId) body.user_id = _userId;

    fetch(GA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch { /* silent */ }
}

/* ── Identity ── */

export function identifyUser(uid) {
  _userId = uid;
  send('user_identified', { uid });
}

/* ── Screen Views ── */

export function trackScreenView(screenName) {
  send('screen_view', { screen_name: screenName });
}

/* ── Auth Events ── */

export function trackSignUp(method = 'email') {
  send('sign_up', { method });
}

export function trackLogin(method = 'email') {
  send('login', { method });
}

export function trackOnboardingComplete() {
  send('tutorial_complete');
}

export function trackGoalsSet(filledCount) {
  send('goals_set', { goals_count: filledCount });
}

/* ── Training / Logging Events ── */

export function trackWorkoutLogged(stat, params = {}) {
  send('workout_logged', { stat, ...params });
}

export function trackStrSession({ totalXp, setsCount, strengthScore }) {
  send('str_session_logged', {
    total_xp: totalXp,
    sets_count: setsCount,
    strength_score: strengthScore,
  });
}

export function trackDexSession({ totalXp, stretchCount }) {
  send('dex_session_logged', {
    total_xp: totalXp,
    stretch_count: stretchCount,
  });
}

export function trackSpdSession({ totalXp, distanceMi, avgSpeedMph }) {
  send('spd_session_logged', {
    total_xp: totalXp,
    distance_mi: distanceMi,
    avg_speed_mph: avgSpeedMph,
  });
}

export function trackStmSession({ totalXp, distanceMi, elapsedMin }) {
  send('stm_session_logged', {
    total_xp: totalXp,
    distance_mi: distanceMi,
    elapsed_min: elapsedMin,
  });
}

export function trackSleepLogged({ sleepHours, quality }) {
  send('sleep_logged', {
    sleep_hours: sleepHours,
    quality,
  });
}

export function trackFoodLogged({ calories, protein }) {
  send('food_logged', {
    calories,
    protein,
  });
}

/* ── Quest Events ── */

export function trackQuestCompleted({ category, tier, xpReward }) {
  send('quest_completed', {
    category,
    tier,
    xp_reward: xpReward,
  });
}

export function trackQuestSkipped({ category, tier }) {
  send('quest_skipped', { category, tier });
}

/* ── INT / Quiz Events ── */

export function trackQuizCompleted({ topic, score, xpEarned }) {
  send('quiz_completed', {
    topic,
    score,
    xp_earned: xpEarned,
  });
}

export function trackStudySessionStarted(topic) {
  send('study_session_started', { topic });
}

/* ── Coach Events ── */

export function trackCoachMessage() {
  send('coach_message_sent');
}

export function trackPlanSaved(planType) {
  send('plan_saved', { plan_type: planType });
}

/* ── Analytics Tab Events ── */

export function trackAnalyticsTabViewed(tab) {
  send('analytics_tab_viewed', { tab });
}

/* ── Level Up Events ── */

export function trackLevelUp(stat, newLevel) {
  send('level_up', {
    stat,
    new_level: newLevel,
  });
}

/* ── Engagement ── */

export function trackProfileEdited(field) {
  send('profile_edited', { field });
}

export function trackStatDetailViewed(stat) {
  send('stat_detail_viewed', { stat });
}
