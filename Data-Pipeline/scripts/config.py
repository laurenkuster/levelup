"""
Centralized path configuration for the Level Up data pipeline.

All scripts import paths from here to ensure consistency.
Uses pathlib for cross-platform safety. All paths are relative
to the Data-Pipeline/ root.
"""

from pathlib import Path

# ── Root of Data-Pipeline/ ──
BASE_DIR = Path(__file__).resolve().parents[1]

# ── Data directories ──
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
REPORTS_DIR = BASE_DIR / "data" / "reports"
LOGS_DIR = BASE_DIR / "logs"

# ── Raw input files ──
PROFILES_RAW = RAW_DIR / "profiles_raw.json"
SLEEP_RAW = RAW_DIR / "sleep_logs_raw.json"
QUIZ_RAW = RAW_DIR / "quiz_attempts_raw.json"

# ── Processed outputs ──
SLEEP_DAILY = PROCESSED_DIR / "sleep_daily.parquet"
INT_DAILY = PROCESSED_DIR / "int_daily.parquet"
DAILY_JOINED = PROCESSED_DIR / "daily_joined.parquet"

# ── Reports ──
SCHEMA_REPORT = REPORTS_DIR / "schema.json"
STATS_REPORT = REPORTS_DIR / "stats.json"
ANOMALY_REPORT = REPORTS_DIR / "anomaly_report.json"
BIAS_REPORT = REPORTS_DIR / "bias_report.json"


def ensure_dirs():
    """Create all output directories if they don't exist."""
    for d in [RAW_DIR, PROCESSED_DIR, REPORTS_DIR, LOGS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
