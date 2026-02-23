#!/usr/bin/env python3
"""
Anomaly detection and alerting.

Checks:
  - missingness > 20% in key fields
  - sleep_hours out of [2, 14]
  - avg_accuracy outside [0, 1]
  - avg_time_per_question > 300s or <= 0
  - negative / impossible values

Output: data/reports/anomaly_report.json

Alert: Slack webhook if SLACK_WEBHOOK_URL is set, else logs warning.
"""

import json
import logging
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DAILY_JOINED, ANOMALY_REPORT, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def detect_anomalies(df):
    """Run all anomaly checks. Returns list of anomaly dicts."""
    anomalies = []

    # 1. Missingness
    for field in ["sleep_hours", "attempts_count", "avg_accuracy"]:
        if field in df.columns:
            miss_pct = df[field].isna().mean() * 100
            if miss_pct > 20:
                anomalies.append({
                    "type": "high_missingness", "field": field,
                    "missing_pct": round(miss_pct, 2), "threshold": 20,
                    "severity": "warning",
                })

    # 2. Out-of-range sleep
    if "sleep_hours" in df.columns:
        bad = df[(df["sleep_hours"].notna()) & ((df["sleep_hours"] < 2) | (df["sleep_hours"] > 14))]
        if len(bad) > 0:
            anomalies.append({
                "type": "out_of_range", "field": "sleep_hours",
                "count": len(bad), "range": [2, 14], "severity": "error",
            })

    # 3. Accuracy outside [0, 1]
    if "avg_accuracy" in df.columns:
        bad = df[(df["avg_accuracy"].notna()) & ((df["avg_accuracy"] < 0) | (df["avg_accuracy"] > 1))]
        if len(bad) > 0:
            anomalies.append({
                "type": "out_of_range", "field": "avg_accuracy",
                "count": len(bad), "range": [0, 1], "severity": "error",
            })

    # 4. Time per question
    if "avg_time_per_question" in df.columns:
        bad = df[
            (df["avg_time_per_question"].notna())
            & ((df["avg_time_per_question"] <= 0) | (df["avg_time_per_question"] > 300))
        ]
        if len(bad) > 0:
            anomalies.append({
                "type": "out_of_range", "field": "avg_time_per_question",
                "count": len(bad), "range": [0.01, 300], "severity": "warning",
            })

    # 5. Negative values
    for field in ["sleep_hours", "attempts_count", "int_score", "bmr"]:
        if field in df.columns:
            neg = df[(df[field].notna()) & (df[field] < 0)]
            if len(neg) > 0:
                anomalies.append({
                    "type": "negative_value", "field": field,
                    "count": len(neg), "severity": "error",
                })

    return anomalies


def send_alert(anomalies):
    """Send alert via Slack webhook or log warning."""
    webhook = os.environ.get("SLACK_WEBHOOK_URL")
    if webhook:
        try:
            import requests
            msg = f"⚠️ Level Up Pipeline: {len(anomalies)} anomalies detected!\n"
            for a in anomalies[:5]:
                msg += f"  • {a['type']}: {a['field']} ({a['severity']})\n"
            requests.post(webhook, json={"text": msg}, timeout=10)
            log.info("Slack alert sent")
        except Exception as e:
            log.warning("Failed to send Slack alert: %s", e)
    else:
        log.warning(
            "SLACK_WEBHOOK_URL not set. %d anomalies detected — see anomaly_report.json",
            len(anomalies),
        )


def main():
    ensure_dirs()
    df = pd.read_parquet(DAILY_JOINED)
    log.info("Loaded %d rows for anomaly detection", len(df))

    anomalies = detect_anomalies(df)

    report = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "total_rows": len(df),
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
        "status": "PASS" if len(anomalies) == 0 else "FAIL",
    }

    ANOMALY_REPORT.write_text(json.dumps(report, indent=2))
    log.info("Anomaly report → %s (%d issues)", ANOMALY_REPORT, len(anomalies))

    if anomalies:
        send_alert(anomalies)
        raise RuntimeError(
            f"Anomaly detection found {len(anomalies)} issue(s). "
            f"See {ANOMALY_REPORT} for details."
        )


if __name__ == "__main__":
    main()
