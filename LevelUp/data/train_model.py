"""
Train a Random Forest model on the Sleep Health & Lifestyle dataset
to predict energy levels from sleep + profile features.

Usage:
    python3 train_model.py

Output:
    ../server/analytics/model_weights.json  — exported model for JS inference

Target variable:
    energy = (Quality_of_Sleep / 9) * 55 + ((10 - Stress_Level) / 7) * 35 + (Physical_Activity / 90) * 10
    Clamped to 0–100. This creates a reasonable energy proxy from the available columns.

Features used (aligned with app's feature vector):
    - age
    - sex_numeric (Male=1, Female=0)
    - bmi_numeric (Normal=0, Overweight=1, Obese=2)
    - sleep_duration (hours)
    - quality (1–9 scale, mapped to 1–5 for app compatibility)
    - physical_activity (0–100)
    - stress (1–10)
    - heart_rate
    - systolic_bp, diastolic_bp
    - daily_steps
    - has_sleep_disorder (0 or 1)
"""

import json
import csv
import os
import sys
from collections import Counter

# ── 1. Load CSV ──
DATA_PATH = os.path.join(os.path.dirname(__file__), "Sleep_health_and_lifestyle_dataset.csv")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "server", "analytics", "model_weights.json")

print(f"Loading data from {DATA_PATH}")

rows = []
with open(DATA_PATH, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)

print(f"Loaded {len(rows)} records")

# ── 2. Feature engineering ──

def parse_bp(bp_str):
    """Parse '126/83' into (systolic, diastolic)."""
    try:
        parts = bp_str.split("/")
        return int(parts[0]), int(parts[1])
    except:
        return 120, 80

def bmi_to_num(bmi):
    bmi = bmi.strip().lower()
    if "obese" in bmi:
        return 2
    if "overweight" in bmi:
        return 1
    return 0  # Normal / Normal Weight

def compute_energy(quality, stress, activity):
    """Derive energy score (0–100) from quality, stress, activity."""
    q_contrib = (quality / 9.0) * 55      # 0–55 points
    s_contrib = ((10 - stress) / 7.0) * 35  # 0–35 points
    a_contrib = (activity / 90.0) * 10      # 0–10 points
    return max(0, min(100, round(q_contrib + s_contrib + a_contrib)))

FEATURE_NAMES = [
    "age", "sex_numeric", "bmi_numeric",
    "sleep_duration", "quality", "physical_activity",
    "stress", "heart_rate", "systolic_bp", "diastolic_bp",
    "daily_steps_k", "has_sleep_disorder"
]

X = []  # features
y = []  # target (energy)

for row in rows:
    age = int(row["Age"])
    sex_numeric = 1 if row["Gender"].strip() == "Male" else 0
    bmi_numeric = bmi_to_num(row["BMI Category"])
    sleep_duration = float(row["Sleep Duration"])
    quality = int(row["Quality of Sleep"])
    physical_activity = int(row["Physical Activity Level"])
    stress = int(row["Stress Level"])
    heart_rate = int(row["Heart Rate"])
    systolic, diastolic = parse_bp(row["Blood Pressure"])
    daily_steps_k = int(row["Daily Steps"]) / 1000.0
    has_disorder = 0 if row["Sleep Disorder"].strip() == "None" else 1

    features = [
        age, sex_numeric, bmi_numeric,
        sleep_duration, quality, physical_activity,
        stress, heart_rate, systolic, diastolic,
        daily_steps_k, has_disorder
    ]

    energy = compute_energy(quality, stress, physical_activity)

    X.append(features)
    y.append(energy)

print(f"Features: {len(FEATURE_NAMES)}, Samples: {len(X)}")
print(f"Energy stats: min={min(y)}, max={max(y)}, mean={sum(y)/len(y):.1f}")

# ── 3. Train a Decision Tree ensemble (manual implementation) ──
# Using a simple decision tree that can be exported as JSON.
# No sklearn needed — we implement a lightweight tree builder.

import random
random.seed(42)

def gini(groups, classes):
    """Gini impurity for a split."""
    total = sum(len(g) for g in groups)
    if total == 0:
        return 0
    score = 0
    for group in groups:
        size = len(group)
        if size == 0:
            continue
        # For regression, use variance reduction instead
        mean_val = sum(r[-1] for r in group) / size
        variance = sum((r[-1] - mean_val) ** 2 for r in group) / size
        score += variance * (size / total)
    return score

