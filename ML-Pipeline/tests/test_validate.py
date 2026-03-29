"""
Tests for model validation logic.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_compute_metrics():
    """Verify that compute_metrics returns correct MAE, RMSE, R2, and
    max_error for a known set of predictions."""
    from validate_model import compute_metrics

    y_true = np.array([50, 60, 70, 80, 90])
    y_pred = np.array([52, 58, 72, 78, 88])

    metrics = compute_metrics(y_true, y_pred)

    assert "mae" in metrics
    assert "rmse" in metrics
    assert "r2" in metrics
    assert "max_error" in metrics
    assert metrics["mae"] > 0
    assert metrics["mae"] == 2.0  # Mean of [2, 2, 2, 2, 2]
    assert metrics["r2"] > 0.9  # Should be very high for this data


def test_metrics_perfect_predictions():
    """Verify that perfect predictions yield MAE=0, RMSE=0, R2=1,
    and max_error=0."""
    from validate_model import compute_metrics

    y = np.array([10, 20, 30, 40, 50])
    metrics = compute_metrics(y, y)

    assert metrics["mae"] == 0.0
    assert metrics["rmse"] == 0.0
    assert metrics["r2"] == 1.0
    assert metrics["max_error"] == 0.0


def test_validation_pass():
    """Verify that MAE=3.0 and R2=0.85 both pass the configured
    validation gates (MAX_ACCEPTABLE_MAE=5.0, MIN_ACCEPTABLE_R2=0.7)."""
    from config import MAX_ACCEPTABLE_MAE, MIN_ACCEPTABLE_R2

    mae = 3.0
    r2 = 0.85

    assert mae <= MAX_ACCEPTABLE_MAE, "MAE of 3.0 should pass the gate"
    assert r2 >= MIN_ACCEPTABLE_R2, "R2 of 0.85 should pass the gate"


def test_validation_fail_mae():
    """Verify that MAE=6.0 exceeds the MAX_ACCEPTABLE_MAE threshold
    and would cause the validation gate to fail."""
    from config import MAX_ACCEPTABLE_MAE

    mae = 6.0
    assert mae > MAX_ACCEPTABLE_MAE, "MAE of 6.0 should exceed the threshold"


def test_validation_fail_r2():
    """Verify that R2=0.5 is below the MIN_ACCEPTABLE_R2 threshold
    and would cause the validation gate to fail."""
    from config import MIN_ACCEPTABLE_R2

    r2 = 0.5
    assert r2 < MIN_ACCEPTABLE_R2, "R2 of 0.5 should be below the threshold"


def test_validation_report_format():
    """Verify the structure of a validation report JSON: it must contain
    status, metrics, gates, test_samples, and feature_names keys, with
    gates containing mae_gate and r2_gate sub-dicts that each have
    threshold, actual, and passed fields."""
    from validate_model import compute_metrics
    from config import MAX_ACCEPTABLE_MAE, MIN_ACCEPTABLE_R2

    # Simulate producing a report in the same format as validate_model.main()
    y_true = np.array([50, 60, 70, 80, 90])
    y_pred = np.array([51, 59, 71, 79, 89])
    metrics = compute_metrics(y_true, y_pred)

    gates = {
        "mae_gate": {
            "threshold": MAX_ACCEPTABLE_MAE,
            "actual": metrics["mae"],
            "passed": metrics["mae"] <= MAX_ACCEPTABLE_MAE,
        },
        "r2_gate": {
            "threshold": MIN_ACCEPTABLE_R2,
            "actual": metrics["r2"],
            "passed": metrics["r2"] >= MIN_ACCEPTABLE_R2,
        },
    }
    all_passed = all(g["passed"] for g in gates.values())

    report = {
        "status": "PASS" if all_passed else "FAIL",
        "metrics": metrics,
        "gates": gates,
        "test_samples": len(y_true),
        "feature_names": ["feat_a", "feat_b"],
    }

    # Verify top-level keys
    assert "status" in report
    assert "metrics" in report
    assert "gates" in report
    assert "test_samples" in report
    assert "feature_names" in report

    # Verify gate structure
    for gate_name in ("mae_gate", "r2_gate"):
        gate = report["gates"][gate_name]
        assert "threshold" in gate, f"{gate_name} should have a threshold"
        assert "actual" in gate, f"{gate_name} should have an actual value"
        assert "passed" in gate, f"{gate_name} should have a passed flag"

    # Verify the report is JSON-serializable
    serialized = json.dumps(report)
    parsed = json.loads(serialized)
    assert parsed["status"] == "PASS"


def test_generate_plots_creates_file(tmp_path):
    """Verify that generate_plots creates a PNG file on disk."""
    import matplotlib
    matplotlib.use("Agg")

    from unittest.mock import patch

    with patch("validate_model.PLOTS_DIR", tmp_path):
        from validate_model import generate_plots

        y_true = np.random.rand(100) * 100
        y_pred = y_true + np.random.normal(0, 2, 100)

        plot_path = generate_plots(y_true, y_pred)
        assert Path(plot_path).exists(), "Plot file should be created"
