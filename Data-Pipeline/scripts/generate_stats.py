#!/usr/bin/env python3
"""
Schema and statistics generation for processed data.

Outputs:
  - data/reports/schema.json
  - data/reports/stats.json
"""

import json
import logging
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DAILY_JOINED, SCHEMA_REPORT, STATS_REPORT, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def generate_schema(df):
    """Generate JSON schema from DataFrame."""
    schema = {}
    for col in df.columns:
        schema[col] = {
            "dtype": str(df[col].dtype),
            "nullable": bool(df[col].isna().any()),
            "n_unique": int(df[col].nunique()),
        }
    return schema


def generate_stats(df):
    """Generate descriptive statistics."""
    stats = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": {},
    }
    for col in df.columns:
        col_stats = {
            "dtype": str(df[col].dtype),
            "missing_count": int(df[col].isna().sum()),
            "missing_pct": round(df[col].isna().mean() * 100, 2),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            desc = df[col].describe()
            col_stats.update({
                "mean": round(float(desc.get("mean", 0)), 4),
                "std": round(float(desc.get("std", 0)), 4),
                "min": round(float(desc.get("min", 0)), 4),
                "p25": round(float(desc.get("25%", 0)), 4),
                "p50": round(float(desc.get("50%", 0)), 4),
                "p75": round(float(desc.get("75%", 0)), 4),
                "max": round(float(desc.get("max", 0)), 4),
            })
        stats["columns"][col] = col_stats
    return stats


def main():
    ensure_dirs()
    df = pd.read_parquet(DAILY_JOINED)
    log.info("Loaded %d rows from joined table", len(df))

    schema = generate_schema(df)
    SCHEMA_REPORT.write_text(json.dumps(schema, indent=2))
    log.info("Schema → %s", SCHEMA_REPORT)

    stats = generate_stats(df)
    STATS_REPORT.write_text(json.dumps(stats, indent=2))
    log.info("Stats → %s", STATS_REPORT)


if __name__ == "__main__":
    main()
