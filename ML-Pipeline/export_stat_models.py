#!/usr/bin/env python3
"""
Export trained stat models (STR, SPD, STM, DEX) to JSON for on-device inference.

Converts sklearn Random Forest → nested JSON tree format, same as
the energy model export. Each stat gets its own JSON file, then all
are bundled into a single stat_models.json for the app.

Usage:
    python export_stat_models.py [--stat STR|SPD|STM|DEX|all]
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

STAT_MODELS_DIR = ML_DIR / "models" / "stats"
REPO_ROOT = ML_DIR.parent
APP_ML_DIR = REPO_ROOT / "LevelUp" / "src" / "ml"

STATS = ["STR", "SPD", "STM", "DEX"]


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


def export_stat(stat):
    """Export one stat model to JSON."""
    model_path = STAT_MODELS_DIR / f"{stat.lower()}_model.joblib"
    meta_path = STAT_MODELS_DIR / f"{stat.lower()}_metadata.json"

    if not model_path.exists():
        log.warning("[%s] Model not found: %s", stat, model_path)
        return None

    model = joblib.load(model_path)
    metadata = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    log.info("[%s] Exporting %d trees (depth %s) ...",
             stat, len(model.estimators_),
             model.max_depth or max(e.tree_.max_depth for e in model.estimators_))

    trees = [tree_to_dict(e.tree_) for e in model.estimators_]

    weights = {
        "stat": stat,
        "type": "random_forest",
        "n_trees": len(trees),
        "max_depth": model.max_depth or max(e.tree_.max_depth for e in model.estimators_),
        "feature_names": metadata.get("feature_names", []),
        "target": metadata.get("target", "unknown"),
        "target_label": metadata.get("target_label", ""),
        "target_range": metadata.get("target_range", [0, 100]),
        "training_samples": metadata.get("train_samples", 0),
        "test_mae": metadata.get("test_mae", 0),
        "test_rmse": metadata.get("test_rmse", 0),
        "test_r2": metadata.get("test_r2", 0),
        "trees": trees,
    }

    # Save individual stat JSON
    out_path = STAT_MODELS_DIR / f"{stat.lower()}_weights.json"
    out_path.write_text(json.dumps(weights))
    size_kb = out_path.stat().st_size / 1024
    log.info("[%s] Saved %s (%.0f KB, %d trees)", stat, out_path, size_kb, len(trees))

    return weights


def main():
    ensure_dirs()
    STAT_MODELS_DIR.mkdir(parents=True, exist_ok=True)

    target = "all"
    if len(sys.argv) > 1:
        if sys.argv[1] == "--stat" and len(sys.argv) > 2:
            target = sys.argv[2].upper()
        else:
            target = sys.argv[1].upper()

    stats = STATS if target == "ALL" else [target]

    all_weights = {}
    for stat in stats:
        if stat not in STATS:
            log.error("Unknown stat: %s", stat)
            continue
        w = export_stat(stat)
        if w:
            all_weights[stat] = w

    if not all_weights:
        log.error("No models exported")
        return

    # Bundle all into one file for the app
    bundle = {
        "version": 1,
        "models": {},
    }
    for stat, w in all_weights.items():
        bundle["models"][stat] = w

    bundle_path = STAT_MODELS_DIR / "stat_models_bundle.json"
    bundle_path.write_text(json.dumps(bundle))
    bundle_size_kb = bundle_path.stat().st_size / 1024
    log.info("Bundle: %s (%.0f KB)", bundle_path, bundle_size_kb)

    # Copy to app
    APP_ML_DIR.mkdir(parents=True, exist_ok=True)

    # Copy individual stat weights to app
    for stat in all_weights:
        src = STAT_MODELS_DIR / f"{stat.lower()}_weights.json"
        dst = APP_ML_DIR / f"{stat.lower()}_weights.json"
        shutil.copy2(src, dst)
        log.info("Copied %s → %s", src.name, dst)

    # Copy bundle
    bundle_dst = APP_ML_DIR / "stat_models_bundle.json"
    shutil.copy2(bundle_path, bundle_dst)
    log.info("Copied bundle → %s", bundle_dst)

    log.info("Export complete: %s", list(all_weights.keys()))


if __name__ == "__main__":
    main()
