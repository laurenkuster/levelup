# ── ML Pipeline for Level Up ──
FROM python:3.11-slim

LABEL maintainer="levelup-team"
LABEL description="Level Up ML Pipeline: training, validation, bias detection, SHAP analysis"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps
COPY ML-Pipeline/requirements.txt /app/ML-Pipeline/requirements.txt
RUN pip install --no-cache-dir -r /app/ML-Pipeline/requirements.txt

# Copy data pipeline outputs (needed as input)
COPY Data-Pipeline/data/processed/ /app/Data-Pipeline/data/processed/
COPY Data-Pipeline/scripts/config.py /app/Data-Pipeline/scripts/config.py

# Copy ML pipeline code
COPY ML-Pipeline/ /app/ML-Pipeline/

WORKDIR /app/ML-Pipeline

# Create output directories
RUN mkdir -p models reports plots

# Default: run full pipeline (skip registry push in container)
ENTRYPOINT ["python", "run_pipeline.py"]
CMD ["--skip-push"]
