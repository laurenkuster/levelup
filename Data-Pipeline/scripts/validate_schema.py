#!/usr/bin/env python3
"""
Schema validation for raw pipeline inputs.

Enforces required fields and data types for:
  - profiles_raw.json
  - sleep_logs_raw.json
  - quiz_attempts_raw.json
"""

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import PROFILES_RAW, SLEEP_RAW, QUIZ_RAW

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Schema definitions ──

PROFILE_SCHEMA = {
    "user_id": str,
    "age": (int, float),
    "sex": str,
    "height": (int, float),
    "weight": (int, float),
}

SLEEP_SCHEMA = {
    "user_id": str,
    "date": str,
    "sleepHours": (int, float, type(None)),
    "quality": (int, float, type(None)),
}

QUIZ_SCHEMA = {
    "user_id": str,
    "timestamp": str,
    "num_questions": (int, float),
    "num_correct": (int, float),
    "total_time_seconds": (int, float),
}


def validate_records(records, schema, name):
    """Validate a list of records against a schema. Returns list of errors."""
    errors = []
    for i, rec in enumerate(records):
        for field, expected_type in schema.items():
            if field not in rec:
                errors.append(f"{name}[{i}]: missing field '{field}'")
            elif not isinstance(rec[field], expected_type):
                errors.append(
                    f"{name}[{i}]: field '{field}' expected "
                    f"{expected_type}, got {type(rec[field]).__name__}"
                )
    return errors


def load_json(path):
    """Load JSON from a Path."""
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path}")
    return json.loads(path.read_text())


def validate_all():
    """Run all schema validations. Returns dict of errors by source."""
    all_errors = {}

    profiles = load_json(PROFILES_RAW)
    errs = validate_records(profiles, PROFILE_SCHEMA, "profiles")
    if errs:
        all_errors["profiles"] = errs
    log.info("Profiles: %d records, %d errors", len(profiles), len(errs))

    sleep = load_json(SLEEP_RAW)
    errs = validate_records(sleep, SLEEP_SCHEMA, "sleep_logs")
    if errs:
        all_errors["sleep_logs"] = errs
    log.info("Sleep logs: %d records, %d errors", len(sleep), len(errs))

    quizzes = load_json(QUIZ_RAW)
    errs = validate_records(quizzes, QUIZ_SCHEMA, "quiz_attempts")
    if errs:
        all_errors["quiz_attempts"] = errs
    log.info("Quiz attempts: %d records, %d errors", len(quizzes), len(errs))

    return all_errors


def main():
    errors = validate_all()
    if errors:
        total = sum(len(v) for v in errors.values())
        log.warning("Schema validation found %d issue(s):", total)
        for source, errs in errors.items():
            for e in errs[:5]:
                log.warning("  %s", e)
            if len(errs) > 5:
                log.warning("  ... and %d more", len(errs) - 5)
    else:
        log.info("All schema validations passed ✓")


if __name__ == "__main__":
    main()
