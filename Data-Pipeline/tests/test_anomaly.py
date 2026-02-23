"""Tests for anomaly detection."""

import pytest
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from anomaly_detection import detect_anomalies


class TestAnomalyDetection:
    def _make_clean_df(self, n=100):
        return pd.DataFrame({
            "sleep_hours": np.random.uniform(5, 9, n),
            "attempts_count": np.random.randint(1, 5, n),
            "avg_accuracy": np.random.uniform(0.3, 0.95, n),
            "avg_time_per_question": np.random.uniform(5, 60, n),
            "int_score": np.random.uniform(20, 80, n),
            "bmr": np.random.randint(1200, 2000, n),
        })

    def test_clean_data_no_anomalies(self):
        df = self._make_clean_df()
        anomalies = detect_anomalies(df)
        assert len(anomalies) == 0

    def test_high_missingness(self):
        df = self._make_clean_df()
        # Set 25% of sleep_hours to NaN
        df.loc[df.index[:25], "sleep_hours"] = np.nan
        anomalies = detect_anomalies(df)
        miss = [a for a in anomalies if a["type"] == "high_missingness"]
        assert len(miss) >= 1

    def test_out_of_range_sleep(self):
        df = self._make_clean_df(10)
        df.loc[0, "sleep_hours"] = 16  # > 14
        df.loc[1, "sleep_hours"] = 1   # < 2
        anomalies = detect_anomalies(df)
        oor = [a for a in anomalies if a["field"] == "sleep_hours" and a["type"] == "out_of_range"]
        assert len(oor) == 1
        assert oor[0]["count"] == 2

    def test_negative_values(self):
        df = self._make_clean_df(10)
        df.loc[0, "bmr"] = -500
        anomalies = detect_anomalies(df)
        neg = [a for a in anomalies if a["type"] == "negative_value" and a["field"] == "bmr"]
        assert len(neg) == 1

    def test_bad_accuracy(self):
        df = self._make_clean_df(10)
        df.loc[0, "avg_accuracy"] = 1.5  # > 1
        anomalies = detect_anomalies(df)
        assert any(a["field"] == "avg_accuracy" for a in anomalies)

    def test_bad_time(self):
        df = self._make_clean_df(10)
        df.loc[0, "avg_time_per_question"] = 500  # > 300
        anomalies = detect_anomalies(df)
        assert any(a["field"] == "avg_time_per_question" for a in anomalies)
