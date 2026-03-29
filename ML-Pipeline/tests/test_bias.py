"""
Tests for model bias detection.
"""

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_age_bucketing():
    """Verify that assign_age_bucket maps ages to the correct bins:
    <20 for 0-19, 20-29 for 20-29, 30-39 for 30-39, 40+ for 40+,
    and 'unknown' for invalid inputs."""
    from model_bias_detection import assign_age_bucket

    # Boundary and representative values for each bucket
    assert assign_age_bucket(0) == "<20", "Age 0 should map to <20"
    assert assign_age_bucket(15) == "<20", "Age 15 should map to <20"
    assert assign_age_bucket(19) == "<20", "Age 19 should map to <20"
    assert assign_age_bucket(20) == "20-29", "Age 20 should map to 20-29"
    assert assign_age_bucket(25) == "20-29", "Age 25 should map to 20-29"
    assert assign_age_bucket(29) == "20-29", "Age 29 should map to 20-29"
    assert assign_age_bucket(30) == "30-39", "Age 30 should map to 30-39"
    assert assign_age_bucket(35) == "30-39", "Age 35 should map to 30-39"
    assert assign_age_bucket(39) == "30-39", "Age 39 should map to 30-39"
    assert assign_age_bucket(40) == "40+", "Age 40 should map to 40+"
    assert assign_age_bucket(45) == "40+", "Age 45 should map to 40+"
    assert assign_age_bucket(99) == "40+", "Age 99 should map to 40+"

    # Invalid inputs should return 'unknown'
    assert assign_age_bucket(None) == "unknown", "None should map to unknown"
    assert assign_age_bucket("abc") == "unknown", "Non-numeric string should map to unknown"


def test_slice_metrics_computation():
    """Verify that compute_slice_metrics calculates correct per-slice
    MAE, RMSE, and sample count for a known set of predictions."""
    from model_bias_detection import compute_slice_metrics

    y_true = np.array([50, 60, 70, 80])
    y_pred = np.array([52, 58, 72, 78])
    global_mae = 2.0

    metrics = compute_slice_metrics(y_true, y_pred, global_mae)

    assert "mae" in metrics, "Should contain MAE"
    assert "rmse" in metrics, "Should contain RMSE"
    assert "count" in metrics, "Should contain sample count"
    assert metrics["count"] == 4, "Count should equal number of samples"
    assert metrics["mae"] == 2.0, "MAE should be 2.0 for uniform error of 2"
    assert metrics["rmse"] == 2.0, "RMSE should be 2.0 for uniform error of 2"
    assert not metrics["flagged"], "Should not be flagged when slice MAE equals global MAE"


def test_deviation_flagging():
    """Verify that a slice with MAE deviating more than 20% from global
    MAE is flagged, while one within the threshold is not."""
    from model_bias_detection import compute_slice_metrics

    # Large deviation: slice MAE >> global MAE
    y_true = np.array([50, 60, 70, 80])
    y_pred = np.array([40, 50, 80, 90])  # errors of 10 each, MAE=10
    global_mae = 2.0  # Much lower than slice MAE of 10

    metrics = compute_slice_metrics(y_true, y_pred, global_mae)
    assert metrics["flagged"], "Should flag when slice MAE deviates >20% from global"
    assert metrics["mae_deviation_pct"] > 20, "Deviation percentage should exceed 20%"

    # Small deviation: slice MAE close to global MAE
    y_pred_close = np.array([52, 58, 72, 78])  # errors of 2 each, MAE=2
    global_mae_close = 2.1

    metrics_close = compute_slice_metrics(y_true, y_pred_close, global_mae_close)
    assert not metrics_close["flagged"], "Should not flag when deviation is within 20%"


def test_compute_slice_metrics_flagged():
    """Verify that large deviation from global MAE triggers the flagged
    field and reports a high mae_deviation_pct."""
    from model_bias_detection import compute_slice_metrics

    y_true = np.array([50, 60, 70, 80])
    y_pred = np.array([40, 50, 80, 90])  # Large errors
    global_mae = 2.0  # Much lower than slice MAE

    metrics = compute_slice_metrics(y_true, y_pred, global_mae)

    assert metrics["flagged"], "Should flag large deviation from global MAE"
    assert metrics["mae_deviation_pct"] > 20


def test_compute_slice_metrics_zero_global():
    """Verify that compute_slice_metrics handles a global MAE of zero
    without division errors and does not flag the result."""
    from model_bias_detection import compute_slice_metrics

    y_true = np.array([50, 60])
    y_pred = np.array([50, 60])

    metrics = compute_slice_metrics(y_true, y_pred, 0.0)
    assert metrics["mae"] == 0.0
    assert not metrics["flagged"]
