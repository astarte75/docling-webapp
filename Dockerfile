FROM python:3.12-slim-bookworm

# Install system dependencies required by Docling/OpenCV
# libgl1 and libglib2.0-0 are REQUIRED — without them the container fails at import time
# with "libGL.so.1: cannot open shared object file" (confirmed from official Docling Dockerfile)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies with CPU-only PyTorch
# --extra-index-url is CRITICAL: without it pip pulls CUDA wheels (~8GB instead of ~1.7GB)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Pre-download Docling models at build time (INFR-02)
# This prevents 5-10 min hangs on first request
RUN docling-tools models download

# Set explicit model path so Docling finds pre-baked models at runtime
ENV DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models

# Limit OMP threads to avoid thread congestion in containerized environment
ENV OMP_NUM_THREADS=4

COPY backend/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
