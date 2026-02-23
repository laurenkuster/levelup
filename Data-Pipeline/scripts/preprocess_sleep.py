#!/usr/bin/env python3
"""
Sleep log preprocessing.

Input:  data/raw/sleep_logs_raw.json
Output: data/processed/sleep_daily.parquet
"""

import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import SLEEP_RAW, SLEEP_DAILY, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def parse_time_to_minutes(time_str):
    """Convert 'HH:MM' to minutes since midnight."""
    try:
        parts = str(time_str).split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError, TypeError):
        return np.nan


def preprocess_sleep(df):
    """
    Clean and feature-engineer the sleep DataFrame.

    Steps:
      1. Clamp sleep_hours to [2, 14], NaN others
      2. Parse bed/wake times to minutes
      3. Compute midpoint (handles midnight wrap)
      4. Map quality → satisfaction (1–5 → 0.0–1.0)
      5. Rolling averages (3d, 7d)
      6. Bedtime variability (7d rolling std)
    """
    df = df.copy()

    # 1. Clamp / clean
    df["sleep_hours"] = pd.to_numeric(df.get("sleepHours"), errors="coerce")
    df.loc[(df["sleep_hours"] < 2) | (df["sleep_hours"] > 14), "sleep_hours"] = np.nan

    # 2. Parse times
    df["sleep_start_minutes"] = df.get("bedTime", pd.Series(dtype=str)).apply(parse_time_to_minutes)
    df["sleep_end_minutes"] = df.get("wakeTime", pd.Series(dtype=str)).apply(parse_time_to_minutes)

    # 3. Midpoint
    df["sleep_midpoint"] = (df["sleep_start_minutes"] + df["sleep_end_minutes"]) / 2
    mask = df["sleep_start_minutes"] > df["sleep_end_minutes"]
    df.loc[mask, "sleep_midpoint"] = (
        (df.loc[mask, "sleep_start_minutes"] + df.loc[mask, "sleep_end_minutes"] + 1440) / 2
    ) % 1440

    # 4. Satisfaction
    quality = pd.to_numeric(df.get("quality"), errors="coerce")
    df["sleep_satisfaction"] = (quality - 1) / 4

    # 5. Sort + deduplicate
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values(["user_id", "date"])
    df = df.drop_duplicates(subset=["user_id", "date"], keep="first")

    # 6. Rolling features (per user)
    parts = []
    for uid, group in df.groupby("user_id"):
        group = group.set_index("date").sort_index()
        group["rolling_sleep_hours_3d"] = (
            group["sleep_hours"].rolling("3D", min_periods=1).mean().round(2)
        )
        group["rolling_sleep_hours_7d"] = (
            group["sleep_hours"].rolling("7D", min_periods=1).mean().round(2)
        )
        group["bedtime_variability_7d"] = (
            group["sleep_start_minutes"].rolling("7D", min_periods=2).std().round(2)
        )
        parts.append(group.reset_index())
    df = pd.concat(parts, ignore_index=True)

    cols = [
        "user_id", "date", "sleep_hours", "sleep_start_minutes",
        "sleep_end_minutes", "sleep_midpoint", "sleep_satisfaction",
        "rolling_sleep_hours_3d", "rolling_sleep_hours_7d",
        "bedtime_variability_7d",
    ]
    return df[cols].reset_index(drop=True)


def main():
    ensure_dirs()
    raw = json.loads(SLEEP_RAW.read_text())
    log.info("Loaded %d raw sleep records", len(raw))

    result = preprocess_sleep(pd.DataFrame(raw))
    result.to_parquet(SLEEP_DAILY, index=False)
    log.info("Wrote %d rows → %s", len(result), SLEEP_DAILY)


if __name__ == "__main__":
    main()
