"""
preprocess_str.py

Cleans OpenPowerlifting data for STR model training.

Source: https://openpowerlifting.gitlab.io/opl-csv/ (Public Domain / CC0)

Target: Predict strength progression score based on demographics,
        bodyweight, and training history features.

Pipeline:
  1. Load raw CSV (~3.8M rows)
  2. Filter to raw/single-ply, with valid age + bodyweight + total
  3. Compute per-lifter progression features (meet-over-meet gains)
  4. Engineer target: normalized strength score (Dots/Wilks)
  5. Save cleaned parquet for ML training
"""

import pandas as pd
import numpy as np
from config import OPL_RAW, STR_PROCESSED, ensure_dirs

COLS_KEEP = [
    "Name", "Sex", "Age", "BodyweightKg", "Best3SquatKg",
    "Best3BenchKg", "Best3DeadliftKg", "TotalKg", "Dots",
    "Wilks", "Equipment", "Date", "Tested",
]


def load_raw():
    print(f"[STR] Loading {OPL_RAW} ...")
    df = pd.read_csv(OPL_RAW, usecols=COLS_KEEP, low_memory=False)
    print(f"  Raw rows: {len(df):,}")
    return df


def clean(df):
    # Keep Raw and Single-ply only (most common recreational lifters)
    df = df[df["Equipment"].isin(["Raw", "Single-ply"])].copy()

    # Require valid age, bodyweight, total
    df = df.dropna(subset=["Age", "BodyweightKg", "TotalKg"])
    df = df[(df["Age"] >= 14) & (df["Age"] <= 80)]
    df = df[(df["BodyweightKg"] >= 30) & (df["BodyweightKg"] <= 250)]
    df = df[df["TotalKg"] > 0]

    # Parse date
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])

    # Sex → numeric
    df["sex_numeric"] = (df["Sex"] == "M").astype(int)

    # Compute strength-to-bodyweight ratio
    df["str_to_bw"] = df["TotalKg"] / df["BodyweightKg"]

    # Individual lift ratios
    for lift in ["Best3SquatKg", "Best3BenchKg", "Best3DeadliftKg"]:
        col = lift.replace("Best3", "").replace("Kg", "").lower() + "_ratio"
        df[col] = df[lift].fillna(0) / df["BodyweightKg"]

    # Use Dots score as strength metric (more modern than Wilks)
    df["dots"] = df["Dots"].fillna(0)
    df = df[df["dots"] > 0]

    print(f"  After cleaning: {len(df):,} rows")
    return df


def engineer_progression(df):
    """Per-lifter progression features: gains between meets."""
    df = df.sort_values(["Name", "Date"])

    # Group by lifter — compute meet-over-meet stats
    g = df.groupby("Name")
    df["meet_num"] = g.cumcount() + 1
    df["total_prev"] = g["TotalKg"].shift(1)
    df["dots_prev"] = g["dots"].shift(1)
    df["days_since_last"] = g["Date"].diff().dt.days
    df["bw_prev"] = g["BodyweightKg"].shift(1)

    # Progression metrics
    df["total_change_kg"] = df["TotalKg"] - df["total_prev"]
    df["total_change_pct"] = (df["total_change_kg"] / df["total_prev"] * 100).round(2)
    df["dots_change"] = df["dots"] - df["dots_prev"]
    df["bw_change"] = df["BodyweightKg"] - df["bw_prev"]

    # Rolling features per lifter
    df["total_rolling_mean_3"] = g["TotalKg"].transform(
        lambda x: x.rolling(3, min_periods=1).mean()
    )
    df["dots_rolling_mean_3"] = g["dots"].transform(
        lambda x: x.rolling(3, min_periods=1).mean()
    )

    # How many meets this lifter has done
    df["career_meets"] = g["meet_num"].transform("max")

    print(f"  After progression engineering: {len(df):,} rows")
    return df


def build_training_set(df):
    """Select features for ML training."""
    # Target: dots score (normalized strength relative to bodyweight)
    # This is what we want to predict / track progression of

    # Only keep rows with progression data (need at least 2 meets)
    prog = df[df["meet_num"] >= 2].copy()
    print(f"  Rows with progression history: {len(prog):,}")

    features = [
        "Age", "sex_numeric", "BodyweightKg", "str_to_bw",
        "squat_ratio", "bench_ratio", "deadlift_ratio",
        "meet_num", "career_meets", "days_since_last",
        "total_prev", "dots_prev", "bw_change",
        "total_change_pct", "total_rolling_mean_3",
        "dots_rolling_mean_3",
    ]
    target = "dots"

    out = prog[features + [target]].dropna()
    print(f"  Final training rows: {len(out):,}")
    return out


def main():
    ensure_dirs()
    df = load_raw()
    df = clean(df)
    df = engineer_progression(df)
    training = build_training_set(df)

    training.to_parquet(STR_PROCESSED, index=False)
    print(f"[STR] Saved {STR_PROCESSED} ({len(training):,} rows)")
    print(f"  Features: {list(training.columns[:-1])}")
    print(f"  Target: dots")
    print(f"  Stats:\n{training.describe().round(2).to_string()}")


if __name__ == "__main__":
    main()
