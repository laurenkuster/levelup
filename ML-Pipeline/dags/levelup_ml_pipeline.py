"""
Level Up ML Pipeline -- Airflow DAG.

Orchestrates the full machine-learning lifecycle for the energy-score
prediction model that powers the Level Up mobile app.

Task graph
----------
  t1  check_data_ready       -- verify daily_joined.parquet exists
        |
  t2  hyperparameter_tuning  -- tune RF + XGBoost (skippable via Variable)
        |
  t3  train_model            -- train best model with selected params
        |
  +---> t4  validate_model   -- quality gates (MAE < 5.0, R2 > 0.7)
  +---> t5  bias_detection   -- per-slice fairness analysis
        |
  t6  sensitivity_analysis   -- SHAP feature importance
        |
  t7  export_model           -- export to JSON for on-device inference
        |
  t8  registry_push          -- push to Firebase model registry (main only)
        |
  t9  log_completion         -- final status log

Schedule: weekly on Sunday at 04:00 UTC (two hours after the data
          pipeline finishes its daily 02:00 UTC run, giving a comfortable
          buffer for data freshness).

Dependencies
------------
This DAG expects the Data Pipeline to have already produced
``Data-Pipeline/data/processed/daily_joined.parquet``.
"""

# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------
from datetime import datetime, timedelta
from pathlib import Path
import json
import os
import subprocess
import sys

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.models import Variable

# ---------------------------------------------------------------------------
# Path configuration
# ---------------------------------------------------------------------------
# The scripts directory is the ML-Pipeline/ root (where train_model.py etc.
# live).  We resolve it relative to this DAG file so that the DAG works
# regardless of where the Airflow home directory is configured.
SCRIPTS_DIR = Path(__file__).resolve().parent.parent          # ML-Pipeline/
REPO_ROOT   = SCRIPTS_DIR.parent                               # levelup-1/

# The parquet file produced by the upstream data pipeline.
DAILY_JOINED = (
    REPO_ROOT / "Data-Pipeline" / "data" / "processed" / "daily_joined.parquet"
)

# Validation report written by validate_model.py -- used to gate the pipeline.
VALIDATION_REPORT = SCRIPTS_DIR / "reports" / "validation_report.json"

# ---------------------------------------------------------------------------
# Subprocess helper
# ---------------------------------------------------------------------------

def _run_script(script_name: str, extra_args: list | None = None) -> str:
    """
    Execute a Python script from ML-Pipeline/ as a subprocess.

    Parameters
    ----------
    script_name : str
        Filename of the script (e.g. ``train_model.py``).
    extra_args : list, optional
        Additional CLI arguments to pass to the script.

    Returns
    -------
    str
        Combined stdout from the subprocess.

    Raises
    ------
    RuntimeError
        If the script exits with a non-zero return code.
    """
    path = SCRIPTS_DIR / script_name
    cmd  = [sys.executable, str(path)] + (extra_args or [])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(SCRIPTS_DIR),           # run from ML-Pipeline/ root
    )

    # Always relay stdout so it appears in Airflow task logs.
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        raise RuntimeError(
            f"Script {script_name} failed with exit code {result.returncode}"
        )

    return result.stdout


# ===================================================================
# Task callables
# ===================================================================

def check_data_ready(**context):
    """Verify that the upstream data pipeline has produced daily_joined.parquet.

    This is a fast pre-flight check.  If the file is missing the task fails
    immediately so that we do not waste compute on downstream steps.
    """
    if not DAILY_JOINED.exists():
        raise FileNotFoundError(
            f"Input data not found: {DAILY_JOINED}\n"
            "The data pipeline (levelup_datapipeline) must run successfully "
            "before the ML pipeline can start.  Check that the data pipeline "
            "DAG has completed and that daily_joined.parquet exists."
        )

    size_mb = DAILY_JOINED.stat().st_size / (1024 * 1024)
    print(f"Data check passed: {DAILY_JOINED}")
    print(f"  File size: {size_mb:.2f} MB")
    print(f"  Last modified: {datetime.fromtimestamp(DAILY_JOINED.stat().st_mtime).isoformat()}")