def mse_split(groups):
    """MSE for a regression split."""
    total = sum(len(g) for g in groups)
    if total == 0:
        return float("inf")
    score = 0
    for group in groups:
        if len(group) == 0:
            continue
        mean_val = sum(r[-1] for r in group) / len(group)
        mse = sum((r[-1] - mean_val) ** 2 for r in group) / len(group)
        score += mse * (len(group) / total)
    return score

def test_split(data, feature_idx, threshold):
    """Split data based on feature < threshold."""
    left, right = [], []
    for row in data:
        if row[feature_idx] < threshold:
            left.append(row)
        else:
            right.append(row)
    return left, right

def best_split(data, n_features, feature_indices=None):
    """Find the best split point."""
    if feature_indices is None:
        feature_indices = list(range(n_features))

    best_idx, best_thr, best_score, best_groups = None, None, float("inf"), None

    for idx in feature_indices:
        values = sorted(set(r[idx] for r in data))
        # Test midpoints between unique values
        for i in range(len(values) - 1):
            thr = (values[i] + values[i + 1]) / 2
            left, right = test_split(data, idx, thr)
            if len(left) == 0 or len(right) == 0:
                continue
            score = mse_split([left, right])
            if score < best_score:
                best_idx = idx
                best_thr = thr
                best_score = score
                best_groups = (left, right)

    return {"feature": best_idx, "threshold": best_thr, "groups": best_groups}

def leaf_value(group):
    """Leaf prediction = mean of targets."""
    return round(sum(r[-1] for r in group) / len(group), 2)

def build_tree(data, max_depth, min_size, n_features, depth=0):
    """Recursively build a decision tree."""
    # Pick random subset of features (for Random Forest)
    feature_indices = random.sample(range(n_features), min(n_features, max(3, n_features // 2)))

    split = best_split(data, n_features, feature_indices)

    if split["groups"] is None:
        return {"leaf": leaf_value(data)}

    left, right = split["groups"]

    # Check stopping conditions
    if depth >= max_depth or len(left) < min_size or len(right) < min_size:
        return {"leaf": leaf_value(data)}

    node = {
        "feature": split["feature"],
        "threshold": round(split["threshold"], 4),
    }

    node["left"] = build_tree(left, max_depth, min_size, n_features, depth + 1)
    node["right"] = build_tree(right, max_depth, min_size, n_features, depth + 1)

    return node

def predict_tree(tree, row):
    """Predict with a single tree."""
    if "leaf" in tree:
        return tree["leaf"]
    if row[tree["feature"]] < tree["threshold"]:
        return predict_tree(tree["left"], row)
    return predict_tree(tree["right"], row)

# ── 4. Train Random Forest ──

N_TREES = 15
MAX_DEPTH = 6
MIN_SIZE = 5
SAMPLE_RATIO = 0.8

print(f"\nTraining Random Forest: {N_TREES} trees, max_depth={MAX_DEPTH}")

# Combine features + target into rows
dataset = [X[i] + [y[i]] for i in range(len(X))]
n_features = len(FEATURE_NAMES)

trees = []
for t in range(N_TREES):
    # Bootstrap sample
    sample = [random.choice(dataset) for _ in range(int(len(dataset) * SAMPLE_RATIO))]
    tree = build_tree(sample, MAX_DEPTH, MIN_SIZE, n_features)
    trees.append(tree)
    print(f"  Tree {t+1}/{N_TREES} built")

# ── 5. Evaluate (in-sample, just for sanity check) ──

errors = []
for i in range(len(X)):
    preds = [predict_tree(t, X[i]) for t in trees]
    pred = sum(preds) / len(preds)
    errors.append(abs(pred - y[i]))

mae = sum(errors) / len(errors)
rmse = (sum(e**2 for e in errors) / len(errors)) ** 0.5
print(f"\nIn-sample MAE: {mae:.2f}")
print(f"In-sample RMSE: {rmse:.2f}")

# ── 6. Export model ──

model_export = {
    "type": "random_forest",
    "n_trees": N_TREES,
    "max_depth": MAX_DEPTH,
    "feature_names": FEATURE_NAMES,
    "target": "energy_score",
    "target_range": [0, 100],
    "energy_formula": "quality/9*55 + (10-stress)/7*35 + activity/90*10",
    "training_samples": len(X),
    "in_sample_mae": round(mae, 2),
    "in_sample_rmse": round(rmse, 2),
    "trees": trees,
}

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, "w") as f:
    json.dump(model_export, f, indent=None)  # compact JSON

file_size = os.path.getsize(OUTPUT_PATH)
print(f"\nModel exported to {OUTPUT_PATH} ({file_size:,} bytes)")
print(f"Feature names: {FEATURE_NAMES}")
print("Done!")
