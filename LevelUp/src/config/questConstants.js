/**
 * questConstants.js
 *
 * Central configuration for the daily quest system.
 */

export const QUEST_CATEGORIES = ['STR', 'SPD', 'STM', 'INT', 'DEX', 'HP', 'MP'];

export const CATEGORY_META = {
  STR: { label: 'Strength',  iconFamily: 'community', iconName: 'dumbbell',   color: '#ef4444' },
  SPD: { label: 'Speed',     iconFamily: 'community', iconName: 'run-fast',   color: '#f59e0b' },
  STM: { label: 'Stamina',   iconFamily: 'material',  iconName: 'favorite',   color: '#ec4899' },
  INT: { label: 'Intellect', iconFamily: 'material',  iconName: 'psychology', color: '#8b5cf6' },
  DEX: { label: 'Dexterity', iconFamily: 'material',  iconName: 'flash-on',  color: '#06b6d4' },
  HP:  { label: 'Health',    iconFamily: 'community', iconName: 'food-apple', color: '#22c55e' },
  MP:  { label: 'Recovery',  iconFamily: 'material',  iconName: 'bedtime',   color: '#6366f1' },
};

export const MIN_TIER = 1;
export const MAX_TIER = 10;

export const DEFAULT_TIERS = {
  STR: 1, SPD: 1, STM: 1, INT: 1, DEX: 1, HP: 1, MP: 1,
};

/** XP reward per tier level (index = tier). */
export const TIER_XP_TABLE = [0, 30, 45, 65, 90, 120, 155, 195, 240, 290, 350];

export const QUEST_RATINGS = {
  S: { min: 100, label: 'PERFECT',   color: '#facc15' },
  A: { min: 85,  label: 'EXCELLENT', color: '#22c55e' },
  B: { min: 70,  label: 'GOOD',      color: '#3b82f6' },
  C: { min: 50,  label: 'AVERAGE',   color: '#f59e0b' },
  D: { min: 25,  label: 'POOR',      color: '#ef4444' },
  F: { min: 0,   label: 'FAILED',    color: '#64748b' },
};

export const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

/** AsyncStorage keys for quest data. */
export const QUEST_KEYS = {
  GOALS:   'levelup_quest_goals_v1',
  PLAN:    'levelup_quest_plan_v1',
  HISTORY: 'levelup_quest_history_v1',
  TIERS:   'levelup_quest_tiers_v1',
  PROFILE: 'levelup_quest_profile_v1',
};
