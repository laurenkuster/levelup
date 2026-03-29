"""
Tests for model export to JSON format.

Validates the tree_to_dict conversion and the overall export_random_forest
JSON schema used by the app's JavaScript inference engine.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest
from sklearn.ensemble import RandomForestRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from export_model import tree_to_dict, export_random_forest


@pytest.fixture
def trained_rf():
    """Train a small RandomForest model for export tests."""
    np.random.seed(42)
    X = np.random.rand(60, 4)
    y = np.random.rand(60) * 100
    model = RandomForestRegressor(n_estimators=3, max_depth=3, random_state=42)
    model.fit(X, y)
    return model


def test_tree_to_dict_leaf():
    """Verify that a leaf node (where left_child == right_child == TREE_LEAF)
    is converted to a dict with a single 'leaf' key containing the
    rounded prediction value."""
    # Train a depth-1 tree so we can find leaf nodes easily
    np.random.seed(0)
    X = np.random.rand(20, 2)
    y = np.random.rand(20) * 50
    model = RandomForestRegressor(n_estimators=1, max_depth=1, random_state=0)
    model.fit(X, y)

    tree = model.estimators_[0].tree_

    # Find a leaf node: left_child == right_child (both -1)
    leaf_ids = [
        i for i in range(tree.node_count)
        if tree.children_left[i] == tree.children_right[i]
    ]
    assert len(leaf_ids) > 0, "A max_depth=1 tree must have leaf nodes"

    result = tree_to_dict(tree, leaf_ids[0])

    assert "leaf" in result, "Leaf node dict must contain 'leaf' key"
    assert isinstance(result["leaf"], float), "Leaf value should be a float"
    assert len(result) == 1, "Leaf node dict should have exactly one key"


def test_tree_to_dict_split():
    """Verify that a split (internal) node is converted to a dict with
    'feature', 'threshold', 'left', and 'right' keys, where left and
    right are themselves valid node dicts."""
    np.random.seed(1)
    X = np.random.rand(30, 3)
    y = np.random.rand(30) * 80
    model = RandomForestRegressor(n_estimators=1, max_depth=2, random_state=1)
    model.fit(X, y)

    tree = model.estimators_[0].tree_

    # The root (node 0) should be a split node for a depth-2 tree
    result = tree_to_dict(tree, 0)

    assert "feature" in result, "Split node must have 'feature' key"
    assert "threshold" in result, "Split node must have 'threshold' key"
    assert "left" in result, "Split node must have 'left' child"
    assert "right" in result, "Split node must have 'right' child"
    assert isinstance(result["feature"], int), "Feature index should be an int"
    assert isinstance(result["threshold"], float), "Threshold should be a float"

    # Children should be valid node dicts (either leaf or split)
    for child_key in ("left", "right"):
        child = result[child_key]
        assert isinstance(child, dict), f"{child_key} child should be a dict"
        has_leaf = "leaf" in child
        has_split = "feature" in child and "threshold" in child
        assert has_leaf or has_split, (
            f"{child_key} child must be either a leaf or split node"
        )


def test_export_random_forest_structure(trained_rf):
    """Verify that export_random_forest produces a JSON-serializable dict
    with the required schema: type, n_trees, trees, and feature_names.
    Also verify that n_trees matches the actual tree count and that
    each tree entry is a valid node dict."""
    feature_names = ["feat_a", "feat_b", "feat_c", "feat_d"]
    metadata = {
        "train_samples": 60,
        "test_mae": 4.5,
        "test_rmse": 5.2,
    }

    weights = export_random_forest(trained_rf, feature_names, metadata)

    # Top-level schema keys
    assert weights["type"] == "random_forest", "Type should be 'random_forest'"
    assert "n_trees" in weights, "Must include n_trees"
    assert "trees" in weights, "Must include trees list"
    assert "feature_names" in weights, "Must include feature_names"
    assert "target" in weights, "Must include target field"
    assert "target_range" in weights, "Must include target_range"

    # Values consistency
    assert weights["n_trees"] == len(weights["trees"]), (
        "n_trees should match actual number of tree dicts"
    )
    assert weights["n_trees"] == 3, "Fixture model has 3 estimators"
    assert weights["feature_names"] == feature_names
    assert weights["target_range"] == [0, 100]

    # Each tree should be a valid node dict
    for i, tree in enumerate(weights["trees"]):
        assert isinstance(tree, dict), f"Tree {i} should be a dict"
        has_leaf = "leaf" in tree
        has_split = "feature" in tree and "threshold" in tree
        assert has_leaf or has_split, f"Tree {i} root must be a leaf or split"

    # Verify JSON round-trip
    serialized = json.dumps(weights)
    parsed = json.loads(serialized)
    assert parsed["type"] == "random_forest"
    assert len(parsed["trees"]) == 3
