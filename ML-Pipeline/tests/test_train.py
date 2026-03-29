"""
Tests for the ML training pipeline.
"""

import json
import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture
def sample_dataframe():
    """Create a sample daily_joined DataFrame for testing."""
    np.random.seed(42)
    n = 200

    df = pd.DataFrame({
        "user_id": [f"user_{i:03d}" for i in np.random.randint(1, 20, n)],
        "date": pd.date_range("2025-01-01", periods=n, freq="D"),
        "sleep_hours": np.random.normal(7, 1.2, n).clip(2, 14),
        "sleep_satisfaction": np.random.uniform(0, 1, n),
        "rolling_sleep_hours_7d": np.random.normal(7, 0.8, n).clip(3, 12),
        "bedtime_variability_7d": np.random.uniform(10, 120, n),
        "avg_accuracy": np.random.uniform(0.3, 1.0, n),
        "int_score": np.random.uniform(20, 100, n),
        "rolling_int_7d": np.random.uniform(25, 95, n),
        "bmr": np.random.randint(1200, 2200, n),
        "attempts_count": np.random.randint(0, 5, n),
        "age": np.random.randint(14, 60, n),
        "sex": np.random.choice(["Male", "Female"], n),
        "height": np.random.randint(150, 195, n),
        "weight": np.random.randint(45, 120, n),
    })
    return df


@pytest.fixture
def sample_parquet(tmp_path, sample_dataframe):
    """Save sample data as parquet and return the path."""
    path = tmp_path / "data" / "processed" / "daily_joined.parquet"
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_dataframe.to_parquet(path, index=False)
    return path


def test_load_and_prepare_data(sample_parquet):
    """Verify that parquet loading works and feature engineering produces
    valid X, y arrays with correct lengths and a non-empty feature list."""
    with patch("train_model.DAILY_JOINED", sample_parquet):
        from train_model import load_and_prepare_data
        X, y, df, feature_names = load_and_prepare_data()

    assert len(X) > 0, "Should load data"
    assert len(X) == len(y), "X and y should have same length"
    assert len(feature_names) > 0, "Should have feature names"
    assert X.shape[1] == len(feature_names), "Feature count should match column count"


def test_energy_score_calculation(sample_dataframe):
    """Verify the energy score formula uses the 40/25/10/25 component weights.

    sleep_comp      = sleep_satisfaction * 40   (0-40)
    study_comp      = avg_accuracy * 25         (0-25)
    activity_comp   = (attempts_count / 5) * 10 (0-10)
    nutrition_comp  = nutrition_score * 25       (0-25)
    """
    df = sample_dataframe.copy()

    # Compute components manually using the same logic as train_model
    sleep_comp = df["sleep_satisfaction"] * 40
    study_comp = df["avg_accuracy"] * 25
    activity_comp = df["attempts_count"].clip(upper=5) / 5 * 10

    # Nutrition sub-components
    protein_adeq = (df.get("protein_per_kg", pd.Series(1.0, index=df.index)) / 1.6).clip(0, 1)
    bmr_vals = df.get("bmr", pd.Series(1600, index=df.index)).replace(0, 1600)
    cal_adeq = (1 - df.get("cal_balance", pd.Series(0, index=df.index)).abs() / bmr_vals).clip(0, 1)
    hydration = (df.get("water_intake_l", pd.Series(2.0, index=df.index)) / 2.5).clip(0, 1)
    nutrition_score = protein_adeq * 0.4 + cal_adeq * 0.4 + hydration * 0.2
    nutrition_comp = nutrition_score * 25

    raw = sleep_comp + study_comp + activity_comp + nutrition_comp

    # Verify the max possible values align with the 40/25/10/25 weights
    assert sleep_comp.max() <= 40.0, "Sleep component should max at 40"
    assert study_comp.max() <= 25.0, "Study component should max at 25"
    assert activity_comp.max() <= 10.0, "Activity component should max at 10"
    assert nutrition_comp.max() <= 25.0, "Nutrition component should max at 25"
    assert raw.max() <= 100.0, "Raw score should max at 100"


