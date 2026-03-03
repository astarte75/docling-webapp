FROM python:3.12-slim-bookworm

# Install system dependencies required by Docling/OpenCV
# libgl1 and libglib2.0-0 are REQUIRED — without them the container fails at import time
# with "libGL.so.1: cannot open shared object file" (confirmed from official Docling Dockerfile)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Tesseract system dependencies for TesseractOcrOptions support
# MUST be installed before pip install (tesserocr links against libtesseract-dev at build time)
# build-essential provides gcc required by cysignals (tesserocr dependency)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ita \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    tesseract-ocr-spa \
    tesseract-ocr-por \
    tesseract-ocr-nld \
    tesseract-ocr-pol \
    tesseract-ocr-rus \
    tesseract-ocr-ara \
    tesseract-ocr-hin \
    tesseract-ocr-tur \
    tesseract-ocr-jpn \
    tesseract-ocr-kor \
    tesseract-ocr-chi-sim \
    libtesseract-dev \
    libleptonica-dev \
    build-essential \
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

# Pre-download RapidOCR and EasyOCR models
RUN docling-tools models download rapidocr 2>/dev/null || true
RUN docling-tools models download easyocr 2>/dev/null || true

# Set explicit model path so Docling finds pre-baked models at runtime
ENV DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models

# Limit OMP threads to avoid thread congestion in containerized environment
ENV OMP_NUM_THREADS=4

# Required by tesserocr to locate Tesseract language data files
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

COPY backend/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