def hyperparameter_tuning(**context):
    """Run hyperparameter tuning for Random Forest and XGBoost.

    The step can be skipped by setting the Airflow Variable ``skip_tuning``
    to ``true`` (case-insensitive).  When skipped, the training step will
    fall back to default hyperparameters defined in train_model.py.
    """
    # Check the Airflow Variable; default to "false" (do not skip).
    skip = Variable.get("skip_tuning", default_var="false")
    if skip.strip().lower() in ("true", "1", "yes"):
        print("Hyperparameter tuning SKIPPED (skip_tuning Variable is set).")
        print("Training will use default or previously-saved parameters.")
        return

    _run_script("hyperparameter_tuning.py")


def train_model(**context):
    """Train the best model using optimised (or default) hyperparameters.

    If a ``best_params.json`` file exists from a prior tuning run it is
    passed to train_model.py via the ``--params`` flag.  Otherwise the
    script uses its own built-in defaults.
    """
    params_file = SCRIPTS_DIR / "models" / "best_params.json"
    extra_args = []
    if params_file.exists():
        extra_args = ["--params", str(params_file)]
        print(f"Using tuned params from {params_file}")
    else:
        print("No tuned params found -- using default hyperparameters.")

    _run_script("train_model.py", extra_args=extra_args)


def validate_model(**context):
    """Run model validation and enforce quality gates.

    The validation script writes ``reports/validation_report.json`` which
    contains an overall ``status`` field (``PASS`` or ``FAIL``) and
    individual gate results for MAE and R-squared.

    If the validation report indicates a failure this task raises an
    exception, which prevents all downstream tasks (export, registry push)
    from executing.
    """
    _run_script("validate_model.py")

    # Double-check the report on the Airflow side so that the DAG is
    # guaranteed to fail even if the script forgot to exit(1).
    if VALIDATION_REPORT.exists():
        report = json.loads(VALIDATION_REPORT.read_text())
        status = report.get("status", "UNKNOWN")
        metrics = report.get("metrics", {})
        gates   = report.get("gates", {})

        print(f"Validation status: {status}")
        print(f"  MAE:  {metrics.get('mae')}  (gate: {gates.get('mae_gate', {}).get('threshold')})")
        print(f"  R2:   {metrics.get('r2')}   (gate: {gates.get('r2_gate', {}).get('threshold')})")

        if status != "PASS":
            failed_gates = [
                name for name, g in gates.items() if not g.get("passed")
            ]
            raise RuntimeError(
                f"Model validation FAILED.  Failed gates: {failed_gates}. "
                f"Metrics -- MAE: {metrics.get('mae')}, R2: {metrics.get('r2')}"
            )
    else:
        raise FileNotFoundError(
            f"Validation report not found at {VALIDATION_REPORT}. "
            "validate_model.py may not have completed correctly."
        )


def bias_detection(**context):
    """Run per-slice fairness analysis across demographic groups.

    Evaluates model performance broken down by sex and age bucket to
    surface potential bias.  The bias report is saved as
    ``reports/bias_detection_report.json``.
    """
    _run_script("model_bias_detection.py")


def sensitivity_analysis(**context):
    """Compute SHAP-based feature importance for model interpretability.

    Produces ``reports/shap_feature_importance.json`` and a SHAP summary
    plot under ``plots/``.
    """
    _run_script("sensitivity_analysis.py")


def export_model(**context):
    """Export the trained sklearn model to JSON for on-device inference.

    The exported ``model_weights.json`` is consumed by the React Native
    app's JavaScript inference engine and is also copied into the app
    source tree for bundling.
    """
    _run_script("export_model.py")


def registry_push(**context):
    """Push the model artifact to the Firebase model registry.

    This step is conditional: it only runs when executing on the ``main``
    branch.  The branch is determined by (in priority order):

    1. The Airflow Variable ``git_branch`` (useful for testing).
    2. The ``GIT_BRANCH`` environment variable (set by most CI systems).
    3. Inspecting the local git repo via ``git rev-parse``.

    On non-main branches the task succeeds silently so that the rest of
    the DAG graph is not disrupted.
    """
    # --- Determine current branch ---
    branch = Variable.get("git_branch", default_var="")

    if not branch:
        branch = os.environ.get("GIT_BRANCH", "")

    if not branch:
        # Fall back to asking git directly.
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True, text=True,
                cwd=str(REPO_ROOT),
            )
            branch = result.stdout.strip() if result.returncode == 0 else ""
        except Exception:
            branch = ""

    print(f"Detected branch: '{branch}'")

    if branch not in ("main", "master"):
        print(
            f"Registry push SKIPPED -- branch '{branch}' is not main. "
            "Set the Airflow Variable 'git_branch' to 'main' to force a push."
        )
        return

    _run_script("registry_push.py")


