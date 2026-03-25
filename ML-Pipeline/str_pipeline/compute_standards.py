#!/usr/bin/env python3
"""
Compute strength standards from OpenPowerlifting data.

Reads cleaned OPL parquet and computes percentile-based 1RM thresholds
for each core lift, grouped by sex and bodyweight bucket.

Output: strength_standards.json — bundled into the app for real-time
lift classification (e.g., "your bench 1RM of 185 at 170lbs = Intermediate").

Schema:
{
  "metadata": { "source": "OpenPowerlifting", "lifters": N, "updated": "..." },
  "lifts": {
    "bench_press": {
      "M": {
        "140-160": { "p20": 135, "p40": 185, "p60": 225, "p80": 275, "p95": 335 },
        ...
      },
      "F": { ... }
    },
    "squat": { ... },
    "deadlift": { ... }
  }
}
"""

import json
import logging
from datetime import datetime

import numpy as np
import pandas as pd

from config import (
    ensure_dirs, OPL_PROCESSED, STRENGTH_STANDARDS_JSON,
    APP_STR_STANDARDS, CORE_LIFTS, BW_BUCKETS_LBS, PERCENTILE_TIERS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

LIFT_COL_MAP = {
    "Bench Press": "Best3BenchLbs",
    "Squat": "Best3SquatLbs",
    "Deadlift": "Best3DeadliftLbs",
}

LIFT_KEY_MAP = {
    "Bench Press": "bench_press",
    "Squat": "squat",
    "Deadlift": "deadlift",
}


def compute_percentiles(series):
    """Compute key percentiles from a pandas Series."""
    if len(series) < 10:
        return None
    return {
        "p20": round(float(np.percentile(series, 20))),
        "p40": round(float(np.percentile(series, 40))),
        "p60": round(float(np.percentile(series, 60))),
        "p80": round(float(np.percentile(series, 80))),
        "p95": round(float(np.percentile(series, 95))),
        "median": round(float(np.median(series))),
        "count": int(len(series)),
    }


def main():
    ensure_dirs()

    if not OPL_PROCESSED.exists():
        log.error("OPL data not found at %s. Run download_data.py --opl first.", OPL_PROCESSED)
        return

    log.info("Loading OPL data ...")
    df = pd.read_parquet(OPL_PROCESSED)
    log.info("Loaded %d rows", len(df))

    standards = {"metadata": {}, "lifts": {}}

    for lift_name, col in LIFT_COL_MAP.items():
        lift_key = LIFT_KEY_MAP[lift_name]
        log.info("Computing standards for: %s (%s)", lift_name, col)

        # Filter to rows with valid data for this lift
        lift_df = df[df[col].notna() & (df[col] > 0)].copy()
        log.info("  Valid rows: %d", len(lift_df))

        standards["lifts"][lift_key] = {}

        for sex in ["M", "F"]:
            sex_df = lift_df[lift_df["Sex"] == sex]
            if len(sex_df) < 50:
                continue

            standards["lifts"][lift_key][sex] = {}

            for bw_lo, bw_hi in BW_BUCKETS_LBS:
                bucket_df = sex_df[
                    (sex_df["BodyweightLbs"] >= bw_lo) &
                    (sex_df["BodyweightLbs"] < bw_hi)
                ]

                pcts = compute_percentiles(bucket_df[col])
                if pcts:
                    bucket_label = f"{bw_lo}-{bw_hi}"
                    standards["lifts"][lift_key][sex][bucket_label] = pcts
                    log.info("  %s %s: n=%d, median=%d lbs", sex, bucket_label, pcts["count"], pcts["median"])

    # Add metadata
    total_lifters = len(df)
    standards["metadata"] = {
        "source": "OpenPowerlifting (openpowerlifting.org)",
        "license": "Public Domain",
        "total_lifters": total_lifters,
        "equipment_filter": "Raw + Wraps only",
        "updated": datetime.now().isoformat()[:10],
        "tiers": PERCENTILE_TIERS,
        "bodyweight_unit": "lbs",
        "lift_unit": "lbs",
    }

    # Save
    STRENGTH_STANDARDS_JSON.write_text(json.dumps(standards, indent=2))
    log.info("Saved standards: %s", STRENGTH_STANDARDS_JSON)

    # Copy to app bundle
    if APP_STR_STANDARDS.parent.exists():
        APP_STR_STANDARDS.write_text(json.dumps(standards))
        log.info("Copied to app: %s", APP_STR_STANDARDS)
    else:
        log.warning("App path not found: %s", APP_STR_STANDARDS.parent)

    log.info("Done! Standards cover %d lifters across %d lifts.",
             total_lifters, len(standards["lifts"]))


if __name__ == "__main__":
    main()
