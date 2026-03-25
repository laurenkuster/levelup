"""
Centralized configuration for the Level Up ML Pipeline.

All scripts import paths and constants from here.
"""

import os
from pathlib import Path

# ── Root directories ──
ML_DIR = Path(__file__).resolve().parent
REPO_ROOT = ML_DIR.parent
DATA_PIPELINE_DIR = REPO_ROOT / "Data-Pipeline"

# ── Input data (from Data-Pipeline) ──
DAILY_JOINED = DATA_PIPELINE_DIR / "data" / "processed" / "daily_joined.parquet"

# ── ML Pipeline outputs ──
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"
PLOTS_DIR = ML_DIR / "plots"

# ── Model files ──
BEST_MODEL_PATH = MODELS_DIR / "best_model.joblib"
MODEL_WEIGHTS_JSON = MODELS_DIR / "model_weights.json"
VALIDATION_REPORT = REPORTS_DIR / "validation_report.json"
BIAS_DETECTION_REPORT = REPORTS_DIR / "bias_detection_report.json"
SHAP_REPORT = REPORTS_DIR / "shap_feature_importance.json"

# ── App model paths (where exported model goes) ──
APP_SERVER_WEIGHTS = REPO_ROOT / "LevelUp" / "server" / "analytics" / "model_weights.json"
APP_CLIENT_WEIGHTS = REPO_ROOT / "LevelUp" / "src" / "ml" / "model_weights.json"

# ── MLflow ──
MLFLOW_TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", "file:///" + str(ML_DIR / "mlruns"))
MLFLOW_EXPERIMENT_NAME = "levelup-energy-prediction"

# ── Validation thresholds ──
MAX_ACCEPTABLE_MAE = 5.0
MIN_ACCEPTABLE_R2 = 0.7

# ── Feature configuration ──
FEATURE_COLUMNS = [
    "age", "sex_numeric", "bmi_numeric", "sleep_hours",
    "sleep_satisfaction", "rolling_sleep_hours_7d",
    "bedtime_variability_7d", "avg_accuracy",
    "int_score", "rolling_int_7d", "bmr",
    "attempts_count",
    # Food / nutrition features
    "daily_calories", "protein_per_kg", "pct_carbs",
    "water_intake_l", "cal_balance",
]
TARGET_COLUMN = "energy_score"

# ── Age buckets for bias slicing ──
AGE_BINS = [(0, 19, "<20"), (20, 29, "20-29"), (30, 39, "30-39"), (40, 200, "40+")]


def ensure_dirs():
    """Create all output directories."""
    for d in [MODELS_DIR, REPORTS_DIR, PLOTS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
