"""
Configuration for the Strength Training ML Pipeline.

Data sources:
  1. OpenPowerlifting — strength percentiles by sex, bodyweight, equipment
  2. 721 Weight Training Workouts — progression prediction model

Outputs:
  - strength_standards.json — percentile lookup table for bench/squat/deadlift
  - str_progression_model.json — predicts next-session 1RM from training history
"""

from pathlib import Path

# ── Directories ──
STR_DIR = Path(__file__).resolve().parent
ML_DIR = STR_DIR.parent
REPO_ROOT = ML_DIR.parent
DATA_DIR = STR_DIR / "data"
MODELS_DIR = STR_DIR / "models"
REPORTS_DIR = STR_DIR / "reports"

# ── Data sources ──
OPL_CSV_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip"
OPL_RAW = DATA_DIR / "raw" / "openpowerlifting.csv"
OPL_PROCESSED = DATA_DIR / "processed" / "opl_cleaned.parquet"

WORKOUTS_KAGGLE = "joep89/weightlifting"  # kaggle dataset slug
WORKOUTS_RAW = DATA_DIR / "raw" / "weightlifting.csv"
WORKOUTS_PROCESSED = DATA_DIR / "processed" / "workouts_cleaned.parquet"

# ── Outputs ──
STRENGTH_STANDARDS_JSON = MODELS_DIR / "strength_standards.json"
PROGRESSION_MODEL_JSON = MODELS_DIR / "str_progression_model.json"
PROGRESSION_MODEL_JOBLIB = MODELS_DIR / "str_progression_model.joblib"

# ── App bundle paths ──
APP_STR_STANDARDS = REPO_ROOT / "LevelUp" / "src" / "ml" / "strength_standards.json"

# ── Percentile thresholds (maps to classification labels) ──
PERCENTILE_TIERS = {
    "beginner":     (0, 20),
    "novice":       (20, 40),
    "intermediate": (40, 60),
    "advanced":     (60, 80),
    "elite":        (80, 95),
    "world_class":  (95, 100),
}

# ── Core lifts to compute standards for ──
CORE_LIFTS = ["Bench Press", "Squat", "Deadlift"]

# ── Bodyweight buckets for percentile lookup ──
BW_BUCKETS_LBS = [
    (100, 120), (120, 140), (140, 160), (160, 180),
    (180, 200), (200, 220), (220, 250), (250, 300),
]

BW_BUCKETS_KG = [(round(lo * 0.4536), round(hi * 0.4536)) for lo, hi in BW_BUCKETS_LBS]


def ensure_dirs():
    """Create all output directories."""
    for d in [DATA_DIR / "raw", DATA_DIR / "processed", MODELS_DIR, REPORTS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
