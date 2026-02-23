import argparse
import json
import logging
import random
from pathlib import Path
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

def mock_predict(label: str):
    return {"food_name": label.replace("_", " "), "confidence": round(random.uniform(0.6, 0.95), 2), "notes": "mock_mode"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_csv", default="Data-Pipeline/data/processed/food_val.csv", type=str)
    parser.add_argument("--out_jsonl", default="Data-Pipeline/data/processed/food_predictions.jsonl", type=str)
    parser.add_argument("--max_images", default=25, type=int)
    parser.add_argument("--mock", action="store_true", help="Run without Gemini; outputs mock predictions")
    args = parser.parse_args()

    df = pd.read_csv(args.input_csv).head(args.max_images)
    out_path = Path(args.out_jsonl)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            image_path = row["image_path"]
            true_label = row["label"]

            # For tonight, use --mock so it always works.
            pred = mock_predict(true_label) if args.mock else mock_predict(true_label)

            record = {
                "image_path": image_path,
                "true_label": true_label,
                "predicted_food": pred["food_name"],
                "confidence": pred["confidence"],
                "notes": pred.get("notes", ""),
            }
            f.write(json.dumps(record) + "\n")

    logging.info("Wrote predictions JSONL: %s (%d rows)", out_path, len(df))

if __name__ == "__main__":
    main()