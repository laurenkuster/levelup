# Level Up — Data Pipeline

Airflow-based MLOps data pipeline for the Level Up app's **Sleep** and **INT (quiz performance)** analytics.

## Folder Structure

```
Data-Pipeline/
├── dags/
│   └── levelup_datapipeline.py     # Airflow DAG (9 tasks)
├── scripts/
│   ├── config.py                   # Centralized path configuration
│   ├── generate_synthetic.py       # Synthetic data generator
│   ├── validate_schema.py          # Schema enforcement
│   ├── preprocess_sleep.py         # Sleep log → sleep_daily.parquet
│   ├── preprocess_quiz.py          # Quiz attempts → int_daily.parquet
│   ├── build_features.py           # Join + BMR → daily_joined.parquet
│   ├── generate_stats.py           # schema.json + stats.json
│   ├── anomaly_detection.py        # Anomaly detection + Slack alerting
│   └── bias_report.py              # Bias slicing by sex + age
├── tests/
│   ├── test_preprocess_sleep.py    # 11 tests
│   ├── test_preprocess_quiz.py     # 10 tests
│   ├── test_bmr.py                 # 5 tests
│   ├── test_schema.py              # 8 tests
│   └── test_anomaly.py             # 6 tests
├── data/
│   ├── raw/                        # Raw JSON inputs
│   ├── processed/                  # Parquet outputs
│   └── reports/                    # JSON reports
├── logs/                           # Pipeline logs
├── requirements.txt
├── dvc.yaml                        # DVC pipeline stages
├── .gitignore
├── .dvcignore
└── README.md
```

## Architecture

```
ingest → validate → ┬─ preprocess_sleep ─┐
                     └─ preprocess_quiz  ─┤
                                          ↓
                                    build_features
                                          │
                              ┌───────────┼───────────┐
                              ↓           ↓           ↓
                         gen_stats   anomaly_det   bias_report
                              └───────────┼───────────┘
                                          ↓
                                    log_completion
```

## Quick Start

### 1. Environment Setup

```bash
cd Data-Pipeline
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Generate Synthetic Data

```bash
python scripts/generate_synthetic.py
```

Generates 50 users × 30 days → ~1,300 sleep logs + ~1,400 quiz attempts.

### 3. Run Pipeline (Scripts Only)

```bash
python scripts/validate_schema.py
python scripts/preprocess_sleep.py
python scripts/preprocess_quiz.py
python scripts/build_features.py
python scripts/generate_stats.py
python scripts/anomaly_detection.py   # may raise on injected anomalies
python scripts/bias_report.py
```

### 4. Run Tests

```bash
pytest tests/ -v
```

39 tests covering: sleep preprocessing, quiz preprocessing, BMR computation, schema validation, anomaly detection.

### 5. Run with DVC

```bash
dvc init       # first time only
dvc repro      # runs full pipeline respecting dependencies
```

DVC tracks `data/raw/`, `data/processed/`, and `data/reports/` as stage outputs.

### 6. Run with Airflow

```bash
export AIRFLOW_HOME=$(pwd)/airflow_home
airflow db init
airflow dags list                      # verify DAG appears
airflow dags trigger levelup_datapipeline
airflow scheduler &
airflow webserver -p 8080 &
# Open http://localhost:8080
```

## Pipeline Stages

| # | Task ID | Script | Output |
|---|---------|--------|--------|
| 1 | `ingest_raw_data` | `generate_synthetic.py` | `data/raw/*.json` |
| 2 | `validate_schema` | `validate_schema.py` | (validation only) |
| 3 | `preprocess_sleep` | `preprocess_sleep.py` | `sleep_daily.parquet` |
| 4 | `preprocess_quiz` | `preprocess_quiz.py` | `int_daily.parquet` |
| 5 | `build_features` | `build_features.py` | `daily_joined.parquet` |
| 6 | `generate_schema_and_stats` | `generate_stats.py` | `schema.json`, `stats.json` |
| 7 | `anomaly_detection_and_alert` | `anomaly_detection.py` | `anomaly_report.json` |
| 8 | `bias_slicing_report` | `bias_report.py` | `bias_report.json` |

## Output Schemas

### `sleep_daily.parquet`

| Column | Type | Description |
|--------|------|-------------|
| user_id | str | User identifier |
| date | datetime | Calendar date |
| sleep_hours | float | Duration (clamped 2–14) |
| sleep_start_minutes | int | Bedtime (minutes since midnight) |
| sleep_end_minutes | int | Wake time (minutes since midnight) |
| sleep_midpoint | float | Midpoint (handles midnight wrap) |
| sleep_satisfaction | float | Quality mapped 0.0–1.0 |
| rolling_sleep_hours_3d | float | 3-day rolling average |
| rolling_sleep_hours_7d | float | 7-day rolling average |
| bedtime_variability_7d | float | 7-day std dev of bedtime |

### `int_daily.parquet`

| Column | Type | Description |
|--------|------|-------------|
| user_id | str | User identifier |
| date | datetime | Calendar date |
| attempts_count | int | Quizzes that day |
| avg_accuracy | float | Mean accuracy (0–1) |
| avg_time_per_question | float | Seconds (NaN if >300 or ≤0) |
| int_score | float | Composite 0–100 |
| rolling_int_3d | float | 3-day rolling INT |
| rolling_int_7d | float | 7-day rolling INT |

### `daily_joined.parquet`

Outer join of sleep + quiz on `(user_id, date)`, plus profile columns (`age`, `sex`, `height`, `weight`, `bmr`).

## Anomaly Detection

| Check | Threshold | Severity |
|-------|-----------|----------|
| Missingness in key fields | >20% | warning |
| `sleep_hours` out of [2, 14] | any | error |
| `avg_accuracy` outside [0, 1] | any | error |
| `avg_time_per_question` >300s or ≤0 | any | warning |
| Negative values | any | error |

Set `SLACK_WEBHOOK_URL` environment variable for Slack alerting.

## Bias Report

Slices by **sex** (Male/Female) and **age** (<20, 20-29, 30-39, 40+).

Per slice: count, mean INT score, mean accuracy, mean sleep hours.

Flags slices with **< 10 samples** as imbalanced.

### Mitigation Strategies

If slices are imbalanced:
1. Collect more data from underrepresented groups
2. Apply sample weighting during model training
3. Use stratified train/test splits
4. Monitor per-slice model performance separately

## Path Configuration

All scripts import paths from `scripts/config.py`:

```python
from config import RAW_DIR, PROCESSED_DIR, REPORTS_DIR
```

No absolute paths anywhere. All paths resolve relative to `Data-Pipeline/`.

## Reproducibility

- **DVC** tracks all data artifacts (`dvc repro` reproduces the full pipeline)
- **Fixed seed** (`random.seed(42)`) in synthetic data generation
- **Deterministic scripts** — same inputs → same outputs
- **Self-contained** — no external dependencies outside this folder
