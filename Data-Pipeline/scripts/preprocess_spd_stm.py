"""
preprocess_spd_stm.py

Builds training data for SPD (speed) and STM (stamina) models
from the running/calories dataset + lifestyle HIIT/Cardio subsets.

SPD target: Running Speed (km/h) — how fast can this person run
STM target: Calories Burned — endurance output for a session

Sources:
  - calories_burned_data.csv (200 rows, running metrics)
  - lifestyle_spd.parquet (4,974 rows, HIIT workouts from lifestyle dataset)
  - lifestyle_stm.parquet (4,923 rows, Cardio workouts from lifestyle dataset)
"""

import pandas as pd
import numpy as np
from pathlib import Path
from config import ensure_dirs

REPO = Path(__file__).resolve().parent.parent
RAW_SPD = REPO / "data" / "raw" / "spd"
RAW_STM = REPO / "data" / "raw" / "stm"
PROCESSED = REPO / "data" / "processed"
LIFESTYLE_SPD = PROCESSED / "lifestyle_spd.parquet"
LIFESTYLE_STM = PROCESSED / "lifestyle_stm.parquet"


def load_running_data():
    """Load the running/calories CSV and normalize columns."""
    # Check both directories (same file)
    for d in [RAW_STM, RAW_SPD]:
        path = d / "calories_burned_data.csv"
        if path.exists():
            df = pd.read_csv(path)
            print(f"[RUNNING] Loaded {len(df)} rows from {path.name}")
            break
    else:
        print("[RUNNING] No calories_burned_data.csv found")
        return None

    # Normalize to common schema
    out = pd.DataFrame()
    out["age"] = df["Age"]
    out["sex_numeric"] = df["Gender"].map({"Male": 1, "Female": 0}).fillna(0).astype(int)
    out["weight_kg"] = df["Weight(kg)"]
    out["height_m"] = df["Height(cm)"] / 100
    out["bmi"] = df["BMI"]
    out["session_minutes"] = df["Running Time(min)"]
    out["session_hours"] = (df["Running Time(min)"] / 60).round(3)
    out["running_speed_kmh"] = df["Running Speed(km/h)"]
    out["distance_km"] = df["Distance(km)"]
    out["avg_bpm"] = df["Average Heart Rate"]
    out["calories_burned"] = df["Calories Burned"]

    # Derived features
    out["cal_per_min"] = (out["calories_burned"] / out["session_minutes"].clip(lower=1)).round(2)
    out["pace_min_per_km"] = (out["session_minutes"] / out["distance_km"].clip(lower=0.1)).round(2)

    # Estimate HR features (no max/resting in this dataset)
    out["max_bpm"] = (220 - out["age"]).astype(int)
    out["resting_bpm"] = 65  # assume average
    out["hr_reserve"] = out["max_bpm"] - out["resting_bpm"]
    out["pct_hrr"] = ((out["avg_bpm"] - out["resting_bpm"]) / out["hr_reserve"].clip(lower=1)).round(4)
    out["pct_max_hr"] = (out["avg_bpm"] / out["max_bpm"].clip(lower=1)).round(4)

    out["source"] = "running"
    return out


