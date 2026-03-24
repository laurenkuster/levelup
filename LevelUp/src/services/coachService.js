import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadData, SYNC_DOCS } from './firestoreSync';

const PROFILE_KEY = 'levelup_profile_v1';
const SLEEP_LOG_KEY = 'levelup_sleep_log_v1';
const FOOD_LOG_KEY = 'levelup_food_log_v1';

const getApiKey = () => {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY in .env');
  return key;
};

// We will keep the history in memory for the duration of the component lifecycle
// A more robust app might persist this to storage, but this is fine for now

/**
 * Build the system prompt using current user data
 */
const buildSystemPrompt = async () => {
  let profileStr = 'No profile data available.';
  let sleepStr = 'No recent sleep data available.';
  let foodStr = 'No recent food logs available.';
  let todayFoodStr = 'No food logged today.';

  try {
    const [profile, sleepLogs, foodLogs] = await Promise.all([
      loadData(PROFILE_KEY, SYNC_DOCS.PROFILE),
      loadData(SLEEP_LOG_KEY, SYNC_DOCS.SLEEP_LOGS),
      loadData(FOOD_LOG_KEY, SYNC_DOCS.FOOD_LOGS),
    ]);

    if (profile) {
      profileStr = `Age: ${profile.age || 'Unknown'}, Weight: ${profile.weight || 'Unknown'}kg, Height: ${profile.height || 'Unknown'}cm, Sex: ${profile.sex || 'Unknown'}`;
    }

    if (sleepLogs && sleepLogs.length > 0) {
      const recentSleep = sleepLogs.slice(0, 3);
      sleepStr = recentSleep
        .map((log) => `Date: ${log.date}, Slept: ${log.sleepHours}h, Quality: ${log.quality}/5`)
        .join('; ');
    }

    if (foodLogs && foodLogs.length > 0) {
      const today = new Date().toISOString().split('T')[0]; // Simple YYYY-MM-DD estimation
      const todayLogs = foodLogs.filter(log => log.date === today);
      
      const todayTotals = todayLogs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fats: acc.fats + (log.fats || 0),
      }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

      todayFoodStr = `Today's Totals: ${todayTotals.calories} kcal (Protein: ${todayTotals.protein}g, Carbs: ${todayTotals.carbs}g, Fats: ${todayTotals.fats}g). Items today: ${todayLogs.map(l => l.food).join(', ') || 'None'}.`;

      const recentFood = foodLogs.slice(0, 5); // Last 5 meals overall
      foodStr = recentFood
        .map(log => `[${log.date}] ${log.food}: ${log.calories} kcal (P:${log.protein}g C:${log.carbs}g F:${log.fats}g)`)
        .join(' | ');
    }
  } catch (error) {
    console.warn('[coachService] Failed to load user data for prompt:', error);
  }

  return `You are the AI Coach for the LevelUp app, a fitness and RPG-style habit tracker.
Your job is to provide actionable, encouraging, and accurate advice regarding nutrition, fitness, sleep, and overall wellness. You communicate in a concise, slightly retro-gaming/RPG flavor, acting as a coach or mentor to the user (who is a "player" leveling up their life).

IMPORTANT RULE: You MUST REFUSE to answer any question that is not related to nutrition, diet, fitness, sleep, hydration, or general physical/mental wellness. If the user asks about coding, history, politics, general trivia, logic puzzles, or medical diagnostics, politely explain that you are their Health & Wellness Coach and can only advise on those topics. You are NOT a general purpose AI.

User Context:
- Profile: ${profileStr}
- Recent Sleep: ${sleepStr}
- Today's Nutrition: ${todayFoodStr}
- Recent Meals: ${foodStr}

Use this data to personalize your answers (e.g., if they ask "Did I eat enough protein today?"). Keep responses brief (under 100 words usually) and format them clearly.`;
};

/**
 * Manages the connection and history with the Gemini model
 */
export class CoachChatSession {
  constructor() {
    this.chat = null;
    this.systemInstruction = '';
  }

  async initialize() {
    try {
      this.systemInstruction = await buildSystemPrompt();
      const genAI = new GoogleGenerativeAI(getApiKey());
      // gemini-2.5-pro or gemini-2.5-flash are good for chat. Flash is faster.
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: this.systemInstruction,
      });

      this.chat = model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      });
      return true;
    } catch (e) {
      console.error('[coachService] Initialization failed:', e);
      return false;
    }
  }

  async sendMessage(userMessage) {
    if (!this.chat) {
      const initialized = await this.initialize();
      if (!initialized) throw new Error('Failed to initialize chat session.');
    }

    try {
      const result = await this.chat.sendMessage(userMessage);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('[coachService] Send message failed:', error);
      throw new Error('Could not get a response from the coach.');
    }
  }
}

// Export a singleton instance for simple usage
export const coachSession = new CoachChatSession();
