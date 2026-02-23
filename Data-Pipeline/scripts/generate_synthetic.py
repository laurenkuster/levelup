#!/usr/bin/env python3
"""
Generate synthetic raw data for the Level Up data pipeline.

Produces:
  - data/raw/profiles_raw.json
  - data/raw/sleep_logs_raw.json
  - data/raw/quiz_attempts_raw.json

Schemas mirror the React Native app's AsyncStorage format.
"""

import json
import logging
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Allow running as standalone script
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import RAW_DIR, ensure_dirs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

TOPICS = ["Biology", "Chemistry", "Physics", "Math", "History", "CS", "English"]
SEXES = ["Male", "Female"]

random.seed(42)


def generate_profiles(n=50):
    """Generate n user profiles."""
    profiles = []
    for i in range(1, n + 1):
        profiles.append({
            "user_id": f"user_{i:03d}",
            "age": random.randint(14, 60),
            "sex": random.choice(SEXES),
            "height": random.randint(150, 195),
            "weight": random.randint(45, 120),
        })
    return profiles


def generate_sleep_logs(profiles, days=30):
    """Generate sleep logs for each user over `days` days."""
    logs = []
    now = datetime.now()
    for p in profiles:
        for d in range(days):
            if random.random() < 0.15:
                continue
            date = (now - timedelta(days=d)).strftime("%Y-%m-%d")
            bed_hour = random.choice([22, 23, 0, 1])
            bed_min = random.randint(0, 59)
            sleep_hours = round(random.gauss(7.0, 1.2), 2)
            sleep_hours = max(2.0, min(14.0, sleep_hours))
            wake_hour = (bed_hour + int(sleep_hours)) % 24
            wake_min = random.randint(0, 59)
            quality = random.randint(1, 5)

            logs.append({
                "id": f"{p['user_id']}_{date}",
                "user_id": p["user_id"],
                "date": date,
                "bedTime": f"{bed_hour:02d}:{bed_min:02d}",
                "wakeTime": f"{wake_hour:02d}:{wake_min:02d}",
                "sleepHours": sleep_hours,
                "quality": quality,
                "note": "",
                "createdAt": f"{date}T{wake_hour:02d}:{wake_min:02d}:00.000Z",
            })

    # Inject a few anomalies for testing
    if logs:
        logs[-1]["sleepHours"] = 16.0
        logs[-2]["sleepHours"] = 0.5
        logs[-3]["quality"] = None
    return logs


def generate_quiz_attempts(profiles, days=30):
    """Generate quiz attempts for each user."""
    attempts = []
    now = datetime.now()
    for p in profiles:
        for d in range(days):
            n_quizzes = random.choices([0, 1, 2, 3], weights=[40, 35, 15, 10])[0]
            date = now - timedelta(days=d)
            for q in range(n_quizzes):
                total = random.choice([5, 10, 15, 20])
                correct = random.randint(0, total)
                time_taken = random.randint(30, 600)

                attempts.append({
                    "id": f"{p['user_id']}_{date.strftime('%Y%m%d')}_{q}",
                    "user_id": p["user_id"],
                    "timestamp": (date + timedelta(hours=random.randint(8, 22),
                                                   minutes=random.randint(0, 59)))
                                 .isoformat(),
                    "quiz_id": f"quiz_{random.randint(1, 100)}",
                    "topic": random.choice(TOPICS),
                    "num_questions": total,
                    "num_correct": correct,
                    "total_time_seconds": time_taken,
                    "avg_time_per_question_seconds": round(time_taken / total, 2),
                    "difficulty": random.randint(1, 5),
                    "percent": round(correct / total * 100) if total > 0 else 0,
                })

    # Inject anomalies
    if attempts:
        attempts[-1]["avg_time_per_question_seconds"] = 500.0
        attempts[-2]["num_correct"] = -1
    return attempts


def main():
    ensure_dirs()

    profiles = generate_profiles(50)
    sleep = generate_sleep_logs(profiles, 30)
    quizzes = generate_quiz_attempts(profiles, 30)

    outputs = {
        "profiles_raw.json": profiles,
        "sleep_logs_raw.json": sleep,
        "quiz_attempts_raw.json": quizzes,
    }

    for fname, data in outputs.items():
        path = RAW_DIR / fname
        path.write_text(json.dumps(data, indent=2, default=str))
        log.info("Wrote %d records → %s", len(data), path)


if __name__ == "__main__":
    main()
