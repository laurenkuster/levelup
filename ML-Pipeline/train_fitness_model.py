#!/usr/bin/env python3
"""
Train a general fitness calorie burn model from the Life Style dataset.

Predicts calories burned per workout session based on:
  - Body composition (age, sex, weight, height, BMI, fat%, lean mass)
  - Heart rate (max, avg, resting, HR reserve, %HRR)
  - Workout parameters (duration, type, difficulty, sets, reps, frequency)
  - Nutrition (protein/kg, carb%, daily calories, water intake)

This model enhances the Energy/HP system with real fitness data.

Usage:
    python train_fitness_model.py
"""

import json
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import ML_DIR, DATA_PIPELINE_DIR, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

PROCESSED_DIR = DATA_PIPELINE_DIR / "data" / "processed"
FITNESS_MODELS_DIR = ML_DIR / "models" / "fitness"

FEATURES = [
    "age", "sex_numeric", "weight_kg", "height_m", "bmi", "fat_pct",
    "lean_mass_kg",
    "max_bpm", "avg_bpm", "resting_bpm", "hr_reserve", "pct_hrr", "pct_max_hr",
    "session_hours", "workout_type_num", "difficulty_num", "body_part_num",
    "sets", "reps", "total_reps",
    "workout_freq", "experience_level",
    "protein_per_kg", "pct_carbs", "water_intake_l",
]

TARGET = "calories_burned"
TARGET_LABEL = "Calories burned per session"
TARGET_RANGE = [100, 3500]

RF_PARAMS = {
    "n_estimators": 30,
    "max_depth": 8,
    "min_samples_split": 10,
    "min_samples_leaf": 5,
    "random_state": 42,
    "n_jobs": -1,
}


def train():
    ensure_dirs()
    FITNESS_MODELS_DIR.mkdir(parents=True, exist_ok=True)

    data_path = PROCESSED_DIR / "lifestyle_training.parquet"
    if not data_path.exists():
        log.error("Data not found: %s — run preprocess_lifestyle.py first", data_path)
        return None

    log.info("=" * 60)
    log.info("Training FITNESS calorie burn model")
    log.info("=" * 60)

    df = pd.read_parquet(data_path)
    log.info("Loaded %d rows", len(df))

    # Select available features
    available = [f for f in FEATURES if f in df.columns]
    log.info("Features (%d/%d): %s", len(available), len(FEATURES), available)

    X = df[available].copy()
    y = df[TARGET].values

    # Fill NaN with median
    for col in available:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())
    X = X.values

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    log.info("Train: %d, Test: %d", len(X_train), len(X_test))

    # Train
    rf = RandomForestRegressor(**RF_PARAMS)
    cv_scores = cross_val_score(rf, X_train, y_train, cv=5, scoring="neg_mean_absolute_error")
    cv_mae = -cv_scores.mean()
    log.info("CV MAE: %.2f ± %.2f", cv_mae, cv_scores.std())

    rf.fit(X_train, y_train)

    # Evaluate
    y_pred = rf.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    test_r2 = r2_score(y_test, y_pred)

    log.info("Test MAE:  %.2f cal", test_mae)
    log.info("Test RMSE: %.2f cal", test_rmse)
    log.info("Test R²:   %.4f", test_r2)

    # Feature importance
    importances = sorted(
        zip(available, rf.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    log.info("Top features:")
    for name, imp in importances[:10]:
        log.info("  %-20s %.4f", name, imp)

    # Save model
    model_path = FITNESS_MODELS_DIR / "fitness_model.joblib"
    joblib.dump(rf, model_path)
    log.info("Saved model → %s", model_path)

    # Save metadata
    metadata = {
        "model_type": "RandomForestRegressor",
        "target": TARGET,
        "target_label": TARGET_LABEL,
        "target_range": TARGET_RANGE,
        "feature_names": available,
        "n_features": len(available),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "cv_mae": round(cv_mae, 2),
        "test_mae": round(test_mae, 2),
        "test_rmse": round(test_rmse, 2),
        "test_r2": round(test_r2, 4),
        "rf_params": RF_PARAMS,
        "feature_importances": {n: round(float(i), 4) for n, i in importances},
    }
    meta_path = FITNESS_MODELS_DIR / "fitness_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2))

    log.info("=" * 60)
    log.info("FITNESS MODEL SUMMARY")
    log.info("  MAE:  %.2f cal (±%.0f cal average error)", test_mae, test_mae)
    log.info("  R²:   %.4f", test_r2)
    log.info("  Trees: %d, Depth: %d", RF_PARAMS["n_estimators"], RF_PARAMS["max_depth"])
    log.info("=" * 60)

    return rf, metadata


if __name__ == "__main__":
    train()
