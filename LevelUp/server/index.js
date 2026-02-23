import express from "express";
import cors from "cors";
import { extractFeatures } from "./analytics/features.js";
import { predictRules } from "./analytics/predict_rules.js";
import { getGlobalPrediction } from "./analytics/predict_global.js";
import { applyCalibration, computeBias } from "./analytics/calibration.js";
import { generateCurve } from "./analytics/curve.js";
import { generateRecommendations } from "./analytics/recommendations.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ name: "LevelUp API", version: "0.2.0" });
});

/* ═══════════════════════════════════════════════════
   POST /analytics/energy
   
   Progressive personalization endpoint.
   
   Body:
     profile:     { age, weight, height, sex }
     sleepLogs:   [{ date, sleepHours, quality, wakeTime, ... }]
     calibration: { bias, predictions: [{ date, predicted, actual }] }  (optional)
   
   Response:
     energy_today:       0–100
     confidence:         LOW | MEDIUM | HIGH
     method:             rules | hybrid | ml
     history_days:       number
     curve:              [{ t, minute, energy }]
     events:             [{ t, type, label }]
     recommendations:    { deepStudy, lightStudy, meals, workout, sleep }
     insights:           string[]
     calibration_update: { bias, window_days }
   ═══════════════════════════════════════════════════ */

app.post("/analytics/energy", (req, res) => {
  try {
    const { profile, sleepLogs = [], calibration } = req.body;

    // ── 1. Validate gating conditions ──
    if (!profile || !profile.age || !profile.weight || !profile.height || !profile.sex) {
      return res.status(200).json({
        error: "incomplete_profile",
        message: "Complete your profile (age, weight, height, sex) to unlock analytics.",
      });
    }

    if (sleepLogs.length === 0) {
      return res.status(200).json({
        error: "no_sleep_data",
        message: "Log last night's sleep to see your energy forecast.",
      });
    }

    // ── 2. Extract features ──
    const features = extractFeatures(profile, sleepLogs);
    const { history_days, wake_minute } = features;

    // ── 3. Choose prediction method based on history ──
    let basePrediction;
    let method;
    let confidence;

    if (history_days < 2) {
      // COLD START: rule-based only
      basePrediction = predictRules(features);
      method = "rules";
      confidence = "LOW";
    } else if (history_days < 7) {
      // HYBRID: rules + user bias calibration
      basePrediction = predictRules(features);
      method = "hybrid";
      confidence = "MEDIUM";
    } else {
      // ML MODE: global model + calibration
      basePrediction = getGlobalPrediction(features);
      method = "ml";
      confidence = "HIGH";
    }

    // ── 4. Apply calibration bias ──
    const energy_today = (method === "rules")
      ? basePrediction
      : applyCalibration(basePrediction, calibration);

    // ── 5. Update calibration if prediction history is available ──
    let calibration_update = { bias: calibration?.bias || 0, window_days: 0 };
    if (calibration?.predictions && calibration.predictions.length > 0) {
      calibration_update = computeBias(calibration.predictions);
    }

    // ── 6. Generate curve + recommendations ──
    const curve = generateCurve(energy_today, wake_minute);
    const recs = generateRecommendations(curve, wake_minute);

    // ── 7. Generate insights ──
    const insights = [];
    if (energy_today >= 80) {
      insights.push("Your energy levels look excellent today! 🔥");
    } else if (energy_today >= 60) {
      insights.push("Solid energy predicted for today.");
    } else if (energy_today >= 40) {
      insights.push("Moderate energy today. Pace yourself.");
    } else {
      insights.push("Low energy predicted. Rest when you can. 😴");
    }

    if (features.sleep_debt > 3) {
      insights.push(`You have ${features.sleep_debt.toFixed(1)}h of sleep debt this week.`);
    }

    if (recs.deepStudy.length > 0) {
      insights.push(`Best focus window: ${recs.deepStudy[0].start}–${recs.deepStudy[0].end}.`);
    }

    if (method === "rules") {
      insights.push("Confidence will improve as you log more sleep data.");
    }

    // ── 8. Respond ──
    res.json({
      energy_today,
      confidence,
      method,
      history_days,
      base_prediction: basePrediction,
      curve,
      events: recs.events,
      recommendations: {
        deepStudy: recs.deepStudy,
        lightStudy: recs.lightStudy,
        meals: recs.meals,
        workout: recs.workout,
        sleep: recs.sleep,
      },
      insights,
      calibration_update,
      features: {
        bmr: features.bmr,
        recovery_ratio: features.recovery_ratio,
        last_night_hours: features.last_night_hours,
        required_hours: features.required_hours,
        quality: features.quality,
        sleep_debt: features.sleep_debt,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
