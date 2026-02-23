"""Tests for sleep log preprocessing."""

import numpy as np
import pandas as pd
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from preprocess_sleep import preprocess_sleep, parse_time_to_minutes


class TestParseTime:
    def test_normal(self):
        assert parse_time_to_minutes("07:30") == 450

    def test_midnight(self):
        assert parse_time_to_minutes("00:00") == 0

    def test_end_of_day(self):
        assert parse_time_to_minutes("23:59") == 1439

    def test_invalid(self):
        assert np.isnan(parse_time_to_minutes("invalid"))

    def test_none(self):
        assert np.isnan(parse_time_to_minutes(None))


class TestPreprocessSleep:
    def _make_df(self, overrides=None):
        base = {
            "user_id": "user_001",
            "date": "2025-01-15",
            "sleepHours": 7.5,
            "quality": 4,
            "bedTime": "23:00",
            "wakeTime": "06:30",
        }
        if overrides:
            base.update(overrides)
        return pd.DataFrame([base])

    def test_normal_record(self):
        result = preprocess_sleep(self._make_df())
        assert len(result) == 1
        assert result["sleep_hours"].iloc[0] == 7.5
        assert result["sleep_satisfaction"].iloc[0] == 0.75  # (4-1)/4

    def test_clamp_high_sleep(self):
        """Sleep hours > 14 should become NaN."""
        result = preprocess_sleep(self._make_df({"sleepHours": 16.0}))
        assert pd.isna(result["sleep_hours"].iloc[0])

    def test_clamp_low_sleep(self):
        """Sleep hours < 2 should become NaN."""
        result = preprocess_sleep(self._make_df({"sleepHours": 0.5}))
        assert pd.isna(result["sleep_hours"].iloc[0])

    def test_missing_quality(self):
        """Missing quality → NaN satisfaction."""
        result = preprocess_sleep(self._make_df({"quality": None}))
        assert pd.isna(result["sleep_satisfaction"].iloc[0])

    def test_rolling_features_exist(self):
        """Multiple days should produce rolling features."""
        rows = []
        for i in range(7):
            rows.append({
                "user_id": "user_001",
                "date": f"2025-01-{10+i:02d}",
                "sleepHours": 7.0 + i * 0.1,
                "quality": 3,
                "bedTime": "23:00",
                "wakeTime": "06:30",
            })
        df = pd.DataFrame(rows)
        result = preprocess_sleep(df)
        assert "rolling_sleep_hours_3d" in result.columns
        assert "rolling_sleep_hours_7d" in result.columns
        assert "bedtime_variability_7d" in result.columns
        # Last row should have a 7d rolling average
        assert not pd.isna(result["rolling_sleep_hours_7d"].iloc[-1])

    def test_midnight_crossing(self):
        """Bed at 23:00, wake at 06:30 — midpoint should handle wrap."""
        result = preprocess_sleep(self._make_df())
        midpoint = result["sleep_midpoint"].iloc[0]
        # 23:00 = 1380 min, 06:30 = 390 min
        # Wrap: (1380 + 390 + 1440) / 2 % 1440 = 1605 % 1440 = 165
        assert midpoint == pytest.approx(165, abs=1)
