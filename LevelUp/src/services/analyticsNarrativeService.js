import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleGenerativeAI } from '@google/generative-ai';

const CACHE_KEY = 'levelup_analytics_narrative_v1';

function getApiKeyOrNull() {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
}

function safeNum(v, digits = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function buildPayload({ energyScore, confidence, method, historyDays, features, foodAnalytics }) {
  return {
    energy: {
      score: safeNum(energyScore, 0),
      confidence: String(confidence || 'UNKNOWN'),
      method: String(method || 'unknown'),
      historyDays: safeNum(historyDays, 0),
      sleepDebtHours: safeNum(features?.sleep_debt, 1),
      lastNightHours: safeNum(features?.last_night_hours, 1),
      requiredHours: safeNum(features?.required_hours, 1),
      recoveryRatio: safeNum(features?.recovery_ratio, 2),
      bmr: safeNum(features?.bmr, 0),
    },
    food: foodAnalytics?.hasData ? {
      days: safeNum(foodAnalytics.days, 0),
      kcalToday: safeNum(foodAnalytics.today?.calories, 0),
      proteinToday: safeNum(foodAnalytics.today?.protein, 1),
      proteinGoal: safeNum(foodAnalytics.today?.proteinGoal, 0),
      proteinAdequacyRatio: safeNum(foodAnalytics.today?.proteinAdequacyRatio, 2),
      energyBalanceToday: safeNum(foodAnalytics.today?.energyBalance, 0),
      protein7dAvg: safeNum(foodAnalytics.rolling?.protein7dAvg, 1),
      sleep7dAvg: safeNum(foodAnalytics.rolling?.sleep7dAvg, 1),
    } : null,
  };
}

function makeSignature(payload, baseInsights) {
  return JSON.stringify({ payload, baseInsights });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeInsights(v) {
  if (!Array.isArray(v)) return null;
  const clean = v
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  return clean.length ? clean : null;
}

export async function rewriteInsightsWithGemini({
  energyScore,
  confidence,
  method,
  historyDays,
  features,
  foodAnalytics,
  baseInsights,
}) {
  const fallback = Array.isArray(baseInsights) ? baseInsights : [];
  const apiKey = getApiKeyOrNull();
  if (!apiKey || fallback.length === 0) return fallback;

  const payload = buildPayload({
    energyScore,
    confidence,
    method,
    historyDays,
    features,
    foodAnalytics,
  });

  const signature = makeSignature(payload, fallback);
  const today = todayIso();

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw);
      if (cache?.date === today && cache?.signature === signature) {
        const cached = sanitizeInsights(cache?.insights);
        if (cached) return cached;
      }
    }
  } catch (e) {
    console.warn('[analyticsNarrative] Cache read failed:', e.message);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are rewriting app analytics insights for a student wellness app.
Rewrite the provided base insights into concise, actionable bullets.

Rules:
- Return STRICT JSON only.
- JSON schema: {"insights": ["..."]}
- 3 to 5 bullets.
- Keep each bullet under 110 characters.
- Keep factual meaning consistent with metrics.
- No medical claims, diagnoses, or alarming language.
- No markdown.

Base insights:
${JSON.stringify(fallback)}

Metrics summary:
${JSON.stringify(payload)}`;

    const result = await model.generateContent([prompt]);
    const text = result.response.text();
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const rewritten = sanitizeInsights(parsed?.insights);
    if (!rewritten) return fallback;

    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          date: today,
          signature,
          insights: rewritten,
        })
      );
    } catch (e) {
      console.warn('[analyticsNarrative] Cache write failed:', e.message);
    }

    return rewritten;
  } catch (e) {
    console.warn('[analyticsNarrative] Gemini rewrite failed, using base insights:', e.message);
    return fallback;
  }
}