/**
 * Food analytics service.
 *
 * Uses food logs (and optional sleep logs) to compute nutrition-focused
 * analytics inspired by the pipeline behavior analysis.
 */

const PROTEIN_GOAL_G_PER_KG = 1.6;

export function computeFoodAnalytics({ profile, foodLogs, sleepLogs }) {
  if (!Array.isArray(foodLogs) || foodLogs.length === 0) {
    return { hasData: false, message: 'Log meals to unlock food analytics.' };
  }

  const weightKg = Number(profile?.weight) || 0;
  const heightCm = Number(profile?.height) || 0;
  const age = Number(profile?.age) || 0;
  const sex = String(profile?.sex || 'Male');

  if (!weightKg || !heightCm || !age) {
    return {
      hasData: false,
      message: 'Complete profile data to compute food analytics.',
    };
  }

  const bmr = mifflinStJeorBmr(weightKg, heightCm, age, sex);
  const proteinGoal = weightKg * PROTEIN_GOAL_G_PER_KG;

  const sleepByDate = buildSleepMap(sleepLogs);
  const dailyRows = aggregateDailyFood(foodLogs)
    .map((row) => {
      const sleepHours = sleepByDate.get(row.date) ?? null;
      const proteinAdequacyRatio = proteinGoal > 0 ? row.protein / proteinGoal : 0;
      const netEnergyBalance = row.calories - bmr;
      return {
        ...row,
        sleepHours,
        proteinAdequacyRatio,
        netEnergyBalance,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = dailyRows[dailyRows.length - 1];
  const avgEnergyBalance = avg(dailyRows.map((d) => d.netEnergyBalance));
  const avgProteinRatio = avg(dailyRows.map((d) => d.proteinAdequacyRatio));
  const avgSleep = avg(dailyRows.map((d) => d.sleepHours).filter((v) => v != null));

  const insights = [];
  const recommendations = [];

  if (avgEnergyBalance < -300) {
    insights.push('Average energy balance suggests a meaningful calorie deficit.');
  } else if (avgEnergyBalance > 300) {
    insights.push('Average energy balance suggests a calorie surplus.');
  } else {
    insights.push('Average energy balance is near maintenance.');
  }

  if (avgProteinRatio < 0.9) {
    insights.push('Protein intake is below the target needed to support recovery.');
    recommendations.push('Increase daily protein intake to better support recovery.');
  } else {
    insights.push('Protein intake is generally meeting recovery targets.');
  }

  if (avgSleep !== null) {
    if (avgSleep < 6) {
      insights.push('Average sleep is low and may reduce recovery and next-day performance.');
      recommendations.push('Improve sleep duration to support recovery and next-day performance.');
    } else if (avgSleep < 7) {
      insights.push('Average sleep is moderate but may still limit optimal recovery.');
      recommendations.push('Try increasing sleep consistency to improve recovery.');
    } else {
      insights.push('Average sleep appears supportive of recovery.');
    }
  }

  return {
    hasData: true,
    days: dailyRows.length,
    today: {
      calories: round(today?.calories || 0, 0),
      protein: round(today?.protein || 0, 1),
      carbs: round(today?.carbs || 0, 1),
      fats: round(today?.fats || 0, 1),
      energyBalance: round(today?.netEnergyBalance || 0, 0),
      proteinAdequacyRatio: round(today?.proteinAdequacyRatio || 0, 2),
      proteinGoal: round(proteinGoal, 0),
    },
    rolling: {
      calories7dAvg: round(avg(lastN(dailyRows.map((d) => d.calories), 7)), 0),
      protein7dAvg: round(avg(lastN(dailyRows.map((d) => d.protein), 7)), 1),
      sleep7dAvg: round(avg(lastN(dailyRows.map((d) => d.sleepHours).filter((v) => v != null), 7)), 1),
    },
    insights,
    recommendations,
  };
}

function aggregateDailyFood(foodLogs) {
  const byDate = new Map();

  for (const log of foodLogs) {
    const date = normalizeDate(log?.date, log?.createdAt);
    if (!date) continue;

    if (!byDate.has(date)) {
      byDate.set(date, { date, calories: 0, protein: 0, carbs: 0, fats: 0 });
    }

    const row = byDate.get(date);
    row.calories += Number(log?.calories) || 0;
    row.protein += Number(log?.protein) || 0;
    row.carbs += Number(log?.carbs) || 0;
    row.fats += Number(log?.fats) || 0;
  }

  return Array.from(byDate.values());
}

function buildSleepMap(sleepLogs) {
  const map = new Map();
  if (!Array.isArray(sleepLogs)) return map;

  for (const log of sleepLogs) {
    const date = normalizeDate(log?.date, log?.createdAt);
    if (!date) continue;

    const hours = Number(log?.sleepHours);
    if (!Number.isFinite(hours)) continue;

    if (!map.has(date)) {
      map.set(date, { total: 0, count: 0 });
    }
    const acc = map.get(date);
    acc.total += hours;
    acc.count += 1;
  }

  for (const [date, val] of map.entries()) {
    map.set(date, val.count > 0 ? val.total / val.count : null);
  }

  return map;
}

function mifflinStJeorBmr(weightKg, heightCm, age, sex) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return String(sex).toLowerCase() === 'female' ? base - 161 : base + 5;
}

function normalizeDate(dateString, fallbackIso) {
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  const src = dateString || fallbackIso;
  if (!src) return null;

  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function avg(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function lastN(arr, n) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

function round(value, digits) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const p = 10 ** digits;
  return Math.round(num * p) / p;
}