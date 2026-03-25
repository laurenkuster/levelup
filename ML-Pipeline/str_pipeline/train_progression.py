#!/usr/bin/env python3
"""
Train a strength progression prediction model.

Uses the 721 Weight Training Workouts dataset to build a model that predicts
the user's next-session estimated 1RM for each exercise based on recent
training history (lag features, volume, frequency).

Features (per exercise, per session):
  - Last 5 session 1RMs (lag_1rm_1 ... lag_1rm_5)
  - Last 5 session volumes (lag_vol_1 ... lag_vol_5)
  - Days since last session (days_gap)
  - Rolling 7-day and 14-day avg 1RM
  - Session count in last 14 days (frequency)
  - Exercise category (encoded)

Target: next_session_1rm

Model: Gradient Boosted Trees (XGBoost or sklearn GBR)

Output:
  - str_progression_model.joblib (sklearn model)
  - str_progression_model.json (exported for JS inference)
"""

import json
import logging
from datetime import timedelta

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from config import (
    ensure_dirs, WORKOUTS_PROCESSED,
    PROGRESSION_MODEL_JSON, PROGRESSION_MODEL_JOBLIB, REPORTS_DIR,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

N_LAGS = 5


def build_features(df):
    """
    Build time-series features per exercise.

    For each exercise, sort sessions by date and create lag features
    (previous 1RM values), rolling averages, and frequency counts.
    """
    if "exercise_name" not in df.columns and "exercise" in df.columns:
        df = df.rename(columns={"exercise": "exercise_name"})

    exercises = df["exercise_name"].unique()
    log.info("Building features for %d exercises ...", len(exercises))

    all_rows = []

    for ex in exercises:
        ex_df = df[df["exercise_name"] == ex].sort_values("date").copy()

        if len(ex_df) < N_LAGS + 2:
            continue

        # Group by session date: take max 1RM per session
        sessions = ex_df.groupby("date").agg(
            max_1rm=("estimated_1rm", "max"),
            total_volume=("estimated_1rm", "sum"),
            set_count=("estimated_1rm", "count"),
        ).reset_index().sort_values("date")

        if len(sessions) < N_LAGS + 2:
            continue

        for i in range(N_LAGS, len(sessions)):
            row = {"exercise": ex}

            # Lag features
            for lag in range(1, N_LAGS + 1):
                idx = i - lag
                row[f"lag_1rm_{lag}"] = sessions.iloc[idx]["max_1rm"]
                row[f"lag_vol_{lag}"] = sessions.iloc[idx]["total_volume"]

            # Days gap
            current_date = sessions.iloc[i]["date"]
            prev_date = sessions.iloc[i - 1]["date"]
            row["days_gap"] = (current_date - prev_date).days

            # Rolling averages
            window = sessions.iloc[max(0, i - 7):i]
            row["rolling_7d_1rm"] = window["max_1rm"].mean()
            row["rolling_7d_vol"] = window["total_volume"].mean()

            window14 = sessions.iloc[max(0, i - 14):i]
            row["rolling_14d_1rm"] = window14["max_1rm"].mean()

            # Frequency: sessions in last 14 days
            cutoff = current_date - timedelta(days=14)
            row["frequency_14d"] = len(sessions[(sessions["date"] >= cutoff) & (sessions["date"] < current_date)])

            # Trend: slope of last 5 sessions
            recent = sessions.iloc[max(0, i - N_LAGS):i]["max_1rm"].values
            if len(recent) >= 2:
                row["trend"] = float(np.polyfit(range(len(recent)), recent, 1)[0])
            else:
                row["trend"] = 0.0

            # Target
            row["next_1rm"] = sessions.iloc[i]["max_1rm"]

            all_rows.append(row)

    result = pd.DataFrame(all_rows)
    log.info("Built %d feature rows from %d exercises", len(result), len(exercises))
    return result


def train_model(features_df):
    """Train a gradient boosted regression model."""
    feature_cols = [c for c in features_df.columns if c not in ("exercise", "next_1rm")]
    X = features_df[feature_cols].values
    y = features_df["next_1rm"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
    )

    log.info("Training GBR: %d train, %d test", len(X_train), len(X_test))

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    log.info("Test MAE: %.2f lbs", mae)
    log.info("Test RMSE: %.2f lbs", rmse)
    log.info("Test R2: %.4f", r2)

    # Feature importance
    importances = dict(zip(feature_cols, model.feature_importances_.tolist()))
    top_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:10]
    log.info("Top features: %s", top_features)

    metadata = {
        "feature_names": feature_cols,
        "n_features": len(feature_cols),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "test_mae": round(mae, 2),
        "test_rmse": round(rmse, 2),
        "test_r2": round(r2, 4),
        "feature_importances": importances,
    }

    return model, metadata


def export_model_json(model, metadata):
    """Export the model to a simplified JSON format for JS inference."""
    # For GBR, we export a simplified lookup: feature weights + intercept
    # The full tree export is complex for GBR, so we provide metadata
    # and the app uses a hybrid approach (local rules + cloud inference)
    export = {
        "type": "gradient_boosting_regressor",
        "target": "next_session_1rm",
        "n_estimators": model.n_estimators,
        "max_depth": model.max_depth,
        "feature_names": metadata["feature_names"],
        "feature_importances": metadata["feature_importances"],
        "test_mae_lbs": metadata["test_mae"],
        "test_rmse_lbs": metadata["test_rmse"],
        "test_r2": metadata["test_r2"],
        "n_train_samples": metadata["n_train"],
        "description": "Predicts next-session estimated 1RM based on training history lag features.",
        "usage": "Feed last 5 session 1RMs, volumes, days gap, rolling averages, and frequency. Output is predicted 1RM in lbs.",
    }

    return export


def main():
    ensure_dirs()

    if not WORKOUTS_PROCESSED.exists():
        log.error("Workouts data not found at %s. Run download_data.py --workouts first.", WORKOUTS_PROCESSED)
        return

    log.info("Loading workout data ...")
    df = pd.read_parquet(WORKOUTS_PROCESSED)
    log.info("Loaded %d rows", len(df))

    features_df = build_features(df)
    if len(features_df) < 20:
        log.error("Not enough feature rows (%d). Need more training data.", len(features_df))
        return

    model, metadata = train_model(features_df)

    # Save model
    joblib.dump(model, PROGRESSION_MODEL_JOBLIB)
    log.info("Saved model: %s", PROGRESSION_MODEL_JOBLIB)

    # Export JSON
    export = export_model_json(model, metadata)
    PROGRESSION_MODEL_JSON.write_text(json.dumps(export, indent=2))
    log.info("Saved JSON: %s", PROGRESSION_MODEL_JSON)

    # Save report
    report_path = REPORTS_DIR / "str_progression_report.json"
    report_path.write_text(json.dumps(metadata, indent=2))
    log.info("Saved report: %s", report_path)

    log.info("STR progression model training complete!")


if __name__ == "__main__":
    main()
