/**
 * trackingService.js
 *
 * Google Analytics event tracking via Firebase Analytics.
 * All events are fire-and-forget — failures are silently ignored
 * so tracking never blocks user interactions.
 *
 * Event naming follows GA4 conventions:
 *   - snake_case event names
 *   - Parameters are flat key-value pairs
 *   - Custom events prefixed with app domain context
 */

import { logEvent as fbLogEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics } from './firebase';

/* ── Helpers ── */

function log(eventName, params = {}) {
  if (!analytics) return;
  try {
    fbLogEvent(analytics, eventName, params);
  } catch { /* silent */ }
}

/* ── Identity ── */

export function identifyUser(uid, properties = {}) {
  if (!analytics) return;
  try {
    setUserId(analytics, uid);
    if (Object.keys(properties).length > 0) {
      setUserProperties(analytics, properties);
    }
  } catch { /* silent */ }
}

/* ── Screen Views ── */

export function trackScreenView(screenName) {
  log('screen_view', { screen_name: screenName });
}

/* ── Auth Events ── */

export function trackSignUp(method = 'email') {
  log('sign_up', { method });
}

export function trackLogin(method = 'email') {
  log('login', { method });
}

export function trackOnboardingComplete() {
  log('tutorial_complete');
}

export function trackGoalsSet(filledCount) {
  log('goals_set', { goals_count: filledCount });
}

/* ── Training / Logging Events ── */

export function trackWorkoutLogged(stat, params = {}) {
  log('workout_logged', { stat, ...params });
}

export function trackStrSession({ totalXp, setsCount, strengthScore }) {
  log('str_session_logged', {
    total_xp: totalXp,
    sets_count: setsCount,
    strength_score: strengthScore,
  });
}

export function trackDexSession({ totalXp, stretchCount }) {
  log('dex_session_logged', {
    total_xp: totalXp,
    stretch_count: stretchCount,
  });
}

export function trackSpdSession({ totalXp, distanceMi, avgSpeedMph }) {
  log('spd_session_logged', {
    total_xp: totalXp,
    distance_mi: distanceMi,
    avg_speed_mph: avgSpeedMph,
  });
}

export function trackStmSession({ totalXp, distanceMi, elapsedMin }) {
  log('stm_session_logged', {
    total_xp: totalXp,
    distance_mi: distanceMi,
    elapsed_min: elapsedMin,
  });
}

export function trackSleepLogged({ sleepHours, quality }) {
  log('sleep_logged', {
    sleep_hours: sleepHours,
    quality,
  });
}

export function trackFoodLogged({ calories, protein }) {
  log('food_logged', {
    calories,
    protein,
  });
}

/* ── Quest Events ── */

export function trackQuestCompleted({ category, tier, xpReward }) {
  log('quest_completed', {
    category,
    tier,
    xp_reward: xpReward,
  });
}

export function trackQuestSkipped({ category, tier }) {
  log('quest_skipped', { category, tier });
}

/* ── INT / Quiz Events ── */

export function trackQuizCompleted({ topic, score, xpEarned }) {
  log('quiz_completed', {
    topic,
    score,
    xp_earned: xpEarned,
  });
}

export function trackStudySessionStarted(topic) {
  log('study_session_started', { topic });
}

/* ── Coach Events ── */

export function trackCoachMessage() {
  log('coach_message_sent');
}

export function trackPlanSaved(planType) {
  log('plan_saved', { plan_type: planType });
}

/* ── Analytics Tab Events ── */

export function trackAnalyticsTabViewed(tab) {
  log('analytics_tab_viewed', { tab });
}

/* ── Level Up Events ── */

export function trackLevelUp(stat, newLevel) {
  log('level_up', {
    stat,
    new_level: newLevel,
  });
}

/* ── Engagement ── */

export function trackProfileEdited(field) {
  log('profile_edited', { field });
}

export function trackStatDetailViewed(stat) {
  log('stat_detail_viewed', { stat });
}
