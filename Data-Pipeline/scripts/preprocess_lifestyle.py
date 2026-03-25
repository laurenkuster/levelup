"""
preprocess_lifestyle.py

Cleans the Life Style dataset for general fitness calorie prediction
and cross-stat model enrichment.

Source: https://www.kaggle.com/datasets/jockeroika/life-style-data

Contains 20K rows with workout sessions, exercise details, nutrition,
heart rate, and body composition — all merged into a single CSV.

Outputs:
  - lifestyle_training.parquet  (general fitness, all workout types)
  - lifestyle_str.parquet       (Strength-only subset)
  - lifestyle_spd.parquet       (HIIT subset → maps to SPD)
  - lifestyle_stm.parquet       (Cardio subset → maps to STM)
  - lifestyle_dex.parquet       (Yoga subset → maps to DEX)

Pipeline:
  1. Load Final_data.csv
  2. Clean and validate
  3. Engineer training features
  4. Split by workout type and save
"""

import pandas as pd
import numpy as np
from pathlib import Path
from config import LIFESTYLE_RAW, LIFESTYLE_PROCESSED, ensure_dirs

PROCESSED_DIR = LIFESTYLE_PROCESSED.parent  # Data-Pipeline/data/processed


def load_data():
    """Load the merged lifestyle CSV."""
    csv_path = LIFESTYLE_RAW / "Final_data.csv"
    if not csv_path.exists():
        # Try any CSV in directory
        csvs = list(LIFESTYLE_RAW.glob("*.csv"))
        if not csvs:
            print(f"[LIFESTYLE] No CSV files found in {LIFESTYLE_RAW}")
            return None
        csv_path = csvs[0]

    df = pd.read_csv(csv_path, low_memory=False)
    print(f"[LIFESTYLE] Loaded {len(df):,} rows, {len(df.columns)} columns from {csv_path.name}")
    return df


def clean(df):
    """Clean and validate the dataset."""
    n0 = len(df)

    # Validate numeric ranges
    df = df[(df["Age"] >= 14) & (df["Age"] <= 80)]
    df = df[(df["Weight (kg)"] >= 30) & (df["Weight (kg)"] <= 200)]
    df = df[(df["Height (m)"] >= 1.2) & (df["Height (m)"] <= 2.3)]
    df = df[(df["Calories_Burned"] > 0)]
    df = df[(df["Session_Duration (hours)"] > 0)]

    # Clean workout type
    df["Workout_Type"] = df["Workout_Type"].str.strip().str.title()

    # Clean gender
    df["Gender"] = df["Gender"].str.strip().str.title()

    print(f"  Cleaned: {n0:,} → {len(df):,} rows")
    return df


