#!/usr/bin/env python3
"""
Download and clean source datasets for the STR pipeline.

1. OpenPowerlifting — bulk CSV (400MB+ zipped)
2. 721 Weight Training Workouts — Kaggle dataset

Usage:
    python download_data.py [--opl] [--workouts] [--all]
"""

import argparse
import io
import logging
import zipfile
from pathlib import Path
from urllib.request import urlopen, Request

import pandas as pd

from config import (
    ensure_dirs, OPL_CSV_URL, OPL_RAW, OPL_PROCESSED,
    WORKOUTS_RAW, WORKOUTS_PROCESSED, WORKOUTS_KAGGLE,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════
# OPENPOWERLIFTING
# ═══════════════════════════════════════════════════

def download_opl():
    """Download and extract the OpenPowerlifting dataset."""
    ensure_dirs()

    if OPL_RAW.exists():
        log.info("OPL raw CSV already exists: %s", OPL_RAW)
    else:
        log.info("Downloading OpenPowerlifting dataset from %s ...", OPL_CSV_URL)
        req = Request(OPL_CSV_URL, headers={"User-Agent": "LevelUp-ML-Pipeline/1.0"})
        resp = urlopen(req, timeout=120)
        data = resp.read()
        log.info("Downloaded %.1f MB", len(data) / 1e6)

        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            csv_files = [f for f in zf.namelist() if f.endswith(".csv") and "opl" in f.lower()]
            if not csv_files:
                # Try to find any CSV in the zip
                csv_files = [f for f in zf.namelist() if f.endswith(".csv")]
            if not csv_files:
                raise RuntimeError(f"No CSV found in zip. Contents: {zf.namelist()[:10]}")

            target = csv_files[0]
            log.info("Extracting %s ...", target)
            with zf.open(target) as src, open(OPL_RAW, "wb") as dst:
                dst.write(src.read())

    log.info("Cleaning OPL data ...")
    clean_opl()


def clean_opl():
    """Clean OpenPowerlifting data: keep raw/tested, filter to useful columns."""
    cols_to_keep = [
        "Sex", "Age", "AgeClass", "BodyweightKg", "WeightClassKg",
        "Equipment", "Best3SquatKg", "Best3BenchKg", "Best3DeadliftKg",
        "TotalKg", "Dots", "Tested", "Federation", "Date",
    ]

    log.info("Reading OPL CSV (this may take a moment) ...")
    df = pd.read_csv(OPL_RAW, usecols=lambda c: c in cols_to_keep, low_memory=False)
    log.info("Raw rows: %d", len(df))

    # Filter: keep only Raw (no equipment aid), with valid bodyweight + at least one lift
    df = df[df["Equipment"].isin(["Raw", "Wraps"])]
    df = df[df["BodyweightKg"].notna() & (df["BodyweightKg"] > 30)]

    lift_cols = ["Best3SquatKg", "Best3BenchKg", "Best3DeadliftKg"]
    df = df.dropna(subset=lift_cols, how="all")

    # Remove failed lifts (negative values)
    for col in lift_cols:
        df[col] = df[col].clip(lower=0)

    # Convert bodyweight to lbs for easier app integration
    df["BodyweightLbs"] = (df["BodyweightKg"] * 2.20462).round(1)
    for col in lift_cols:
        lbs_col = col.replace("Kg", "Lbs")
        df[lbs_col] = (df[col] * 2.20462).round(1)

    log.info("Cleaned rows: %d", len(df))
    df.to_parquet(OPL_PROCESSED, index=False)
    log.info("Saved: %s", OPL_PROCESSED)


# ═══════════════════════════════════════════════════
# 721 WEIGHT TRAINING WORKOUTS
# ═══════════════════════════════════════════════════

def download_workouts():
    """Download the 721 Weight Training Workouts dataset from Kaggle."""
    ensure_dirs()

    if WORKOUTS_RAW.exists():
        log.info("Workouts CSV already exists: %s", WORKOUTS_RAW)
    else:
        try:
            import kaggle
            log.info("Downloading %s from Kaggle ...", WORKOUTS_KAGGLE)
            kaggle.api.dataset_download_files(
                WORKOUTS_KAGGLE,
                path=str(WORKOUTS_RAW.parent),
                unzip=True,
            )
        except ImportError:
            log.error(
                "kaggle package not installed. Install it with: pip install kaggle\n"
                "Also set up ~/.kaggle/kaggle.json with your API credentials.\n"
                "Or manually download from: https://www.kaggle.com/datasets/%s",
                WORKOUTS_KAGGLE,
            )
            return
        except Exception as e:
            log.error("Kaggle download failed: %s", e)
            log.info("Manually download from: https://www.kaggle.com/datasets/%s", WORKOUTS_KAGGLE)
            return

        # Find the CSV in the extracted files
        csv_files = list(WORKOUTS_RAW.parent.glob("*.csv"))
        if csv_files:
            csv_files[0].rename(WORKOUTS_RAW)

    if WORKOUTS_RAW.exists():
        log.info("Cleaning workouts data ...")
        clean_workouts()


def clean_workouts():
    """Clean the workout tracking data."""
    df = pd.read_csv(WORKOUTS_RAW)
    log.info("Raw workout rows: %d", len(df))

    # Standardize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Parse dates
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"])

    # Compute 1RM using Epley formula: 1RM = weight * (1 + reps/30)
    if "weight_(lbs)" in df.columns and "reps" in df.columns:
        df.rename(columns={"weight_(lbs)": "weight_lbs"}, inplace=True)
    if "weight_lbs" in df.columns and "reps" in df.columns:
        df["estimated_1rm"] = (df["weight_lbs"] * (1 + df["reps"] / 30)).round(1)

    log.info("Cleaned workout rows: %d", len(df))
    df.to_parquet(WORKOUTS_PROCESSED, index=False)
    log.info("Saved: %s", WORKOUTS_PROCESSED)


# ═══════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Download STR pipeline datasets")
    parser.add_argument("--opl", action="store_true", help="Download OpenPowerlifting")
    parser.add_argument("--workouts", action="store_true", help="Download 721 Workouts")
    parser.add_argument("--all", action="store_true", help="Download all datasets")
    args = parser.parse_args()

    if args.all or args.opl:
        download_opl()
    if args.all or args.workouts:
        download_workouts()
    if not (args.all or args.opl or args.workouts):
        parser.print_help()


if __name__ == "__main__":
    main()
