import argparse
import logging
from pathlib import Path
import requests
import tarfile

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
URL = "http://data.vision.ee.ethz.ch/cvl/food-101.tar.gz"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw_dir", default="Data-Pipeline/data/raw", type=str)
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    tar_path = raw_dir / "food-101.tar.gz"
    extracted_root = raw_dir / "food-101"
    marker = extracted_root / "meta" / "train.txt"

    if not tar_path.exists():
        logging.info("Downloading Food-101 tarball...")
        r = requests.get(URL, stream=True, timeout=120)
        r.raise_for_status()
        with open(tar_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    else:
        logging.info("Tarball already exists: %s", tar_path)

    if not marker.exists():
        logging.info("Extracting tarball...")
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(path=raw_dir)
    else:
        logging.info("Already extracted: %s", marker)

    logging.info("Food-101 ready at: %s", extracted_root)

if __name__ == "__main__":
    main()