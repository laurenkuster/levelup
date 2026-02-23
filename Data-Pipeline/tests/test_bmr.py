"""Tests for BMR computation."""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from build_features import compute_bmr


class TestBMR:
    def test_male(self):
        bmr = compute_bmr(age=25, sex="Male", height_cm=175, weight_kg=70)
        # 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
        assert bmr == 1674

    def test_female(self):
        bmr = compute_bmr(age=30, sex="Female", height_cm=165, weight_kg=60)
        # 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
        assert bmr == 1320

    def test_plausible_range(self):
        """BMR should be between 800 and 3000 for reasonable inputs."""
        for age in [15, 25, 40, 60]:
            for sex in ["Male", "Female"]:
                bmr = compute_bmr(age=age, sex=sex, height_cm=170, weight_kg=70)
                assert 800 <= bmr <= 3000, f"BMR {bmr} out of range for age={age}, sex={sex}"

    def test_invalid_inputs(self):
        result = compute_bmr(age="invalid", sex="Male", height_cm=170, weight_kg=70)
        assert result is None

    def test_none_inputs(self):
        result = compute_bmr(age=None, sex=None, height_cm=None, weight_kg=None)
        assert result is None
