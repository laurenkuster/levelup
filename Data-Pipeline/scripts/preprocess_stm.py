"""
preprocess_stm.py

Cleans ultra-marathon running data for STM model training.

Source: https://www.kaggle.com/datasets/aiaiaidavid/the-big-dataset-of-ultra-marathon-running (CC0)

Target: Predict endurance performance (average speed) based on
        demographics, event distance, and athlete history.

Pipeline:
  1. Load raw CSV (~7.4M rows)
  2. Filter to popular distances (50km, 100km, 50mi)
  3. Parse athlete demographics
  4. Engineer per-athlete progression features
  5. Save cleaned parquet
"""

import pandas as pd
import numpy as np
from config import ULTRA_MARATHON_RAW, STM_PROCESSED, ensure_dirs


def load_raw():
    print(f"[STM] Loading {ULTRA_MARATHON_RAW} ...")
    df = pd.read_csv(ULTRA_MARATHON_RAW, low_memory=False)
    print(f"  Raw rows: {len(df):,}")
    print(f"  Columns: {list(df.columns)}")
    return df


def clean(df):
    # Standardize column names
    df.columns = df.columns.str.strip()

    # Map expected column names (dataset may vary)
    col_map = {}
    for c in df.columns:
        cl = c.lower()
        if "year" in cl and "event" in cl:
            col_map[c] = "year"
        elif "distance" in cl or "length" in cl:
            col_map[c] = "event_distance"
        elif "performance" in cl:
            col_map[c] = "performance"
        elif "birth" in cl:
            col_map[c] = "birth_year"
        elif "gender" in cl:
            col_map[c] = "gender"
        elif "average speed" in cl:
            col_map[c] = "avg_speed_kmh"
        elif "athlete id" in cl:
            col_map[c] = "athlete_id"
        elif "age" in cl and "category" in cl:
            col_map[c] = "age_category"
        elif "country" in cl and "athlete" in cl.lower():
            col_map[c] = "country"
        elif "finisher" in cl:
            col_map[c] = "num_finishers"
        elif "event name" in cl:
            col_map[c] = "event_name"
    df = df.rename(columns=col_map)

    # Filter to distance events (50km, 100km, 50mi)
    if "event_distance" in df.columns:
        target_distances = ["50km", "100km", "50mi", "100mi"]
        df["event_distance"] = df["event_distance"].astype(str).str.strip()
        df = df[df["event_distance"].isin(target_distances)].copy()
        print(f"  Target distances: {len(df):,}")
    else:
        print("  WARNING: event_distance column not found")
        return df.head(0)

    # Average speed — must be positive
    df["avg_speed_kmh"] = pd.to_numeric(df.get("avg_speed_kmh", pd.Series(dtype=float)), errors="coerce")
    df = df[df["avg_speed_kmh"] > 0]

    # Athlete demographics
    df["birth_year"] = pd.to_numeric(df.get("birth_year", pd.Series(dtype=float)), errors="coerce")
    df["year"] = pd.to_numeric(df.get("year", pd.Series(dtype=float)), errors="coerce")
    df["age"] = df["year"] - df["birth_year"]
    df = df[(df["age"] >= 16) & (df["age"] <= 80)]

    # Sex
    df["sex_numeric"] = df["gender"].map({"M": 1, "F": 0}).fillna(0).astype(int)

    # Event distance in km
    dist_km_map = {"50km": 50, "100km": 100, "50mi": 80.47, "100mi": 160.93}
    df["distance_km"] = df["event_distance"].map(dist_km_map)

    # Performance time parsing (h:mm:ss format)
    def parse_performance(val):
        try:
            parts = str(val).split(":")
            if len(parts) == 3:
                return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
            elif len(parts) == 2:
                return float(parts[0]) * 60 + float(parts[1])
            return float(val)
        except (ValueError, TypeError):
            return np.nan

    df["elapsed_s"] = df["performance"].apply(parse_performance)
    df = df.dropna(subset=["elapsed_s"])
    df["elapsed_hours"] = (df["elapsed_s"] / 3600).round(2)

    # Pace (min/km)
    df["pace_min_km"] = (df["elapsed_s"] / 60 / df["distance_km"]).round(2)
    df = df[(df["pace_min_km"] > 2) & (df["pace_min_km"] < 20)]  # sanity

    print(f"  After cleaning: {len(df):,}")
    return df


def engineer_features(df):
    """Per-athlete progression features."""
    if "athlete_id" not in df.columns:
        df["athlete_id"] = df.index  # fallback

    df = df.sort_values(["athlete_id", "year"])
    g = df.groupby("athlete_id")

    df["race_num"] = g.cumcount() + 1
    df["career_races"] = g["race_num"].transform("max")

    # Previous performance
    df["speed_prev"] = g["avg_speed_kmh"].shift(1)
    df["pace_prev"] = g["pace_min_km"].shift(1)

    # Progression
    df["speed_change"] = (df["avg_speed_kmh"] - df["speed_prev"]).round(3)
    df["speed_change_pct"] = (df["speed_change"] / df["speed_prev"] * 100).round(2)

    # Rolling averages
    df["speed_rolling_3"] = g["avg_speed_kmh"].transform(
        lambda x: x.rolling(3, min_periods=1).mean()
    ).round(3)

    # Personal best speed to date
    df["pb_speed"] = g["avg_speed_kmh"].transform("cummax")

    # Distance category numeric
    df["dist_category"] = df["distance_km"].map({50: 0, 80.47: 1, 100: 2, 160.93: 3})

    print(f"  After feature engineering: {len(df):,}")
    return df


def build_training_set(df):
    """Select features + target for ML."""
    prog = df[df["race_num"] >= 2].copy()
    print(f"  Rows with race history: {len(prog):,}")

    features = [
        "age", "sex_numeric", "distance_km", "dist_category",
        "race_num", "career_races",
        "speed_prev", "speed_rolling_3", "pb_speed",
    ]
    target = "avg_speed_kmh"

    out = prog[features + [target]].dropna()
    print(f"  Final training rows: {len(out):,}")
    return out


def main():
    ensure_dirs()
    if not ULTRA_MARATHON_RAW.exists():
        print(f"[STM] Raw file not found: {ULTRA_MARATHON_RAW}")
        print("  Download from: https://www.kaggle.com/datasets/aiaiaidavid/the-big-dataset-of-ultra-marathon-running")
        print(f"  Place CSV in: {ULTRA_MARATHON_RAW}")
        return

    df = load_raw()
    df = clean(df)
    df = engineer_features(df)
    training = build_training_set(df)

    training.to_parquet(STM_PROCESSED, index=False)
    print(f"[STM] Saved {STM_PROCESSED} ({len(training):,} rows)")
    print(f"  Features: {list(training.columns[:-1])}")
    print(f"  Target: avg_speed_kmh")
    print(f"  Stats:\n{training.describe().round(2).to_string()}")


if __name__ == "__main__":
    main()
