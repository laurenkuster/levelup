#!/usr/bin/env python3
"""
Run the full STR ML pipeline end-to-end.

Steps:
  1. Download datasets (OpenPowerlifting + 721 Workouts)
  2. Compute strength standards (percentile lookup table)
  3. Train progression prediction model

Usage:
    python run_pipeline.py           # Run all steps
    python run_pipeline.py --step 1  # Download only
    python run_pipeline.py --step 2  # Standards only
    python run_pipeline.py --step 3  # Train only
"""

import argparse
import logging
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

PIPELINE_DIR = Path(__file__).resolve().parent


def run_step(script_name, args=None):
    """Run a pipeline script."""
    script = PIPELINE_DIR / script_name
    cmd = [sys.executable, str(script)] + (args or [])
    log.info("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode != 0:
        log.error("Step failed: %s (exit code %d)", script_name, result.returncode)
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Run STR ML pipeline")
    parser.add_argument("--step", type=int, choices=[1, 2, 3], help="Run specific step only")
    args = parser.parse_args()

    steps = {
        1: ("download_data.py", ["--all"], "Download datasets"),
        2: ("compute_standards.py", [], "Compute strength standards"),
        3: ("train_progression.py", [], "Train progression model"),
    }

    if args.step:
        script, script_args, desc = steps[args.step]
        log.info("Step %d: %s", args.step, desc)
        run_step(script, script_args)
    else:
        for step_num, (script, script_args, desc) in steps.items():
            log.info("=" * 50)
            log.info("Step %d: %s", step_num, desc)
            log.info("=" * 50)
            success = run_step(script, script_args)
            if not success and step_num < 3:
                log.warning("Step %d failed, subsequent steps may also fail.", step_num)

    log.info("Pipeline complete!")


if __name__ == "__main__":
    main()
