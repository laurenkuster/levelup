#!/usr/bin/env python3
"""
Bias slicing report.

Slices data by sex and age buckets, computes per-slice metrics,
and flags data imbalance.

Output: data/reports/bias_report.json
"""

import json
import logging
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DAILY_JOINED, BIAS_REPORT, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

AGE_BINS = [(0, 19, "<20"), (20, 29, "20-29"), (30, 39, "30-39"), (40, 200, "40+")]
IMBALANCE_THRESHOLD = 10


def assign_age_bucket(age):
    """Map age → bucket label."""
    try:
        age = int(age)
        for lo, hi, label in AGE_BINS:
            if lo <= age <= hi:
                return label
    except (ValueError, TypeError):
        pass
    return "unknown"


def compute_slice_metrics(df, slice_col, slice_name):
    """Compute per-slice metrics."""
    slices = []
    for val, group in df.groupby(slice_col):
        n = len(group)
        slices.append({
            "slice_by": slice_name,
            "value": str(val),
            "count": n,
            "mean_int_score": round(group["int_score"].mean(), 2) if "int_score" in group else None,
            "mean_avg_accuracy": round(group["avg_accuracy"].mean(), 4) if "avg_accuracy" in group else None,
            "mean_sleep_hours": round(group["sleep_hours"].mean(), 2) if "sleep_hours" in group else None,
            "flagged_imbalance": n < IMBALANCE_THRESHOLD,
        })
    return slices


def main():
    ensure_dirs()
    df = pd.read_parquet(DAILY_JOINED)
    log.info("Loaded %d rows for bias analysis", len(df))

    df["age_bucket"] = df.get("age", pd.Series(dtype=float)).apply(assign_age_bucket)

    report = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "total_rows": len(df),
        "slices": {},
    }

    if "sex" in df.columns:
        report["slices"]["sex"] = compute_slice_metrics(df, "sex", "sex")

    report["slices"]["age_bucket"] = compute_slice_metrics(df, "age_bucket", "age_bucket")

    imbalanced = []
    for category, slices in report["slices"].items():
        for s in slices:
            if s.get("flagged_imbalance"):
                imbalanced.append(f"{category}={s['value']} (n={s['count']})")

    report["imbalanced_slices"] = imbalanced
    report["mitigation_notes"] = (
        "If slices are imbalanced, consider: "
        "1) collecting more data from underrepresented groups, "
        "2) applying sample weighting during model training, "
        "3) using stratified train/test splits, "
        "4) monitoring per-slice model performance separately."
    )

    BIAS_REPORT.write_text(json.dumps(report, indent=2))
    log.info("Bias report → %s (%d slices)", BIAS_REPORT, sum(len(v) for v in report["slices"].values()))

    if imbalanced:
        log.warning("Data imbalance detected: %s", ", ".join(imbalanced))


if __name__ == "__main__":
    main()