def load_lifestyle_subset(path, source_name):
    """Load lifestyle subset and align columns."""
    if not path.exists():
        print(f"[{source_name}] Not found: {path}")
        return None

    df = pd.read_parquet(path)
    print(f"[{source_name}] Loaded {len(df)} rows from lifestyle")

    out = pd.DataFrame()
    out["age"] = df["age"]
    out["sex_numeric"] = df["sex_numeric"]
    out["weight_kg"] = df["weight_kg"]
    out["height_m"] = df["height_m"]
    out["bmi"] = df["bmi"]
    out["session_minutes"] = df["session_minutes"]
    out["session_hours"] = df["session_hours"]
    out["avg_bpm"] = df["avg_bpm"]
    out["max_bpm"] = df["max_bpm"]
    out["resting_bpm"] = df["resting_bpm"]
    out["hr_reserve"] = df["hr_reserve"]
    out["pct_hrr"] = df["pct_hrr"]
    out["pct_max_hr"] = df["pct_max_hr"]
    out["calories_burned"] = df["calories_burned"]
    out["cal_per_min"] = df["cal_per_min"]

    # Lifestyle doesn't have speed/distance, estimate from calories + duration
    # avg cal/min for running ≈ 10-15 cal/min → speed ≈ 8-12 km/h
    out["running_speed_kmh"] = (out["cal_per_min"] * 0.85 + 3.5).round(1)  # rough estimate
    out["distance_km"] = (out["running_speed_kmh"] * out["session_hours"]).round(2)
    out["pace_min_per_km"] = (out["session_minutes"] / out["distance_km"].clip(lower=0.1)).round(2)

    out["source"] = source_name
    return out


def build_spd_training(running_df, lifestyle_df):
    """Build SPD training set — predict running speed."""
    frames = [f for f in [running_df, lifestyle_df] if f is not None]
    if not frames:
        return None

    df = pd.concat(frames, ignore_index=True)

    features = [
        "age", "sex_numeric", "weight_kg", "height_m", "bmi",
        "session_minutes", "distance_km",
        "avg_bpm", "max_bpm", "resting_bpm", "hr_reserve",
        "pct_hrr", "pct_max_hr",
        "calories_burned", "cal_per_min",
    ]
    target = "running_speed_kmh"

    available = [f for f in features if f in df.columns]
    out = df[available + [target, "source"]].dropna(subset=[target])

    # Filter reasonable speed range
    out = out[(out[target] >= 3) & (out[target] <= 25)]

    print(f"[SPD] Training set: {len(out)} rows, target range: {out[target].min():.1f} - {out[target].max():.1f} km/h")
    return out


def build_stm_training(running_df, lifestyle_df):
    """Build STM training set — predict calories burned (endurance)."""
    frames = [f for f in [running_df, lifestyle_df] if f is not None]
    if not frames:
        return None

    df = pd.concat(frames, ignore_index=True)

    features = [
        "age", "sex_numeric", "weight_kg", "height_m", "bmi",
        "session_minutes", "running_speed_kmh", "distance_km",
        "avg_bpm", "max_bpm", "resting_bpm", "hr_reserve",
        "pct_hrr", "pct_max_hr",
        "cal_per_min",
    ]
    target = "calories_burned"

    available = [f for f in features if f in df.columns]
    out = df[available + [target, "source"]].dropna(subset=[target])

    # Filter reasonable calorie range
    out = out[(out[target] >= 50) & (out[target] <= 3500)]

    print(f"[STM] Training set: {len(out)} rows, target range: {out[target].min():.0f} - {out[target].max():.0f} cal")
    return out


def main():
    ensure_dirs()
    PROCESSED.mkdir(parents=True, exist_ok=True)

    # Load sources
    running = load_running_data()
    lifestyle_spd = load_lifestyle_subset(LIFESTYLE_SPD, "HIIT")
    lifestyle_stm = load_lifestyle_subset(LIFESTYLE_STM, "Cardio")

    # Build SPD training (running data + HIIT lifestyle)
    spd = build_spd_training(running, lifestyle_spd)
    if spd is not None:
        path = PROCESSED / "spd_training_v2.parquet"
        spd.to_parquet(path, index=False)
        print(f"  Saved → {path} ({len(spd)} rows)")
        print(f"  Sources: {spd['source'].value_counts().to_dict()}")

    # Build STM training (running data + Cardio lifestyle)
    stm = build_stm_training(running, lifestyle_stm)
    if stm is not None:
        path = PROCESSED / "stm_training_v2.parquet"
        stm.to_parquet(path, index=False)
        print(f"  Saved → {path} ({len(stm)} rows)")
        print(f"  Sources: {stm['source'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
