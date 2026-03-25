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

# ── Raw input files (original pipeline) ──
PROFILES_RAW = RAW_DIR / "profiles_raw.json"
SLEEP_RAW = RAW_DIR / "sleep_logs_raw.json"
QUIZ_RAW = RAW_DIR / "quiz_attempts_raw.json"

# ── Raw stat datasets ──
STR_RAW_DIR = RAW_DIR / "str"
SPD_RAW_DIR = RAW_DIR / "spd"
STM_RAW_DIR = RAW_DIR / "stm"
DEX_RAW_DIR = RAW_DIR / "dex"
LIFESTYLE_RAW = RAW_DIR / "lifestyle"

OPL_RAW = STR_RAW_DIR / "openpowerlifting.csv"
WORLD_ATHLETICS_RAW = SPD_RAW_DIR / "world_athletics.csv"
ULTRA_MARATHON_RAW = STM_RAW_DIR / "TWO_CENTURIES_OF_UM_RACES.csv"
BODY_PERFORMANCE_RAW = DEX_RAW_DIR / "body_performance.csv"

# ── Processed outputs (original) ──
SLEEP_DAILY = PROCESSED_DIR / "sleep_daily.parquet"
INT_DAILY = PROCESSED_DIR / "int_daily.parquet"
DAILY_JOINED = PROCESSED_DIR / "daily_joined.parquet"

# ── Processed stat datasets ──
STR_PROCESSED = PROCESSED_DIR / "str_training.parquet"
SPD_PROCESSED = PROCESSED_DIR / "spd_training.parquet"
STM_PROCESSED = PROCESSED_DIR / "stm_training.parquet"
DEX_PROCESSED = PROCESSED_DIR / "dex_training.parquet"
LIFESTYLE_PROCESSED = PROCESSED_DIR / "lifestyle_training.parquet"

# ── Reports ──
SCHEMA_REPORT = REPORTS_DIR / "schema.json"
STATS_REPORT = REPORTS_DIR / "stats.json"
ANOMALY_REPORT = REPORTS_DIR / "anomaly_report.json"
BIAS_REPORT = REPORTS_DIR / "bias_report.json"


def ensure_dirs():
    """Create all output directories if they don't exist."""
    for d in [RAW_DIR, PROCESSED_DIR, REPORTS_DIR, LOGS_DIR,
              STR_RAW_DIR, SPD_RAW_DIR, STM_RAW_DIR, DEX_RAW_DIR,
              LIFESTYLE_RAW]:
        d.mkdir(parents=True, exist_ok=True)