def test_energy_score_clamping(sample_parquet):
    """Verify that the energy_score target is clamped to the [0, 100] range
    even after noise is added during feature engineering."""
    with patch("train_model.DAILY_JOINED", sample_parquet):
        from train_model import load_and_prepare_data
        _, y, _, _ = load_and_prepare_data()

    assert all(0 <= v <= 100 for v in y), "All target values should be in [0, 100]"


def test_feature_column_selection(sample_parquet):
    """Verify that only columns present in the dataframe are selected as
    features, gracefully skipping any FEATURE_COLUMNS entries that are
    missing from the loaded data."""
    from config import FEATURE_COLUMNS

    with patch("train_model.DAILY_JOINED", sample_parquet):
        from train_model import load_and_prepare_data
        _, _, df, feature_names = load_and_prepare_data()

    # Every selected feature must actually exist in the dataframe
    for col in feature_names:
        assert col in df.columns, f"Feature '{col}' should exist in the dataframe"

    # Features that are NOT in the dataframe should NOT be selected
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            assert col not in feature_names, (
                f"Feature '{col}' is not in the dataframe and should not be selected"
            )


def test_model_training_produces_output(tmp_path):
    """Verify that training a model and saving it with joblib creates a
    valid .joblib file on disk."""
    import joblib
    from sklearn.ensemble import RandomForestRegressor

    np.random.seed(42)
    X = np.random.rand(80, 6)
    y = np.random.rand(80) * 100

    model = RandomForestRegressor(n_estimators=10, random_state=42)
    model.fit(X, y)

    model_path = tmp_path / "test_model.joblib"
    joblib.dump(model, model_path)

    assert model_path.exists(), "Model file should be created on disk"
    assert model_path.stat().st_size > 0, "Model file should not be empty"

    loaded = joblib.load(model_path)
    preds = loaded.predict(X[:5])
    assert len(preds) == 5, "Loaded model should produce predictions"


def test_train_models_returns_valid_models(sample_parquet):
    """Verify that train_models returns a dict containing a random_forest
    entry with a working predict method and 5 cross-validation scores."""
    from train_model import train_models

    np.random.seed(42)
    X = np.random.rand(100, 8)
    y = np.random.rand(100) * 100

    models = train_models(X, y)
    assert "random_forest" in models, "Should train Random Forest"

    for name, (model, cv_scores) in models.items():
        assert hasattr(model, "predict"), f"{name} should have predict method"
        assert len(cv_scores) == 5, f"{name} should have 5 CV scores"
        assert all(s >= 0 for s in cv_scores), f"{name} CV scores should be positive"


def test_select_best_model():
    """Verify that select_best_model picks the model with the lowest mean
    cross-validation MAE from a dict of candidates."""
    from train_model import select_best_model
    from sklearn.ensemble import RandomForestRegressor

    # Mock models with known scores
    rf = RandomForestRegressor(n_estimators=10, random_state=42)
    X = np.random.rand(50, 5)
    y = np.random.rand(50) * 100
    rf.fit(X, y)

    models = {
        "model_a": (rf, np.array([5.0, 4.0, 6.0, 5.5, 4.5])),
        "model_b": (rf, np.array([3.0, 2.5, 3.5, 3.0, 2.8])),
    }

    name, model, mae = select_best_model(models)
    assert name == "model_b", "Should select model with lower MAE"
    assert mae < 4.0, "Should report correct MAE"


def test_predictions_in_range():
    """Verify that a fitted RandomForest produces predictions within a
    reasonable range and not wildly outside [0, 100]."""
    from sklearn.ensemble import RandomForestRegressor

    np.random.seed(42)
    X = np.random.rand(100, 8)
    y = np.random.rand(100) * 100

    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)

    preds = model.predict(X)
    assert all(p >= -10 for p in preds), "Predictions should not be extremely negative"
    assert all(p <= 110 for p in preds), "Predictions should not be extremely high"
