"""Tests for schema validation."""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from validate_schema import validate_records, PROFILE_SCHEMA, SLEEP_SCHEMA, QUIZ_SCHEMA


class TestSchemaValidation:
    def test_valid_profile(self):
        records = [{"user_id": "u1", "age": 25, "sex": "Male", "height": 175, "weight": 70}]
        errors = validate_records(records, PROFILE_SCHEMA, "test")
        assert len(errors) == 0

    def test_missing_field(self):
        records = [{"user_id": "u1", "age": 25}]  # missing sex, height, weight
        errors = validate_records(records, PROFILE_SCHEMA, "test")
        assert len(errors) == 3

    def test_wrong_type(self):
        records = [{"user_id": "u1", "age": "old", "sex": "Male", "height": 175, "weight": 70}]
        errors = validate_records(records, PROFILE_SCHEMA, "test")
        assert len(errors) == 1
        assert "age" in errors[0]

    def test_valid_sleep(self):
        records = [{"user_id": "u1", "date": "2025-01-01", "sleepHours": 7.5, "quality": 4}]
        errors = validate_records(records, SLEEP_SCHEMA, "test")
        assert len(errors) == 0

    def test_nullable_sleep_fields(self):
        """Quality and sleepHours are nullable."""
        records = [{"user_id": "u1", "date": "2025-01-01", "sleepHours": None, "quality": None}]
        errors = validate_records(records, SLEEP_SCHEMA, "test")
        assert len(errors) == 0

    def test_valid_quiz(self):
        records = [{
            "user_id": "u1", "timestamp": "2025-01-01T10:00:00",
            "num_questions": 10, "num_correct": 7, "total_time_seconds": 120,
        }]
        errors = validate_records(records, QUIZ_SCHEMA, "test")
        assert len(errors) == 0

    def test_missing_quiz_fields(self):
        records = [{"user_id": "u1"}]  # missing 4 fields
        errors = validate_records(records, QUIZ_SCHEMA, "test")
        assert len(errors) == 4
