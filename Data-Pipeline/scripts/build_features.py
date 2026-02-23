#!/usr/bin/env python3
"""
Feature building — join sleep + quiz + profile data.

Inputs:
  - data/processed/sleep_daily.parquet
  - data/processed/int_daily.parquet
  - data/raw/profiles_raw.json

Output:
  - data/processed/daily_joined.parquet

Adds BMR (Mifflin–St Jeor) from profile data.
"""

import json
import logging
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import SLEEP_DAILY, INT_DAILY, PROFILES_RAW, DAILY_JOINED, ensure_dirs

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

    joined.to_parquet(DAILY_JOINED, index=False)
    log.info("Wrote %d rows → %s", len(joined), DAILY_JOINED)


if __name__ == "__main__":
    main()
