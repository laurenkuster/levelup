"""
preprocess_spd.py

Cleans World Athletics data for SPD model training.

Source: https://github.com/thomascamminady/world-athletics-database (MIT)

Target: Predict sprint performance (speed in m/s) based on demographics,
        event type, and athlete features.

Pipeline:
  1. Load raw CSV (~461K rows, semicolon-delimited)
  2. Filter to sprint events (100m, 200m, 400m)
  3. Parse times, compute speed
  4. Engineer features (age at competition, wind adjustment)
  5. Save cleaned parquet
"""

import pandas as pd
import numpy as np
from config import WORLD_ATHLETICS_RAW, SPD_PROCESSED, ensure_dirs

SPRINT_EVENTS = ["100 Metres", "200 Metres", "400 Metres"]


def load_raw():
    print(f"[SPD] Loading {WORLD_ATHLETICS_RAW} ...")
    df = pd.read_csv(WORLD_ATHLETICS_RAW, sep=";", low_memory=False)
    print(f"  Raw rows: {len(df):,}")
    print(f"  Columns: {list(df.columns)}")
    return df


def clean(df):
    # Filter to sprint events
    df = df[df["Event"].isin(SPRINT_EVENTS)].copy()
    print(f"  Sprint events only: {len(df):,}")

    # Parse dates
    df["DOB"] = pd.to_datetime(df["DOB"], errors="coerce")
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["DOB", "Date"])

    # Age at competition
    df["age"] = ((df["Date"] - df["DOB"]).dt.days / 365.25).round(1)
    df = df[(df["age"] >= 14) & (df["age"] <= 60)]

    # Sex → numeric
    df["sex_numeric"] = (df["Sex"] == "male").astype(int)

    # Parse time in seconds from Mark column
    # Mark format: "9.58" or "19.19" etc.
    df["time_s"] = pd.to_numeric(df["Mark [meters or seconds]"], errors="coerce")
    df = df[df["time_s"] > 0]

    # Event distance in meters
    df["distance_m"] = df["Event"].map({
        "100 Metres": 100,
        "200 Metres": 200,
        "400 Metres": 400,
    })

    # Speed in m/s
    df["speed_ms"] = (df["distance_m"] / df["time_s"]).round(3)
    df = df[(df["speed_ms"] > 3) & (df["speed_ms"] < 15)]  # sanity filter

    # Wind (100m/200m only) — numeric
    df["wind"] = pd.to_numeric(df["Wind"], errors="coerce").fillna(0)

    # Wind-adjusted speed (simple: +0.05 m/s per +1 m/s tailwind for 100m)
    df["wind_adj"] = 0.0
    mask_100 = df["distance_m"] == 100
    df.loc[mask_100, "wind_adj"] = df.loc[mask_100, "wind"] * 0.05
    mask_200 = df["distance_m"] == 200
    df.loc[mask_200, "wind_adj"] = df.loc[mask_200, "wind"] * 0.03
    df["speed_adj"] = (df["speed_ms"] - df["wind_adj"]).round(3)

    # Rank as performance percentile within event+sex
    df["rank_in_event"] = df.groupby(["Event", "Sex"])["speed_adj"].rank(
        pct=True, ascending=True
    ).round(4)

    print(f"  After cleaning: {len(df):,}")
    return df


def engineer_features(df):
    """Athlete-level features for progression modeling."""
    df = df.sort_values(["Competitor", "Date"])

    g = df.groupby("Competitor")

    # Career stats
    df["comp_num"] = g.cumcount() + 1
    df["career_comps"] = g["comp_num"].transform("max")

    # Previous performance
    df["speed_prev"] = g["speed_adj"].shift(1)
    df["time_prev"] = g["time_s"].shift(1)
    df["days_since_last"] = g["Date"].diff().dt.days

    # Progression
    df["speed_change"] = (df["speed_adj"] - df["speed_prev"]).round(4)
    df["speed_change_pct"] = (df["speed_change"] / df["speed_prev"] * 100).round(2)

    # Rolling average speed (last 3 competitions)
    df["speed_rolling_3"] = g["speed_adj"].transform(
        lambda x: x.rolling(3, min_periods=1).mean()
    ).round(3)

    # Peak speed achieved so far
    df["peak_speed"] = g["speed_adj"].transform("cummax")

    # Event numeric encoding
    df["event_numeric"] = df["distance_m"].map({100: 0, 200: 1, 400: 2})

    print(f"  After feature engineering: {len(df):,}")
    return df


def build_training_set(df):
    """Select features + target for ML."""
    # Keep athletes with progression data
    prog = df[df["comp_num"] >= 2].copy()
    print(f"  Rows with progression: {len(prog):,}")

    features = [
        "age", "sex_numeric", "event_numeric", "distance_m",
        "comp_num", "career_comps", "days_since_last",
        "speed_prev", "speed_rolling_3", "peak_speed",
        "wind",
    ]
    target = "speed_adj"

    out = prog[features + [target]].dropna()
    print(f"  Final training rows: {len(out):,}")
    return out


def main():
    ensure_dirs()
    df = load_raw()
    df = clean(df)
    df = engineer_features(df)
    training = build_training_set(df)

    training.to_parquet(SPD_PROCESSED, index=False)
    print(f"[SPD] Saved {SPD_PROCESSED} ({len(training):,} rows)")
    print(f"  Features: {list(training.columns[:-1])}")
    print(f"  Target: speed_adj (wind-adjusted m/s)")
    print(f"  Stats:\n{training.describe().round(2).to_string()}")


if __name__ == "__main__":
    main()
