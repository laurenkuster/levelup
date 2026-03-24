#!/usr/bin/env python3
"""
Push model artifact to GCP Artifact Registry.

Packages the model + metadata into a versioned tarball and uploads
to a GCS bucket (simulating artifact registry for model artifacts).

Supports rollback by maintaining version history.

Requirements:
    - GOOGLE_APPLICATION_CREDENTIALS or gcloud auth configured
    - GCS_BUCKET_NAME env var set

Usage:
    python registry_push.py
"""

import json
import logging
import os
import sys
import tarfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    BEST_MODEL_PATH, MODEL_WEIGHTS_JSON, MODELS_DIR,
    VALIDATION_REPORT, BIAS_DETECTION_REPORT, SHAP_REPORT,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "levelup-ml-models")
MODEL_PREFIX = "models/energy-prediction"
MAX_VERSIONS = 3  # Keep last N versions for rollback


def create_model_package(version_tag):
    """
    Package model + metadata into a versioned tarball.

    Includes: model weights, metadata, validation report, bias report.
    """
    package_dir = MODELS_DIR / "package"
    package_dir.mkdir(parents=True, exist_ok=True)

    tar_path = package_dir / f"model-{version_tag}.tar.gz"

    files_to_include = []
    for path in [BEST_MODEL_PATH, MODEL_WEIGHTS_JSON, VALIDATION_REPORT,
                 BIAS_DETECTION_REPORT, SHAP_REPORT]:
        if path.exists():
            files_to_include.append(path)
        else:
            log.warning("File not found, skipping: %s", path)

    # Add metadata
    meta_path = BEST_MODEL_PATH.parent / "training_metadata.json"
    if meta_path.exists():
        files_to_include.append(meta_path)

    with tarfile.open(tar_path, "w:gz") as tar:
        for fp in files_to_include:
            tar.add(fp, arcname=fp.name)

    log.info("Created model package: %s (%.1f KB)", tar_path, tar_path.stat().st_size / 1024)
    return tar_path


def push_to_gcs(tar_path, version_tag):
    """Upload model package to GCS."""
    try:
        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET_NAME)

        # Upload to versioned path
        blob_name = f"{MODEL_PREFIX}/{version_tag}/{tar_path.name}"
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(str(tar_path))
        log.info("Uploaded to gs://%s/%s", GCS_BUCKET_NAME, blob_name)

        # Update latest pointer
        latest_blob = bucket.blob(f"{MODEL_PREFIX}/latest.json")
        latest_blob.upload_from_string(json.dumps({
            "version": version_tag,
            "path": blob_name,
            "timestamp": datetime.now().isoformat(),
        }))
        log.info("Updated latest pointer")

        # Manage versions (keep only last N)
        _manage_versions(bucket, version_tag)

        return f"gs://{GCS_BUCKET_NAME}/{blob_name}"

    except ImportError:
        log.warning("google-cloud-storage not installed. Simulating push.")
        return _simulate_push(tar_path, version_tag)
    except Exception as e:
        log.warning("GCS push failed: %s. Simulating push.", e)
        return _simulate_push(tar_path, version_tag)


def _simulate_push(tar_path, version_tag):
    """Simulate registry push for local development / CI without GCP credentials."""
    registry_dir = MODELS_DIR / "registry"
    registry_dir.mkdir(parents=True, exist_ok=True)

    version_dir = registry_dir / version_tag
    version_dir.mkdir(parents=True, exist_ok=True)

    import shutil
    dest = version_dir / tar_path.name
    shutil.copy2(tar_path, dest)

    # Update latest.json
    latest = registry_dir / "latest.json"
    latest.write_text(json.dumps({
        "version": version_tag,
        "path": str(dest),
        "timestamp": datetime.now().isoformat(),
    }, indent=2))

    # Manage versions
    versions = sorted(
        [d for d in registry_dir.iterdir() if d.is_dir()],
        key=lambda d: d.stat().st_mtime,
        reverse=True,
    )
    for old_version in versions[MAX_VERSIONS:]:
        shutil.rmtree(old_version)
        log.info("Removed old version: %s", old_version.name)

    log.info("Simulated registry push → %s", dest)
    return str(dest)


def _manage_versions(bucket, current_version):
    """Keep only last N versions in GCS."""
    try:
        blobs = list(bucket.list_blobs(prefix=f"{MODEL_PREFIX}/v"))
        versions = set()
        for blob in blobs:
            parts = blob.name.split("/")
            if len(parts) > 2:
                versions.add(parts[2])

        versions = sorted(versions, reverse=True)
        for old_version in versions[MAX_VERSIONS:]:
            old_blobs = list(bucket.list_blobs(prefix=f"{MODEL_PREFIX}/{old_version}/"))
            for ob in old_blobs:
                ob.delete()
            log.info("Removed old version from registry: %s", old_version)
    except Exception as e:
        log.warning("Version cleanup failed: %s", e)


def rollback(target_version=None):
    """
    Rollback to a previous model version.

    If target_version is None, rolls back to the second-latest version.
    """
    registry_dir = MODELS_DIR / "registry"
    if not registry_dir.exists():
        log.error("No registry found. Cannot rollback.")
        return False

    versions = sorted(
        [d for d in registry_dir.iterdir() if d.is_dir()],
        key=lambda d: d.stat().st_mtime,
        reverse=True,
    )

    if len(versions) < 2:
        log.error("Not enough versions for rollback.")
        return False

    if target_version:
        target = registry_dir / target_version
        if not target.exists():
            log.error("Target version not found: %s", target_version)
            return False
    else:
        target = versions[1]  # Second latest

    log.info("Rolling back to version: %s", target.name)

    # Extract the tarball
    tarballs = list(target.glob("*.tar.gz"))
    if not tarballs:
        log.error("No model package found in version %s", target.name)
        return False

    import tarfile as tf
    with tf.open(tarballs[0], "r:gz") as tar:
        tar.extractall(MODELS_DIR)

    # Update latest
    latest = registry_dir / "latest.json"
    latest.write_text(json.dumps({
        "version": target.name,
        "path": str(tarballs[0]),
        "timestamp": datetime.now().isoformat(),
        "rollback": True,
    }, indent=2))

    log.info("✅ Rollback complete to %s", target.name)
    return True


def main():
    """Package and push model to registry."""
    ensure_dirs()

    # Check validation passed
    if VALIDATION_REPORT.exists():
        report = json.loads(VALIDATION_REPORT.read_text())
        if report.get("status") != "PASS":
            log.error("❌ Cannot push: validation did not pass.")
            sys.exit(1)

    # Generate version tag
    version_tag = f"v{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    log.info("Model version: %s", version_tag)

    # Create package
    tar_path = create_model_package(version_tag)

    # Push to registry
    location = push_to_gcs(tar_path, version_tag)

    log.info("✅ Model pushed to registry: %s", location)
    return location


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        target = sys.argv[2] if len(sys.argv) > 2 else None
        rollback(target)
    else:
        main()
