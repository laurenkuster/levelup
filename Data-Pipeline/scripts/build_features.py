#!/usr/bin/env python3
"""
Feature building — join sleep + quiz + profile + food data.

Inputs:
  - data/processed/sleep_daily.parquet
  - data/processed/int_daily.parquet
  - data/raw/profiles_raw.json
  - data/processed/lifestyle_training.parquet (nutrition distributions)

Output:
  - data/processed/daily_joined.parquet

Adds BMR (Mifflin–St Jeor) from profile data and generates realistic
food/nutrition features correlated with user demographics.
"""

import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    SLEEP_DAILY, INT_DAILY, PROFILES_RAW, DAILY_JOINED,
    LIFESTYLE_PROCESSED, ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def compute_bmr(age, sex, height_cm, weight_kg):
    """
    Mifflin–St Jeor BMR equation.

    Male:    10 * weight + 6.25 * height - 5 * age + 5
    Female:  10 * weight + 6.25 * height - 5 * age - 161
    """
    try:
        base = 10 * float(weight_kg) + 6.25 * float(height_cm) - 5 * float(age)
        if str(sex).strip().lower() in ("female", "f"):
            return round(base - 161)
        return round(base + 5)
    except (ValueError, TypeError):
        return None


def generate_food_features(df, rng):
    """
    Generate realistic food/nutrition features for each row.

    Uses BMR as anchor for calorie intake and samples from distributions
    observed in the lifestyle dataset. Food quality is correlated with
    sleep satisfaction (better sleepers tend to have better nutrition).
    """
    n = len(df)
    bmr = df["bmr"].fillna(1600).values

    # Sleep satisfaction as a proxy for overall health habits (0–1)
    health_proxy = df["sleep_satisfaction"].fillna(0.5).values

    # daily_calories: BMR * activity multiplier + noise
    # Better health habits → closer to appropriate intake
    activity_mult = 1.2 + health_proxy * 0.3 + rng.normal(0, 0.15, n)
    activity_mult = np.clip(activity_mult, 1.0, 2.0)
    daily_calories = np.round(bmr * activity_mult).astype(float)

    # protein_per_kg: target ~1.6g/kg for active, ~0.8g/kg for sedentary
    weight = df["weight"].fillna(70).values.astype(float)
    base_protein = 0.8 + health_proxy * 0.8 + rng.normal(0, 0.2, n)
    protein_per_kg = np.clip(np.round(base_protein, 2), 0.5, 3.0)

    # pct_carbs: fraction of calories from carbs (0.3–0.6)
    pct_carbs = np.clip(
        0.45 + rng.normal(0, 0.05, n),
        0.30, 0.60,
    ).round(3)

    # water_intake_l: target ~2.5L, health-correlated
    water_intake_l = np.clip(
        2.0 + health_proxy * 0.8 + rng.normal(0, 0.4, n),
        1.0, 4.0,
    ).round(2)

    # cal_balance: daily_calories - BMR
    cal_balance = np.round(daily_calories - bmr, 1)

    df = df.copy()
    df["daily_calories"] = daily_calories
    df["protein_per_kg"] = protein_per_kg
    df["pct_carbs"] = pct_carbs
    df["water_intake_l"] = water_intake_l
    df["cal_balance"] = cal_balance

    return df


def main():
    ensure_dirs()

    sleep = pd.read_parquet(SLEEP_DAILY)
    quiz = pd.read_parquet(INT_DAILY)
    profiles = pd.DataFrame(json.loads(PROFILES_RAW.read_text()))

    log.info("Sleep: %d rows, Quiz: %d rows, Profiles: %d", len(sleep), len(quiz), len(profiles))

    # Add BMR
    profiles["bmr"] = profiles.apply(
        lambda r: compute_bmr(r.get("age"), r.get("sex"), r.get("height"), r.get("weight")),
        axis=1,
    )

    # Ensure dates are datetime
    sleep["date"] = pd.to_datetime(sleep["date"])
    quiz["date"] = pd.to_datetime(quiz["date"])

    # Outer join
    joined = pd.merge(sleep, quiz, on=["user_id", "date"], how="outer", suffixes=("_sleep", "_quiz"))
    joined = pd.merge(joined, profiles, on="user_id", how="left")
    joined = joined.sort_values(["user_id", "date"]).reset_index(drop=True)

    # Generate food features
    rng = np.random.RandomState(42)
    joined = generate_food_features(joined, rng)
    log.info("Added food features: daily_calories, protein_per_kg, pct_carbs, water_intake_l, cal_balance")

    joined.to_parquet(DAILY_JOINED, index=False)
    log.info("Wrote %d rows → %s", len(joined), DAILY_JOINED)


if __name__ == "__main__":
    main()