def log_completion(**context):
    """Log a final status message indicating the ML pipeline has completed.

    This is a lightweight sentinel task that makes it easy to confirm
    end-to-end success in the Airflow UI and downstream monitoring.
    """
    print("=" * 60)
    print("Level Up ML Pipeline completed successfully")
    print(f"  Timestamp : {datetime.utcnow().isoformat()}Z")
    print(f"  DAG run   : {context.get('run_id', 'N/A')}")
    print(f"  Execution : {context.get('execution_date', 'N/A')}")
    print("=" * 60)


# ===================================================================
# DAG definition
# ===================================================================

default_args = {
    "owner": "levelup",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="levelup_ml_pipeline",
    default_args=default_args,
    description=(
        "Weekly ML pipeline: hyperparameter tuning, model training, "
        "validation gates, bias detection, SHAP analysis, model export, "
        "and Firebase registry push."
    ),
    # Every Sunday at 04:00 UTC -- two hours after the data pipeline.
    schedule_interval="0 4 * * 0",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["levelup", "mlops", "ml-pipeline", "model-training"],
) as dag:

    # ---- t1: Data readiness check -----------------------------------
    t1 = PythonOperator(
        task_id="check_data_ready",
        python_callable=check_data_ready,
        doc_md="Verify that `daily_joined.parquet` exists before "
               "running any compute-intensive tasks.",
    )

    # ---- t2: Hyperparameter tuning (skippable) ----------------------
    t2 = PythonOperator(
        task_id="hyperparameter_tuning",
        python_callable=hyperparameter_tuning,
        doc_md="Tune Random Forest and XGBoost via RandomizedSearchCV. "
               "Set Airflow Variable `skip_tuning=true` to skip.",
    )

    # ---- t3: Model training -----------------------------------------
    t3 = PythonOperator(
        task_id="train_model",
        python_callable=train_model,
        doc_md="Train the best model using tuned or default parameters.",
    )

    # ---- t4: Validation gates (parallel with t5) --------------------
    t4 = PythonOperator(
        task_id="validate_model",
        python_callable=validate_model,
        doc_md="Evaluate model on hold-out set and enforce quality gates "
               "(MAE < 5.0, R2 > 0.7).  Fails the DAG on gate breach.",
    )

    # ---- t5: Bias detection (parallel with t4) ----------------------
    t5 = PythonOperator(
        task_id="bias_detection",
        python_callable=bias_detection,
        doc_md="Per-slice fairness analysis across sex and age groups.",
    )

    # ---- t6: Sensitivity / SHAP analysis ----------------------------
    t6 = PythonOperator(
        task_id="sensitivity_analysis",
        python_callable=sensitivity_analysis,
        doc_md="SHAP-based feature importance for interpretability.",
    )

    # ---- t7: Model export to JSON -----------------------------------
    t7 = PythonOperator(
        task_id="export_model",
        python_callable=export_model,
        doc_md="Export sklearn model to JSON for the app's JS inference "
               "engine.",
    )

    # ---- t8: Firebase registry push (main branch only) --------------
    t8 = PythonOperator(
        task_id="registry_push",
        python_callable=registry_push,
        doc_md="Push versioned model tarball to Firebase Storage. "
               "Only executes on the main branch.",
    )

    # ---- t9: Completion log -----------------------------------------
    t9 = PythonOperator(
        task_id="log_completion",
        python_callable=log_completion,
        doc_md="Final status log confirming end-to-end pipeline success.",
    )

    # ------------------------------------------------------------------
    # Task dependencies
    # ------------------------------------------------------------------
    #
    #   t1 -> t2 -> t3 -> [t4, t5] -> t6 -> t7 -> t8 -> t9
    #
    # t4 (validate_model) and t5 (bias_detection) run in parallel after
    # training.  Both must succeed before sensitivity analysis proceeds.
    # ------------------------------------------------------------------
    t1 >> t2 >> t3 >> [t4, t5]
    [t4, t5] >> t6 >> t7 >> t8 >> t9
