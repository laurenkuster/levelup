"""Tests for quiz attempt preprocessing."""

import numpy as np
import pandas as pd
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from preprocess_quiz import preprocess_quiz, compute_int_score


class TestIntScore:
    def test_perfect_accuracy(self):
        score = compute_int_score(accuracy=1.0, streak_days=7)
        assert score == 100  # 75 + 25

    def test_zero_accuracy(self):
        score = compute_int_score(accuracy=0.0, streak_days=0)
        assert score == 0

    def test_mid_range(self):
        score = compute_int_score(accuracy=0.5, streak_days=3)
        expected = 0.5 * 75 + min(1, 3 / 7) * 25  # 37.5 + 10.71
        assert score == pytest.approx(expected, abs=1)

    def test_clamp_above_100(self):
        score = compute_int_score(accuracy=1.5, streak_days=10)
        assert score <= 100


class TestPreprocessQuiz:
    def _make_df(self, n=5):
        rows = []
        for i in range(n):
            rows.append({
                "user_id": "user_001",
                "timestamp": f"2025-01-{10+i:02d}T14:00:00",
                "num_questions": 10,
                "num_correct": 7,
                "total_time_seconds": 120,
                "avg_time_per_question_seconds": 12.0,
                "topic": "Math",
            })
        return pd.DataFrame(rows)

    def test_basic_aggregation(self):
        result = preprocess_quiz(self._make_df())
        assert len(result) == 5  # one per day
        assert "avg_accuracy" in result.columns
        assert "int_score" in result.columns

    def test_accuracy_computation(self):
        df = self._make_df(1)
        result = preprocess_quiz(df)
        assert result["avg_accuracy"].iloc[0] == pytest.approx(0.7, abs=0.01)

    def test_negative_correct_filtered(self):
        """Negative num_correct should be removed."""
        df = self._make_df(2)
        df.loc[0, "num_correct"] = -1
        result = preprocess_quiz(df)
        assert len(result) == 1  # only 1 valid record

    def test_high_time_filtered(self):
        """avg_time > 300s should become NaN."""
        df = self._make_df(1)
        df.loc[0, "avg_time_per_question_seconds"] = 500.0
        result = preprocess_quiz(df)
        assert pd.isna(result["avg_time_per_question"].iloc[0])

    def test_duplicates_same_day(self):
        """Multiple quizzes on same day should aggregate."""
        rows = [
            {"user_id": "u1", "timestamp": "2025-01-10T10:00:00",
             "num_questions": 10, "num_correct": 8,
             "total_time_seconds": 100, "avg_time_per_question_seconds": 10},
            {"user_id": "u1", "timestamp": "2025-01-10T15:00:00",
             "num_questions": 10, "num_correct": 6,
             "total_time_seconds": 120, "avg_time_per_question_seconds": 12},
        ]
        result = preprocess_quiz(pd.DataFrame(rows))
        assert len(result) == 1  # one row per day
        assert result["attempts_count"].iloc[0] == 2
        assert result["avg_accuracy"].iloc[0] == pytest.approx(0.7, abs=0.01)

    def test_rolling_features(self):
        result = preprocess_quiz(self._make_df(10))
        assert "rolling_int_3d" in result.columns
        assert "rolling_int_7d" in result.columns