def engineer_features(df):
    """Build rich feature set for ML training."""
    out = pd.DataFrame()

    # Demographics
    out["age"] = df["Age"]
    out["sex_numeric"] = df["Gender"].map({"Male": 1, "Female": 0}).fillna(0).astype(int)
    out["weight_kg"] = df["Weight (kg)"]
    out["height_m"] = df["Height (m)"]
    out["bmi"] = (df["Weight (kg)"] / df["Height (m)"] ** 2).round(2)
    out["fat_pct"] = df["Fat_Percentage"]

    # Body composition
    out["lean_mass_kg"] = df["lean_mass_kg"]
    out["fat_mass_kg"] = (df["Weight (kg)"] * df["Fat_Percentage"] / 100).round(2)

    # Heart rate
    out["max_bpm"] = df["Max_BPM"]
    out["avg_bpm"] = df["Avg_BPM"]
    out["resting_bpm"] = df["Resting_BPM"]
    out["hr_reserve"] = df["Max_BPM"] - df["Resting_BPM"]
    hr_reserve_safe = out["hr_reserve"].clip(lower=1)
    out["pct_hrr"] = ((df["Avg_BPM"] - df["Resting_BPM"]) / hr_reserve_safe).round(4)
    out["pct_max_hr"] = (df["Avg_BPM"] / df["Max_BPM"].clip(lower=1)).round(4)

    # Workout parameters
    out["session_hours"] = df["Session_Duration (hours)"]
    out["session_minutes"] = (df["Session_Duration (hours)"] * 60).round(1)
    out["workout_freq"] = df["Workout_Frequency (days/week)"]
    out["experience_level"] = df["Experience_Level"].round(0).astype(int)

    # Exercise details
    out["sets"] = df["Sets"]
    out["reps"] = df["Reps"]
    out["total_reps"] = (df["Sets"] * df["Reps"]).round(0)

    # Workout type encoding
    workout_map = {"Strength": 0, "Hiit": 1, "Cardio": 2, "Yoga": 3}
    out["workout_type_num"] = df["Workout_Type"].map(workout_map).fillna(0).astype(int)
    out["workout_type"] = df["Workout_Type"]

    # Difficulty encoding
    diff_map = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
    out["difficulty_num"] = df["Difficulty Level"].map(diff_map).fillna(1).astype(int)

    # Body part encoding
    body_parts = ["Abs", "Legs", "Arms", "Back", "Forearms", "Chest", "Shoulders"]
    bp_map = {bp: i for i, bp in enumerate(body_parts)}
    out["body_part_num"] = df["Body Part"].map(bp_map).fillna(0).astype(int)

    # Nutrition
    out["protein_per_kg"] = df["protein_per_kg"]
    out["pct_carbs"] = df["pct_carbs"]
    out["daily_calories"] = df["Calories"]
    out["water_intake_l"] = df["Water_Intake (liters)"]
    out["daily_meals"] = df["Daily meals frequency"]

    # Calorie efficiency
    duration_min = (df["Session_Duration (hours)"] * 60).clip(lower=1)
    out["cal_per_min"] = (df["Calories_Burned"] / duration_min).round(2)
    out["cal_per_rep"] = (df["Calories_Burned"] / (df["Sets"] * df["Reps"]).clip(lower=1)).round(2)

    # Calorie balance
    out["cal_balance"] = df["cal_balance"]

    # Targets
    out["calories_burned"] = df["Calories_Burned"]
    out["expected_burn"] = df["expected_burn"]

    # Stat category
    stat_map = {"Strength": "STR", "Hiit": "SPD", "Cardio": "STM", "Yoga": "DEX"}
    out["stat_category"] = df["Workout_Type"].map(stat_map).fillna("OTHER")

    # Drop rows with NaN in critical columns
    critical = ["age", "weight_kg", "height_m", "calories_burned", "session_hours"]
    out = out.dropna(subset=critical)

    print(f"  Features engineered: {len(out):,} rows, {len(out.columns)} columns")
    return out


def main():
    ensure_dirs()

    df = load_data()
    if df is None:
        return

    df = clean(df)
    df = engineer_features(df)

    # Save full training set
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(LIFESTYLE_PROCESSED, index=False)
    print(f"\n[LIFESTYLE] Full dataset → {LIFESTYLE_PROCESSED} ({len(df):,} rows)")

    # Save per-stat subsets
    stat_map = {"STR": "lifestyle_str.parquet", "SPD": "lifestyle_spd.parquet",
                "STM": "lifestyle_stm.parquet", "DEX": "lifestyle_dex.parquet"}
    for stat, fname in stat_map.items():
        subset = df[df["stat_category"] == stat].copy()
        if len(subset) > 0:
            path = PROCESSED_DIR / fname
            subset.to_parquet(path, index=False)
            print(f"  {stat}: {path.name} ({len(subset):,} rows)")

    # Summary
    print(f"\nDataset summary:")
    print(f"  Total rows: {len(df):,}")
    print(f"  By workout type: {df['stat_category'].value_counts().to_dict()}")
    print(f"  Calories_burned: mean={df['calories_burned'].mean():.0f}, std={df['calories_burned'].std():.0f}")
    print(f"  Feature columns: {len(df.columns)}")


if __name__ == "__main__":
    main()
