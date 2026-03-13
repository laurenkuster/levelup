/**
 * geminiService.js
 *
 * Sends a food photo to Google Gemini and returns estimated nutrition info.
 * Expects EXPO_PUBLIC_GEMINI_API_KEY in env.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const getApiKey = () => {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY in .env');
  return key;
};

const PROMPT = `You are a nutrition analysis assistant. Analyze this food image and return a JSON object with the following fields:
{
  "food": "name of the food/meal (short, e.g. 'Grilled Chicken Salad')",
  "quantity": "estimated portion description (e.g. '1 plate', '250g')",
  "calories": <number, approximate kcal>,
  "protein": <number, grams>,
  "carbs": <number, grams>,
  "fats": <number, grams>
}

If there are multiple items, combine them into one total estimate but list them in the food name separated by commas.
Only return valid JSON, nothing else.`;

/**
 * Analyse a food image with Gemini Vision.
 *
 * @param {string} base64Image  – base64 encoded image data (no data URI prefix)
 * @param {string} mimeType     – e.g. 'image/jpeg'
 * @returns {{ food: string, quantity: string, calories: number, protein: number, carbs: number, fats: number }}
 */
export async function analyzeFood(base64Image, mimeType = 'image/jpeg') {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imagePart = {
    inlineData: { data: base64Image, mimeType },
  };

  const result = await model.generateContent([PROMPT, imagePart]);
  const text = result.response.text();

  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      food: String(parsed.food || 'Unknown food'),
      quantity: String(parsed.quantity || 'Unknown'),
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      carbs: Number(parsed.carbs) || 0,
      fats: Number(parsed.fats) || 0,
    };
  } catch (e) {
    console.error('[geminiService] Failed to parse response:', text);
    throw new Error('Could not parse nutrition data from Gemini.');
  }
}
