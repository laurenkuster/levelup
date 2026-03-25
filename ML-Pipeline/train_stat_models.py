#!/usr/bin/env python3
"""
Train ML models for STR, SPD, STM, and DEX stat predictions.

Each model is a Random Forest trained on cleaned public datasets:
  STR: OpenPowerlifting → predict Dots score (strength relative to bodyweight)
  SPD: World Athletics  → predict wind-adjusted speed (m/s)
  STM: Ultra-Marathon   → predict average speed (km/h)
  DEX: Body Performance → predict sit-and-reach flexibility (cm)

Models are saved as .joblib and exported to JSON for on-device inference.

Usage:
    python train_stat_models.py [--stat STR|SPD|STM|DEX|all]
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
STAT_MODELS_DIR = ML_DIR / "models" / "stats"

# ── Model configurations per stat ──

STAT_CONFIGS = {
    "STR": {
        "data_path": PROCESSED_DIR / "str_training.parquet",
        "target": "dots",
        "target_label": "Dots score (strength-to-bodyweight)",
        "target_range": [0, 750],
        "features": [
            "Age", "sex_numeric", "BodyweightKg", "str_to_bw",
            "squat_ratio", "bench_ratio", "deadlift_ratio",
            "meet_num", "career_meets", "days_since_last",
            "total_prev", "dots_prev", "bw_change",
            "total_change_pct", "total_rolling_mean_3",
            "dots_rolling_mean_3",
        ],
        "rf_params": {
            "n_estimators": 50,
            "max_depth": 8,
            "min_samples_split": 10,
            "min_samples_leaf": 5,
            "random_state": 42,
            "n_jobs": -1,
        },
        "max_train_rows": 200_000,  # subsample for speed
    },
    "SPD": {
        "data_path": PROCESSED_DIR / "spd_training_v2.parquet",
        "target": "running_speed_kmh",
        "target_label": "Running speed (km/h)",
        "target_range": [3, 25],
        "features": [
            "age", "sex_numeric", "weight_kg", "height_m", "bmi",
            "session_minutes", "distance_km",
            "avg_bpm", "max_bpm", "resting_bpm", "hr_reserve",
            "pct_hrr", "pct_max_hr",
            "calories_burned", "cal_per_min",
        ],
        "rf_params": {
            "n_estimators": 50,
            "max_depth": 8,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "random_state": 42,
            "n_jobs": -1,
        },
        "max_train_rows": None,
    },
    "STM": {
        "data_path": PROCESSED_DIR / "stm_training_v2.parquet",
        "target": "calories_burned",
        "target_label": "Calories burned (endurance)",
        "target_range": [50, 3500],
        "features": [
            "age", "sex_numeric", "weight_kg", "height_m", "bmi",
            "session_minutes", "running_speed_kmh", "distance_km",
            "avg_bpm", "max_bpm", "resting_bpm", "hr_reserve",
            "pct_hrr", "pct_max_hr",
            "cal_per_min",
        ],
        "rf_params": {
            "n_estimators": 50,
            "max_depth": 8,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "random_state": 42,
            "n_jobs": -1,
        },
        "max_train_rows": None,
    },
    "DEX": {
        "data_path": PROCESSED_DIR / "dex_training.parquet",
        "target": "sit_and_reach_cm",
        "target_label": "Sit-and-reach flexibility (cm)",
        "target_range": [-30, 70],
        "features": [
            "age", "sex_numeric", "height_cm", "weight_kg",
            "body_fat_pct", "bmi", "grip_force", "grip_ratio",
            "broad_jump_cm", "jump_ratio", "situps_count",
            "situps_per_kg", "bp_mean", "perf_class_num",
        ],
        "rf_params": {
            "n_estimators": 80,
            "max_depth": 8,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "random_state": 42,
            "n_jobs": -1,
        },
        "max_train_rows": None,
    },
}


def train_stat_model(stat):
    """Train and evaluate a model for one stat."""
    cfg = STAT_CONFIGS[stat]
    data_path = cfg["data_path"]

    if not data_path.exists():
        log.warning("[%s] Data not found: %s — skipping", stat, data_path)
        return None

    log.info("=" * 60)
    log.info("[%s] Training model", stat)
    log.info("=" * 60)

    # Load data
    df = pd.read_parquet(data_path)
    log.info("[%s] Loaded %d rows", stat, len(df))

    # Subsample if needed (for large datasets like STR)
    if cfg["max_train_rows"] and len(df) > cfg["max_train_rows"]:
        df = df.sample(n=cfg["max_train_rows"], random_state=42)
        log.info("[%s] Subsampled to %d rows", stat, len(df))

    # Select features that exist
    available = [f for f in cfg["features"] if f in df.columns]
    log.info("[%s] Features (%d): %s", stat, len(available), available)

    X = df[available].values
    y = df[cfg["target"]].values

    # Fill NaN with median
    X_df = df[available].copy()
    for col in available:
        if X_df[col].isna().any():
            med = X_df[col].median()
            X_df[col] = X_df[col].fillna(med)
    X = X_df.values

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    log.info("[%s] Train: %d, Test: %d", stat, len(X_train), len(X_test))

    # Train Random Forest
    rf = RandomForestRegressor(**cfg["rf_params"])
    cv_scores = cross_val_score(rf, X_train, y_train, cv=5, scoring="neg_mean_absolute_error")
    cv_mae = -cv_scores.mean()
    log.info("[%s] CV MAE: %.4f ± %.4f", stat, cv_mae, cv_scores.std())

    rf.fit(X_train, y_train)

    # Evaluate on test set
    y_pred = rf.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    test_r2 = r2_score(y_test, y_pred)

    log.info("[%s] Test MAE:  %.4f", stat, test_mae)
    log.info("[%s] Test RMSE: %.4f", stat, test_rmse)
    log.info("[%s] Test R²:   %.4f", stat, test_r2)

    # Save model
    STAT_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = STAT_MODELS_DIR / f"{stat.lower()}_model.joblib"
    joblib.dump(rf, model_path)
    log.info("[%s] Saved model → %s", stat, model_path)

    # Save metadata
    metadata = {
        "stat": stat,
        "model_type": "RandomForestRegressor",
        "target": cfg["target"],
        "target_label": cfg["target_label"],
        "target_range": cfg["target_range"],
        "feature_names": available,
        "n_features": len(available),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "cv_mae": round(cv_mae, 4),
        "test_mae": round(test_mae, 4),
        "test_rmse": round(test_rmse, 4),
        "test_r2": round(test_r2, 4),
        "rf_params": cfg["rf_params"],
    }
    meta_path = STAT_MODELS_DIR / f"{stat.lower()}_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2))

    # Save test data for validation
    test_data = {
        "X_test": X_test.tolist(),
        "y_test": y_test.tolist(),
        "feature_names": available,
    }
    test_path = STAT_MODELS_DIR / f"{stat.lower()}_test_data.json"
    test_path.write_text(json.dumps(test_data))

    return {
        "stat": stat,
        "model": rf,
        "features": available,
        "metadata": metadata,
    }


def main():
    ensure_dirs()

    # Parse args
    target_stat = "all"
    if len(sys.argv) > 1:
        if sys.argv[1] == "--stat" and len(sys.argv) > 2:
            target_stat = sys.argv[2].upper()
        else:
            target_stat = sys.argv[1].upper()

    stats_to_train = list(STAT_CONFIGS.keys()) if target_stat == "ALL" else [target_stat]

    results = {}
    for stat in stats_to_train:
        if stat not in STAT_CONFIGS:
            log.error("Unknown stat: %s (available: %s)", stat, list(STAT_CONFIGS.keys()))
            continue
        result = train_stat_model(stat)
        if result:
            results[stat] = result

    # Summary
    log.info("\n" + "=" * 60)
    log.info("TRAINING SUMMARY")
    log.info("=" * 60)
    for stat, r in results.items():
        m = r["metadata"]
        log.info("  %s: MAE=%.4f  RMSE=%.4f  R²=%.4f  (%d samples)",
                 stat, m["test_mae"], m["test_rmse"], m["test_r2"], m["train_samples"])

    missing = [s for s in stats_to_train if s not in results]
    if missing:
        log.warning("Missing data for: %s", missing)

    return results


if __name__ == "__main__":
    main()
