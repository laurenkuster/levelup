"""
Level Up Data Pipeline -- Airflow DAG
======================================

Purpose
-------
End-to-end daily data pipeline for the Level Up gamified fitness platform.
Ingests raw user data (profiles, sleep logs, quiz attempts), validates and
preprocesses it into analysis-ready Parquet files, computes derived features,
and produces quality/fairness reports (schema stats, anomaly alerts, bias
slicing).

Owner / Contact
---------------
- Team: Level Up MLOps
- DAG owner (Airflow): ``levelup``
- Repository: levelup-1/Data-Pipeline

Schedule
--------
Runs every day at **02:00 UTC** (``0 2 * * *``).
Catchup is disabled -- only the most recent execution date is run on deploy.

Task Dependency Graph (9 tasks)
-------------------------------
::

    [ingest_raw_data]
            |
    [validate_schema]
            |
       -----------          <-- fan-out: parallel preprocessing
       |         |
  [preprocess   [preprocess
    _sleep]      _quiz]
       |         |
       -----------          <-- fan-in: both must finish
            |
    [build_features]
            |
    -----------------       <-- fan-out: parallel reporting
    |       |       |
  [gen   [anomaly [bias
  stats]  detect]  slice]
    |       |       |
    -----------------       <-- fan-in: all three must finish
            |
    [log_completion]

Data Flow
---------
::

    data/raw/                        (JSON source files)
      profiles_raw.json   ----+
      sleep_logs_raw.json ----|---> validate_schema
      quiz_attempts_raw.json -+
                                  |
                        +---------+---------+
                        |                   |
                  preprocess_sleep    preprocess_quiz
                        |                   |
                data/processed/       data/processed/
                sleep_daily.parquet   int_daily.parquet
                        |                   |
                        +--------+----------+
                                 |
                          build_features
                                 |
                    data/processed/daily_joined.parquet
                                 |
                    +------------+-------------+
                    |            |             |
              generate_stats  anomaly_det   bias_report
                    |            |             |
              schema.json   anomaly_report  bias_report
              stats.json       .json           .json

Notes
-----
- If raw source files are missing, ``ingest_raw_data`` will auto-generate
  synthetic data via ``generate_synthetic.py`` so the pipeline never fails
  on a cold start.
- ``anomaly_detection`` is **soft-fail**: errors are logged but do not block
  downstream tasks, ensuring the completion log is always written.
- All heavy lifting is delegated to standalone Python scripts under
  ``Data-Pipeline/scripts/``.  The DAG only orchestrates execution order.
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
    """Execute a pipeline helper script as a child process.

    Parameters
    ----------
    script_name : str
        Filename (not full path) of a script located in ``Data-Pipeline/scripts/``.
        Example: ``"validate_schema.py"``.

    Behaviour
    ---------
    - The script is executed with the same Python interpreter that runs Airflow
      (``sys.executable``), so it shares the same virtual-environment packages.
    - Working directory is set to ``Data-Pipeline/`` (one level above *scripts/*)
      so that relative paths like ``data/raw/`` resolve correctly inside each
      script.
    - Both stdout and stderr are captured and forwarded to the Airflow task log.
    - A non-zero exit code raises ``RuntimeError``, which Airflow treats as a
      task failure (subject to the retry policy in ``default_args``).

    Raises
    ------
    RuntimeError
        If the child process exits with a non-zero return code.
    """
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
    """Ensure all required raw JSON source files exist before the pipeline proceeds.

    Checks for the presence of three files under ``data/raw/``:

    - ``profiles_raw.json``        -- user profile demographics
    - ``sleep_logs_raw.json``      -- nightly sleep log entries
    - ``quiz_attempts_raw.json``   -- daily quiz attempt records

    If **any** file is missing, the ``generate_synthetic.py`` script is invoked
    to create a complete set of synthetic data.  This guarantees the pipeline
    can run end-to-end even on a fresh environment with no real data.

    Input
    -----
    Reads from the filesystem: ``Data-Pipeline/data/raw/``.

    Output
    ------
    Either confirms existing files or writes new synthetic JSON files into
    ``data/raw/``.

    Error behaviour
    ---------------
    Raises ``RuntimeError`` (via ``_run``) if synthetic generation fails.

    Dependencies
    ------------
    - Upstream : none (this is the first task in the DAG).
    - Downstream : ``validate_schema``.
    """
    raw_dir = SCRIPTS_DIR.parent / "data" / "raw"
    required = ["profiles_raw.json", "sleep_logs_raw.json", "quiz_attempts_raw.json"]
    missing = [f for f in required if not (raw_dir / f).exists()]
    if missing:
        print(f"Missing files: {missing}. Generating synthetic data...")
        _run("generate_synthetic.py")
    else:
        print("All raw files present ✓")


def validate_schema(**kwargs):
    """Validate the structure and data types of every raw JSON source file.

    Runs ``validate_schema.py``, which checks each raw file against an
    expected schema (required fields, value types, allowed ranges).  Any
    schema violation causes the task to fail, preventing bad data from
    flowing into the preprocessing stages.

    Input
    -----
    Reads ``data/raw/profiles_raw.json``, ``sleep_logs_raw.json``,
    ``quiz_attempts_raw.json``.

    Output
    ------
    No new files -- validation is pass/fail only.

    Error behaviour
    ---------------
    Raises ``RuntimeError`` on schema violations so downstream tasks are
    skipped (Airflow marks them as *upstream_failed*).

    Dependencies
    ------------
    - Upstream : ``ingest_raw_data``.
    - Downstream : ``preprocess_sleep``, ``preprocess_quiz`` (fan-out).
    """
    _run("validate_schema.py")


def preprocess_sleep(**kwargs):
    """Clean and aggregate raw sleep logs into a daily Parquet summary.

    Runs ``preprocess_sleep.py``, which reads ``sleep_logs_raw.json``,
    normalises timestamps, fills gaps, and computes per-user daily sleep
    metrics (total hours, efficiency, sleep/wake counts).

    Input
    -----
    ``data/raw/sleep_logs_raw.json``

    Output
    ------
    ``data/processed/sleep_daily.parquet``

    Error behaviour
    ---------------
    Raises ``RuntimeError`` on failure; ``build_features`` will not run.

    Dependencies
    ------------
    - Upstream : ``validate_schema``.
    - Downstream : ``build_features`` (waits for both this task and
      ``preprocess_quiz``).
    """
    _run("preprocess_sleep.py")


def preprocess_quiz(**kwargs):
    """Clean and aggregate raw quiz attempts into a daily Parquet summary.

    Runs ``preprocess_quiz.py``, which reads ``quiz_attempts_raw.json``,
    deduplicates entries, and computes per-user daily intelligence metrics
    (attempts, accuracy, streaks).

    Input
    -----
    ``data/raw/quiz_attempts_raw.json``

    Output
    ------
    ``data/processed/int_daily.parquet``

    Error behaviour
    ---------------
    Raises ``RuntimeError`` on failure; ``build_features`` will not run.

    Dependencies
    ------------
    - Upstream : ``validate_schema``.
    - Downstream : ``build_features`` (waits for both this task and
      ``preprocess_sleep``).
    """
    _run("preprocess_quiz.py")


def build_features(**kwargs):
    """Join preprocessed datasets and engineer the final feature table.

    Runs ``build_features.py``, which:

    1. Joins ``sleep_daily.parquet`` and ``int_daily.parquet`` on
       ``(user_id, date)``.
    2. Enriches with profile data (age, weight, height) to compute BMR.
    3. Writes the unified feature table used by all downstream reporting
       tasks.

    Input
    -----
    - ``data/processed/sleep_daily.parquet``
    - ``data/processed/int_daily.parquet``
    - ``data/raw/profiles_raw.json``

    Output
    ------
    ``data/processed/daily_joined.parquet``

    Error behaviour
    ---------------
    Raises ``RuntimeError`` on failure; all three reporting tasks will be
    marked *upstream_failed*.

    Dependencies
    ------------
    - Upstream : ``preprocess_sleep``, ``preprocess_quiz`` (fan-in).
    - Downstream : ``generate_schema_and_stats``,
      ``anomaly_detection_and_alert``, ``bias_slicing_report`` (fan-out).
    """
    _run("build_features.py")


def gen_stats(**kwargs):
    """Generate dataset schema metadata and descriptive statistics.

    Runs ``generate_stats.py``, which profiles the joined feature table and
    writes two artefacts consumed by monitoring dashboards and data-catalogue
    tools.

    Input
    -----
    ``data/processed/daily_joined.parquet``

    Output
    ------
    - ``data/processed/schema.json``  -- column names, types, nullable flags
    - ``data/processed/stats.json``   -- min/max/mean/median per numeric column

    Error behaviour
    ---------------
    Raises ``RuntimeError`` on failure; ``log_completion`` will wait for
    the other two reporting tasks before deciding to run.

    Dependencies
    ------------
    - Upstream : ``build_features``.
    - Downstream : ``log_completion`` (fan-in with anomaly + bias tasks).
    """
    _run("generate_stats.py")


def anomaly_detection(**kwargs):
    """Run statistical anomaly detection on the joined feature table.

    Runs ``anomaly_detection.py``, which applies configurable detection rules
    (z-score thresholds, IQR fences, etc.) to flag unusual data points and
    optionally sends alert notifications.

    **Soft-fail behaviour**: unlike every other task in the DAG, errors here
    are caught and logged rather than re-raised.  This means a broken anomaly
    detector will never block the pipeline -- the completion log and other
    reporting tasks still execute.  Operators should monitor the Airflow task
    log for warning messages and inspect the output file manually.

    Input
    -----
    ``data/processed/daily_joined.parquet``

    Output
    ------
    ``data/processed/anomaly_report.json`` (may be partial on error).

    Error behaviour
    ---------------
    Catches ``RuntimeError`` and logs a warning instead of failing the task.
    The task will show as *success* in Airflow even if the underlying script
    exited non-zero.

    Dependencies
    ------------
    - Upstream : ``build_features``.
    - Downstream : ``log_completion`` (fan-in with stats + bias tasks).
    """
    try:
        _run("anomaly_detection.py")
    except RuntimeError as e:
        print(f"⚠️ Anomaly detection raised: {e}")
        print("Pipeline continues — see anomaly_report.json for details.")


def bias_slicing(**kwargs):
    """Produce a fairness / bias slicing report across demographic groups.

    Runs ``bias_report.py``, which slices key metrics (sleep quality, quiz
    accuracy, etc.) by demographic attributes from user profiles (age group,
    gender, etc.) and flags statistically significant disparities.

    Input
    -----
    - ``data/processed/daily_joined.parquet``
    - ``data/raw/profiles_raw.json`` (for demographic attributes)

    Output
    ------
    ``data/processed/bias_report.json``

    Error behaviour
    ---------------
    Raises ``RuntimeError`` on failure; ``log_completion`` will still wait
    for the other two reporting tasks.

    Dependencies
    ------------
    - Upstream : ``build_features``.
    - Downstream : ``log_completion`` (fan-in with stats + anomaly tasks).
    """
    _run("bias_report.py")


def log_completion(**kwargs):
    """Print a timestamped success banner to the Airflow task log.

    This is the terminal task in the DAG.  It runs only when **all three**
    reporting tasks (stats, anomaly detection, bias slicing) have completed
    successfully (or, in the case of anomaly detection, completed with a
    soft-fail warning).

    Input
    -----
    None -- purely a logging task.

    Output
    ------
    None -- writes only to stdout (visible in Airflow task log).

    Error behaviour
    ---------------
    Cannot fail under normal circumstances.

    Dependencies
    ------------
    - Upstream : ``generate_schema_and_stats``,
      ``anomaly_detection_and_alert``, ``bias_slicing_report`` (fan-in).
    - Downstream : none (DAG leaf node).
    """
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

# Markdown rendered in the Airflow UI "DAG Docs" tab.
DAG_DOC_MD = """\
## Level Up Data Pipeline

**Owner:** Level Up MLOps team | **Schedule:** daily at 02:00 UTC

### What this DAG does

| Stage | Task(s) | Purpose |
|-------|---------|---------|
| Ingest | `ingest_raw_data` | Ensure raw JSON files exist; generate synthetic data on cold start |
| Validate | `validate_schema` | Enforce required fields, types, and value ranges |
| Preprocess | `preprocess_sleep`, `preprocess_quiz` | Clean and aggregate raw data into daily Parquet files |
| Features | `build_features` | Join datasets, compute BMR, produce unified feature table |
| Report | `generate_schema_and_stats`, `anomaly_detection_and_alert`, `bias_slicing_report` | Quality, anomaly, and fairness reports |
| Finish | `log_completion` | Timestamped success banner |

### Dependency graph

```
ingest_raw_data --> validate_schema --> preprocess_sleep --+
                                   \\-> preprocess_quiz  --+--> build_features
                                                                    |
                        +-------------------------------------------+
                        |                    |                      |
               generate_schema_and_stats  anomaly_detection  bias_slicing_report
                        |                    |                      |
                        +--------------------+----------------------+
                                             |
                                       log_completion
```

### Key behaviours

- **Cold-start safe:** synthetic data is generated automatically if raw files are missing.
- **Soft-fail anomaly detection:** the anomaly task catches errors so it never blocks the rest of the pipeline.
- **Fan-out / fan-in:** preprocessing and reporting stages run in parallel where possible to minimise wall-clock time.
"""

with DAG(
    dag_id="levelup_datapipeline",
    default_args=default_args,
    description="Level Up sleep + quiz data pipeline with schema validation, "
                "anomaly detection, and bias reporting.",
    schedule_interval="0 2 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["levelup", "mlops", "data-pipeline"],
    doc_md=DAG_DOC_MD,
) as dag:

    # ── Task definitions ──
    # Each task uses doc_md for tooltip documentation visible in the Airflow
    # Graph and Grid views when hovering over a task node.

    t1 = PythonOperator(
        task_id="ingest_raw_data",
        python_callable=ingest_raw_data,
        doc_md="Check for raw JSON files (`profiles_raw.json`, "
               "`sleep_logs_raw.json`, `quiz_attempts_raw.json`). "
               "If any are missing, generate a full synthetic dataset.",
    )

    t2 = PythonOperator(
        task_id="validate_schema",
        python_callable=validate_schema,
        doc_md="Validate every raw file against its expected schema "
               "(required fields, data types, value ranges). "
               "Fails the pipeline on any violation.",
    )

    t3 = PythonOperator(
        task_id="preprocess_sleep",
        python_callable=preprocess_sleep,
        doc_md="Clean and aggregate `sleep_logs_raw.json` into "
               "`data/processed/sleep_daily.parquet` with per-user daily "
               "sleep metrics (hours, efficiency, wake count).",
    )

    t4 = PythonOperator(
        task_id="preprocess_quiz",
        python_callable=preprocess_quiz,
        doc_md="Clean and aggregate `quiz_attempts_raw.json` into "
               "`data/processed/int_daily.parquet` with per-user daily "
               "intelligence metrics (attempts, accuracy, streaks).",
    )

    t5 = PythonOperator(
        task_id="build_features",
        python_callable=build_features,
        doc_md="Join sleep and quiz Parquet files on `(user_id, date)`, "
               "enrich with profile data (age, weight, height) to compute "
               "BMR, and write `data/processed/daily_joined.parquet`.",
    )

    t6 = PythonOperator(
        task_id="generate_schema_and_stats",
        python_callable=gen_stats,
        doc_md="Profile the joined feature table and write "
               "`schema.json` (column metadata) and `stats.json` "
               "(descriptive statistics per numeric column).",
    )

    t7 = PythonOperator(
        task_id="anomaly_detection_and_alert",
        python_callable=anomaly_detection,
        doc_md="Run anomaly detection (z-score, IQR) on the feature table "
               "and write `anomaly_report.json`. **Soft-fail:** errors are "
               "logged but do not block the pipeline.",
    )

    t8 = PythonOperator(
        task_id="bias_slicing_report",
        python_callable=bias_slicing,
        doc_md="Slice key metrics by demographic groups and write "
               "`bias_report.json` flagging statistically significant "
               "disparities across age, gender, etc.",
    )

    t9 = PythonOperator(
        task_id="log_completion",
        python_callable=log_completion,
        doc_md="Terminal task -- prints a timestamped success banner to "
               "the Airflow task log once all reporting tasks finish.",
    )

    # ── Task dependencies ──
    #
    # The pipeline follows a diamond / fan-out-fan-in pattern:
    #
    #   LINEAR HEAD
    #     ingest_raw_data -> validate_schema
    #
    #   FAN-OUT #1 (parallel preprocessing)
    #     validate_schema -> preprocess_sleep
    #     validate_schema -> preprocess_quiz
    #     Both branches are independent and can run concurrently.
    #
    #   FAN-IN #1 (join barrier)
    #     [preprocess_sleep, preprocess_quiz] -> build_features
    #     build_features waits for BOTH preprocessing tasks before it
    #     can join the two Parquet files.
    #
    #   FAN-OUT #2 (parallel reporting)
    #     build_features -> generate_schema_and_stats
    #     build_features -> anomaly_detection_and_alert
    #     build_features -> bias_slicing_report
    #     All three reporting tasks read the same feature table and are
    #     independent of each other.
    #
    #   FAN-IN #2 (completion barrier)
    #     [generate_schema_and_stats, anomaly_detection_and_alert,
    #      bias_slicing_report] -> log_completion
    #     The pipeline is not considered complete until every report
    #     has finished (or soft-failed, in the case of anomaly detection).

    t1 >> t2 >> [t3, t4]           # linear head, then fan-out to preprocessing
    [t3, t4] >> t5                 # fan-in: both preprocessors must finish
    t5 >> [t6, t7, t8]            # fan-out to three parallel reporting tasks
    [t6, t7, t8] >> t9            # fan-in: all reports must finish before completion log
