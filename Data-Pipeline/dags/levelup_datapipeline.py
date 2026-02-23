"""
Level Up Data Pipeline — Airflow DAG.

10-task pipeline:
  1. ingest_raw_data        — validate OR generate synthetic data
  2. validate_schema        — enforce required fields + types
  3. preprocess_sleep       — sleep log → sleep_daily.parquet
  4. preprocess_quiz        — quiz attempts → int_daily.parquet
  5. build_features         — join + BMR → daily_joined.parquet
  6. generate_stats         — schema.json + stats.json
  7. anomaly_detection      — anomaly_report.json + alerting
  8. bias_slicing_report    — bias_report.json
  9. log_completion         — final log entry

Schedule: daily at 02:00 UTC.
"""

from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import sys

from airflow import DAG
from airflow.operators.python import PythonOperator

# Resolve scripts directory relative to this DAG file
SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"


def _run(script_name):
    """Run a pipeline script as a subprocess."""
    path = SCRIPTS_DIR / script_name
    result = subprocess.run(
        [sys.executable, str(path)],
        capture_output=True, text=True,
        cwd=str(SCRIPTS_DIR.parent),
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"Script {script_name} failed (exit {result.returncode})")


# ── Task callables ──

def ingest_raw_data(**kwargs):
    """Check if raw data exists; generate synthetic if missing."""
    raw_dir = SCRIPTS_DIR.parent / "data" / "raw"
    required = ["profiles_raw.json", "sleep_logs_raw.json", "quiz_attempts_raw.json"]
    missing = [f for f in required if not (raw_dir / f).exists()]
    if missing:
        print(f"Missing files: {missing}. Generating synthetic data...")
        _run("generate_synthetic.py")
    else:
        print("All raw files present ✓")


def validate_schema(**kwargs):
    _run("validate_schema.py")


def preprocess_sleep(**kwargs):
    _run("preprocess_sleep.py")


def preprocess_quiz(**kwargs):
    _run("preprocess_quiz.py")


def build_features(**kwargs):
    _run("build_features.py")


def gen_stats(**kwargs):
    _run("generate_stats.py")


def anomaly_detection(**kwargs):
    try:
        _run("anomaly_detection.py")
    except RuntimeError as e:
        print(f"⚠️ Anomaly detection raised: {e}")
        print("Pipeline continues — see anomaly_report.json for details.")


def bias_slicing(**kwargs):
    _run("bias_report.py")


def log_completion(**kwargs):
    print("=" * 60)
    print("✅ Level Up Data Pipeline completed successfully")
    print(f"   Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)


# ── DAG definition ──

default_args = {
    "owner": "levelup",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
}

with DAG(
    dag_id="levelup_datapipeline",
    default_args=default_args,
    description="Level Up sleep + quiz data pipeline with schema validation, "
                "anomaly detection, and bias reporting.",
    schedule_interval="0 2 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["levelup", "mlops", "data-pipeline"],
) as dag:

    t1 = PythonOperator(task_id="ingest_raw_data", python_callable=ingest_raw_data)
    t2 = PythonOperator(task_id="validate_schema", python_callable=validate_schema)
    t3 = PythonOperator(task_id="preprocess_sleep", python_callable=preprocess_sleep)
    t4 = PythonOperator(task_id="preprocess_quiz", python_callable=preprocess_quiz)
    t5 = PythonOperator(task_id="build_features", python_callable=build_features)
    t6 = PythonOperator(task_id="generate_schema_and_stats", python_callable=gen_stats)
    t7 = PythonOperator(task_id="anomaly_detection_and_alert", python_callable=anomaly_detection)
    t8 = PythonOperator(task_id="bias_slicing_report", python_callable=bias_slicing)
    t9 = PythonOperator(task_id="log_completion", python_callable=log_completion)

    # Dependencies
    t1 >> t2 >> [t3, t4]
    [t3, t4] >> t5
    t5 >> [t6, t7, t8]
    [t6, t7, t8] >> t9
