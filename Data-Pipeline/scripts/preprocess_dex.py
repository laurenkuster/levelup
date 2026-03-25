"""
preprocess_dex.py

Cleans Body Performance data for DEX model training.

Source: https://www.kaggle.com/datasets/kukuroo3/body-performance-data (CC0)
        Korea Sports Promotion Foundation national fitness assessment.

Target: Predict flexibility score (sit-and-reach cm) based on demographics,
        body composition, and other fitness metrics.

Pipeline:
  1. Load raw CSV (~13.4K rows)
  2. Clean and validate ranges
  3. Engineer features (BMI, fitness ratios)
  4. Save cleaned parquet
"""

import pandas as pd
import numpy as np
from config import BODY_PERFORMANCE_RAW, DEX_PROCESSED, ensure_dirs


def load_raw():
    print(f"[DEX] Loading {BODY_PERFORMANCE_RAW} ...")
    df = pd.read_csv(BODY_PERFORMANCE_RAW)
    print(f"  Raw rows: {len(df):,}")
    print(f"  Columns: {list(df.columns)}")
    return df


def clean(df):
    # Standardize column names
    col_map = {}
    for c in df.columns:
        cl = c.lower().strip()
        if cl == "age":
            col_map[c] = "age"
        elif "gender" in cl:
            col_map[c] = "gender"
        elif "height" in cl:
            col_map[c] = "height_cm"
        elif "weight" in cl:
            col_map[c] = "weight_kg"
        elif "body fat" in cl or "fat_%" in cl or "body_fat" in cl:
            col_map[c] = "body_fat_pct"
        elif "diastolic" in cl:
            col_map[c] = "bp_diastolic"
        elif "systolic" in cl:
            col_map[c] = "bp_systolic"
        elif "grip" in cl:
            col_map[c] = "grip_force"
        elif "sit" in cl and "bend" in cl:
            col_map[c] = "sit_and_reach_cm"
        elif "sit-up" in cl or "sit_up" in cl or "situp" in cl:
            col_map[c] = "situps_count"
        elif "broad" in cl or "jump" in cl:
            col_map[c] = "broad_jump_cm"
        elif "class" in cl:
            col_map[c] = "performance_class"
    df = df.rename(columns=col_map)

    # Validate ranges
    df = df[(df["age"] >= 14) & (df["age"] <= 80)]
    df = df[(df["height_cm"] >= 100) & (df["height_cm"] <= 250)]
    df = df[(df["weight_kg"] >= 30) & (df["weight_kg"] <= 200)]
    df = df[(df["body_fat_pct"] >= 2) & (df["body_fat_pct"] <= 60)]

    # The target: sit_and_reach_cm (flexibility test)
    df = df.dropna(subset=["sit_and_reach_cm"])
    # Sit-and-reach can be negative (can't reach toes)
    df = df[(df["sit_and_reach_cm"] >= -30) & (df["sit_and_reach_cm"] <= 70)]

    # Sex → numeric
    df["sex_numeric"] = (df["gender"] == "M").astype(int)

    print(f"  After cleaning: {len(df):,}")
    return df


def engineer_features(df):
    """Compute derived features for flexibility prediction."""
    # BMI
    df["bmi"] = (df["weight_kg"] / (df["height_cm"] / 100) ** 2).round(1)

    # Strength-to-weight ratio (grip)
    df["grip_ratio"] = (df["grip_force"] / df["weight_kg"]).round(3)

    # Power-to-weight (broad jump)
    df["jump_ratio"] = (df["broad_jump_cm"] / df["weight_kg"]).round(3)

    # Endurance proxy (situps)
    df["situps_per_kg"] = (df["situps_count"] / df["weight_kg"]).round(3)

    # Age decade for grouping
    df["age_decade"] = (df["age"] // 10 * 10)

    # Performance class → numeric (A=3, B=2, C=1, D=0)
    class_map = {"A": 3, "B": 2, "C": 1, "D": 0}
    df["perf_class_num"] = df["performance_class"].map(class_map).fillna(1)

    # Cardiovascular health proxy
    df["bp_mean"] = ((df["bp_systolic"] + df["bp_diastolic"]) / 2).round(1)

    # Flexibility percentile within age+sex group
    df["flex_percentile"] = df.groupby(["age_decade", "sex_numeric"])["sit_and_reach_cm"].rank(
        pct=True
    ).round(4)

    print(f"  After feature engineering: {len(df):,}")
    return df


def build_training_set(df):
    """Select features + target for ML."""
    features = [
        "age", "sex_numeric", "height_cm", "weight_kg",
        "body_fat_pct", "bmi", "grip_force", "grip_ratio",
        "broad_jump_cm", "jump_ratio", "situps_count",
        "situps_per_kg", "bp_mean", "perf_class_num",
    ]
    target = "sit_and_reach_cm"

    out = df[features + [target]].dropna()
    print(f"  Final training rows: {len(out):,}")
    return out


def main():
    ensure_dirs()
    if not BODY_PERFORMANCE_RAW.exists():
        print(f"[DEX] Raw file not found: {BODY_PERFORMANCE_RAW}")
        print("  Download from: https://www.kaggle.com/datasets/kukuroo3/body-performance-data")
        print(f"  Place CSV in: {BODY_PERFORMANCE_RAW}")
        return

    df = load_raw()
    df = clean(df)
    df = engineer_features(df)
    training = build_training_set(df)

    training.to_parquet(DEX_PROCESSED, index=False)
    print(f"[DEX] Saved {DEX_PROCESSED} ({len(training):,} rows)")
    print(f"  Features: {list(training.columns[:-1])}")
    print(f"  Target: sit_and_reach_cm")
    print(f"  Stats:\n{training.describe().round(2).to_string()}")


if __name__ == "__main__":
    main()
