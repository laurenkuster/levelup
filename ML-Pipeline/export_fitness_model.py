#!/usr/bin/env python3
"""
Export the fitness calorie burn model to JSON for on-device inference.

Usage:
    python export_fitness_model.py
"""

import json
import logging
import shutil
import sys
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import ML_DIR, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

FITNESS_MODELS_DIR = ML_DIR / "models" / "fitness"
REPO_ROOT = ML_DIR.parent
APP_ML_DIR = REPO_ROOT / "LevelUp" / "src" / "ml"


def tree_to_dict(tree, node_id=0):
    """Convert sklearn DecisionTree node to JSON-serializable dict."""
    left = tree.children_left[node_id]
    right = tree.children_right[node_id]

    if left == right:  # leaf
        return {"leaf": round(float(tree.value[node_id].flatten()[0]), 2)}

    return {
        "feature": int(tree.feature[node_id]),
        "threshold": round(float(tree.threshold[node_id]), 4),
        "left": tree_to_dict(tree, left),
        "right": tree_to_dict(tree, right),
    }


def main():
    ensure_dirs()

    model_path = FITNESS_MODELS_DIR / "fitness_model.joblib"
    meta_path = FITNESS_MODELS_DIR / "fitness_metadata.json"

    if not model_path.exists():
        log.error("Model not found: %s — run train_fitness_model.py first", model_path)
        return

    model = joblib.load(model_path)
    metadata = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    log.info("Exporting %d trees (depth %s) ...",
             len(model.estimators_),
             model.max_depth or max(e.tree_.max_depth for e in model.estimators_))

    trees = [tree_to_dict(e.tree_) for e in model.estimators_]

    weights = {
        "stat": "FITNESS",
        "type": "random_forest",
        "n_trees": len(trees),
        "max_depth": model.max_depth or max(e.tree_.max_depth for e in model.estimators_),
        "feature_names": metadata.get("feature_names", []),
        "target": metadata.get("target", "calories_burned"),
        "target_label": metadata.get("target_label", "Calories burned per session"),
        "target_range": metadata.get("target_range", [100, 3500]),
        "training_samples": metadata.get("train_samples", 0),
        "test_mae": metadata.get("test_mae", 0),
        "test_rmse": metadata.get("test_rmse", 0),
        "test_r2": metadata.get("test_r2", 0),
        "trees": trees,
    }

    # Save to ML-Pipeline
    out_path = FITNESS_MODELS_DIR / "fitness_weights.json"
    out_path.write_text(json.dumps(weights))
    size_kb = out_path.stat().st_size / 1024
    log.info("Saved %s (%.0f KB, %d trees)", out_path, size_kb, len(trees))

    # Copy to app
    APP_ML_DIR.mkdir(parents=True, exist_ok=True)
    dst = APP_ML_DIR / "fitness_weights.json"
    shutil.copy2(out_path, dst)
    log.info("Copied → %s", dst)

    log.info("Export complete!")


if __name__ == "__main__":
    main()
