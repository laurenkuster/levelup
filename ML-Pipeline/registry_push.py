#!/usr/bin/env python3
"""
Push model artifact to Firebase Storage (GCS-backed).

Packages the model + metadata into a versioned tarball and uploads
to Firebase Storage under the project's storage bucket.

Supports rollback by maintaining version history.

Requirements:
    - Firebase credentials via .env or environment variables

Usage:
    python registry_push.py
    python registry_push.py rollback [version]
"""

import json
import logging
import os
import sys
import tarfile
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    BEST_MODEL_PATH, MODEL_WEIGHTS_JSON, MODELS_DIR,
    VALIDATION_REPORT, BIAS_DETECTION_REPORT, SHAP_REPORT,
    ensure_dirs,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Firebase config (loaded from .env) ──
ENV_PATH = Path(__file__).resolve().parent.parent / "LevelUp" / ".env"
MODEL_PREFIX = "ml-models/energy-prediction"
MAX_VERSIONS = 3


def load_firebase_config():
    """Load Firebase config from .env file."""
    config = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                config[key.strip()] = val.strip().strip('"').strip("'")

    # Also check environment variables (for CI/CD)
    for key in ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", "EXPO_PUBLIC_FIREBASE_API_KEY",
                 "EXPO_PUBLIC_FIREBASE_PROJECT_ID"]:
        env_val = os.environ.get(key)
        if env_val:
            config[key] = env_val

    return config


def create_model_package(version_tag):
    """Package model + metadata into a versioned tarball."""
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

    meta_path = BEST_MODEL_PATH.parent / "training_metadata.json"
    if meta_path.exists():
        files_to_include.append(meta_path)

    with tarfile.open(tar_path, "w:gz") as tar:
        for fp in files_to_include:
            tar.add(fp, arcname=fp.name)

    log.info("Created model package: %s (%.1f KB)", tar_path, tar_path.stat().st_size / 1024)
    return tar_path


def push_to_firebase(tar_path, version_tag):
    """Upload model package to Firebase Storage via REST API."""
    import requests

    config = load_firebase_config()
    bucket = config.get("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET")
    api_key = config.get("EXPO_PUBLIC_FIREBASE_API_KEY")

    project_id = config.get("EXPO_PUBLIC_FIREBASE_PROJECT_ID")

    if not bucket or not api_key:
        log.warning("Firebase credentials not found. Falling back to local registry.")
        return _save_locally(tar_path, version_tag)

    # Firebase Storage API uses the .appspot.com bucket for the REST endpoint
    # even when the storage bucket is configured as .firebasestorage.app
    api_bucket = bucket
    if bucket.endswith(".firebasestorage.app") and project_id:
        api_bucket = f"{project_id}.appspot.com"
        log.info("Converted bucket for API: %s → %s", bucket, api_bucket)

    log.info("Uploading to Firebase Storage bucket: %s", api_bucket)

    # ── Upload model tarball ──
    object_path = f"{MODEL_PREFIX}/{version_tag}/{tar_path.name}"
    upload_url = (
        f"https://firebasestorage.googleapis.com/v0/b/{api_bucket}/o"
        f"?uploadType=media&name={quote(object_path, safe='')}"
    )

    with open(tar_path, "rb") as f:
        resp = requests.post(
            upload_url,
            headers={"Content-Type": "application/gzip"},
            params={"key": api_key},
            data=f,
            timeout=120,
        )

    if resp.status_code in (200, 201):
        download_token = resp.json().get("downloadTokens", "")
        download_url = (
            f"https://firebasestorage.googleapis.com/v0/b/{api_bucket}"
            f"/o/{quote(object_path, safe='')}?alt=media&token={download_token}"
        )
        log.info("✅ Uploaded model: %s", download_url)
    else:
        log.warning("Firebase upload returned %d: %s", resp.status_code, resp.text)
        log.info("Falling back to local registry.")
        return _save_locally(tar_path, version_tag)

    # ── Upload model_weights.json directly (for app to fetch) ──
    if MODEL_WEIGHTS_JSON.exists():
        weights_path = f"{MODEL_PREFIX}/latest/model_weights.json"
        weights_url = (
            f"https://firebasestorage.googleapis.com/v0/b/{api_bucket}/o"
            f"?uploadType=media&name={quote(weights_path, safe='')}"
        )
        with open(MODEL_WEIGHTS_JSON, "rb") as f:
            resp2 = requests.post(
                weights_url,
                headers={"Content-Type": "application/json"},
                params={"key": api_key},
                data=f,
                timeout=60,
            )
        if resp2.status_code in (200, 201):
            log.info("✅ Uploaded latest model_weights.json")
        else:
            log.warning("model_weights.json upload returned %d", resp2.status_code)

    # ── Upload version manifest ──
    manifest = {
        "version": version_tag,
        "path": object_path,
        "timestamp": datetime.now().isoformat(),
        "bucket": bucket,
    }

    # Load existing manifest to track versions
    manifest_path = f"{MODEL_PREFIX}/manifest.json"
    manifest_url = (
        f"https://firebasestorage.googleapis.com/v0/b/{api_bucket}/o"
        f"?uploadType=media&name={quote(manifest_path, safe='')}"
    )

    # Build version list
    versions_file = MODELS_DIR / "versions.json"
    if versions_file.exists():
        versions = json.loads(versions_file.read_text())
    else:
        versions = []
    versions.insert(0, manifest)
    versions = versions[:MAX_VERSIONS]

    manifest_data = json.dumps({"latest": version_tag, "versions": versions}, indent=2)

    resp3 = requests.post(
        manifest_url,
        headers={"Content-Type": "application/json"},
        params={"key": api_key},
        data=manifest_data.encode(),
        timeout=30,
    )
    if resp3.status_code in (200, 201):
        log.info("✅ Updated version manifest")

    # Save versions locally too
    versions_file.write_text(json.dumps(versions, indent=2))

    # Also save locally as backup
    _save_locally(tar_path, version_tag)

    return download_url


def _save_locally(tar_path, version_tag):
    """Save model to local registry as fallback."""
    registry_dir = MODELS_DIR / "registry"
    version_dir = registry_dir / version_tag
    version_dir.mkdir(parents=True, exist_ok=True)

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

    log.info("Saved to local registry → %s", dest)
    return str(dest)


def rollback(target_version=None):
    """Rollback to a previous model version."""
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

    target = None
    if target_version:
        target = registry_dir / target_version
        if not target.exists():
            log.error("Target version not found: %s", target_version)
            return False
    else:
        target = versions[1]

    log.info("Rolling back to version: %s", target.name)

    tarballs = list(target.glob("*.tar.gz"))
    if not tarballs:
        log.error("No model package found in version %s", target.name)
        return False

    with tarfile.open(tarballs[0], "r:gz") as tar:
        tar.extractall(MODELS_DIR)

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

    version_tag = f"v{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    log.info("Model version: %s", version_tag)

    tar_path = create_model_package(version_tag)
    location = push_to_firebase(tar_path, version_tag)

    log.info("✅ Model pushed to registry: %s", location)
    return location


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        target = sys.argv[2] if len(sys.argv) > 2 else None
        rollback(target)
    else:
        main()
