import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadData, SYNC_DOCS } from './firestoreSync';
import { computeIntMetrics } from './intService';

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
  let intStr = 'No recent INT/quiz data available.';

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

    try {
      const intMetrics = await computeIntMetrics();
      if (intMetrics?.hasData) {
        intStr = [
          `INT Score: ${intMetrics.todayScore}`,
          `Overall Accuracy: ${intMetrics.overallAccuracy}%`,
          `Today Attempts: ${intMetrics.todayAttempts}`,
          `Streak: ${intMetrics.streak} days`,
          `Total Quizzes: ${intMetrics.totalQuizzes}`,
          `Level: ${intMetrics.level}`,
          `Rank: ${intMetrics.rank}`,
        ].join(', ');
      }
    } catch (e) {
      console.warn('[coachService] Failed to load INT context:', e);
    }
  } catch (error) {
    console.warn('[coachService] Failed to load user data for prompt:', error);
  }

  return `You are the AI Coach for the LevelUp app, a fitness and RPG-style habit tracker.
Your job is to provide actionable, encouraging, and accurate advice in two domains:
1) Health & performance: nutrition, fitness, sleep, recovery, wellness.
2) INT growth: study strategy, learning plans, quiz improvement, and career-skill learning paths (e.g., software developer skills).
You communicate in a concise, slightly retro-gaming/RPG flavor, acting as a coach or mentor to the user (who is a "player" leveling up their life).

IMPORTANT RULE: You MUST REFUSE requests unrelated to these two domains. You may discuss software learning plans, developer skills, and study resources as part of INT growth. Refuse unrelated areas like politics, illegal activity, explicit content, or medical diagnosis.

User Context:
- Profile: ${profileStr}
- Recent Sleep: ${sleepStr}
- Today's Nutrition: ${todayFoodStr}
- Recent Meals: ${foodStr}
- INT Snapshot: ${intStr}

Use this data to personalize your answers (e.g., if they ask "Did I eat enough protein today?" or "What should I study to become a better software developer?").
When giving learning guidance, include specific next-step topics and a short practice plan.
Keep responses concise and clear.`;
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
          maxOutputTokens: 1200,
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
      let text = response.text() || '';

      // If the model stopped due to token limit, ask for continuation once.
      const finishReason = response?.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        const contResult = await this.chat.sendMessage('Continue from exactly where you stopped. Do not repeat prior lines.');
        const contResponse = await contResult.response;
        const continued = contResponse.text() || '';
        text = `${text}\n${continued}`.trim();
      }

      return text;
    } catch (error) {
      console.error('[coachService] Send message failed:', error);
      throw new Error('Could not get a response from the coach.');
    }
  }
}

// Export a singleton instance for simple usage
export const coachSession = new CoachChatSession();
