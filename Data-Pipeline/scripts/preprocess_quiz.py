#!/usr/bin/env python3
"""
Quiz attempt preprocessing.

Input:  data/raw/quiz_attempts_raw.json
Output: data/processed/int_daily.parquet
"""

import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import QUIZ_RAW, INT_DAILY, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def compute_int_score(accuracy, streak_days=1):
    """
    INT score (0–100).

    Formula: accuracy * 75 + streak_bonus * 25
    """
    acc_comp = min(1.0, accuracy) * 75
    streak_comp = min(1.0, streak_days / 7) * 25
    return round(min(100, max(0, acc_comp + streak_comp)), 2)


def preprocess_quiz(df):
    """
    Clean and aggregate quiz data to daily level.

    Steps:
      1. Parse timestamp → date
      2. Compute accuracy
      3. Clean avg_time_per_question (filter >300s or ≤0)
      4. Remove impossible values
      5. Aggregate per user per day
      6. Compute INT score + rolling features
    """
    df = df.copy()

    # 1. Date
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["date"] = df["timestamp"].dt.date
    df["date"] = pd.to_datetime(df["date"])

    # 2. Accuracy
    df["num_questions"] = pd.to_numeric(df.get("num_questions"), errors="coerce")
    df["num_correct"] = pd.to_numeric(df.get("num_correct"), errors="coerce")
    df["accuracy"] = np.where(
        df["num_questions"] > 0,
        (df["num_correct"] / df["num_questions"]).clip(0, 1),
        np.nan,
    )

    # 3. Clean time
    df["avg_time_per_question"] = pd.to_numeric(
        df.get("avg_time_per_question_seconds"), errors="coerce"
    )
    df.loc[
        (df["avg_time_per_question"] <= 0) | (df["avg_time_per_question"] > 300),
        "avg_time_per_question",
    ] = np.nan

    # 4. Remove impossible
    df = df[df["num_correct"] >= 0].copy()

    # 5. Daily aggregation
    daily = (
        df.groupby(["user_id", "date"])
        .agg(
            attempts_count=("accuracy", "count"),
            avg_accuracy=("accuracy", "mean"),
            avg_time_per_question=("avg_time_per_question", "mean"),
        )
        .reset_index()
    )
    daily["avg_accuracy"] = daily["avg_accuracy"].round(4)
    daily["avg_time_per_question"] = daily["avg_time_per_question"].round(2)

    # 6. Streak + INT score + rolling
    daily = daily.sort_values(["user_id", "date"])

    parts = []
    for uid, group in daily.groupby("user_id"):
        group = group.set_index("date").sort_index()
        streak = 0
        streaks = []
        prev_date = None
        for d in group.index:
            if prev_date is not None and (d - prev_date).days == 1:
                streak += 1
            else:
                streak = 1
            streaks.append(streak)
            prev_date = d
        group["streak"] = streaks
        group["int_score"] = [
            compute_int_score(acc, st)
            for acc, st in zip(group["avg_accuracy"], group["streak"])
        ]
        group["rolling_int_3d"] = (
            group["int_score"].rolling("3D", min_periods=1).mean().round(2)
        )
        group["rolling_int_7d"] = (
            group["int_score"].rolling("7D", min_periods=1).mean().round(2)
        )
        parts.append(group.reset_index())
    daily = pd.concat(parts, ignore_index=True)

    cols = [
        "user_id", "date", "attempts_count", "avg_accuracy",
        "avg_time_per_question", "int_score", "rolling_int_3d", "rolling_int_7d",
    ]
    return daily[cols].reset_index(drop=True)


def main():
    ensure_dirs()
    raw = json.loads(QUIZ_RAW.read_text())
    log.info("Loaded %d raw quiz records", len(raw))

    result = preprocess_quiz(pd.DataFrame(raw))
    result.to_parquet(INT_DAILY, index=False)
    log.info("Wrote %d rows → %s", len(result), INT_DAILY)


if __name__ == "__main__":
    main()
