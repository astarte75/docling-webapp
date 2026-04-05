# Docling Webapp

Web application for document conversion to Markdown using IBM Docling.

## Architecture

- **Backend**: FastAPI (Python 3.12) — `backend/`
  - `main.py` — FastAPI app, endpoints, SSE streaming
  - `adapter.py` — DoclingAdapter wrapper, OCR engine mapping, pipeline options
  - `config.py` — env-based config (MAX_UPLOAD_SIZE_MB, MAX_CONCURRENT_JOBS)
  - `job_store.py` — async job queue and conversion worker
- **Frontend**: React + TypeScript + Vite + Tailwind CSS — `frontend/`
- **Reverse proxy**: nginx (serves frontend, proxies `/api` to backend)

## Docker Compose Files

| File | Purpose | Command |
|------|---------|---------|
| `docker-compose.yml` | Production — pulls pre-built images from DockerHub | `docker compose up -d` |
| `docker-compose.build.yml` | Build from source | `docker compose -f docker-compose.build.yml up --build -d` |
| `docker-compose.dev.yml` | Dev override (hot-reload, volume mount, port 8000) | Use with build: `-f docker-compose.build.yml -f docker-compose.dev.yml up` |

## DockerHub Images

- `ricky75/docling-webapp-backend:latest`
- `ricky75/docling-webapp-frontend:latest`
- Multi-arch build (amd64/arm64): `make push` or `make push TAG=v1.x`
- **IMPORTANT**: After pushing, always verify both architectures are pullable:
  ```bash
  docker manifest inspect ricky75/docling-webapp-backend:latest
  docker manifest inspect ricky75/docling-webapp-frontend:latest
  ```

## OCR Engines

Installed: **EasyOCR**, **RapidOCR** (rapidocr-onnxruntime), **Tesseract** (tesserocr + 15 language packs).
Auto-selection via Docling's `OcrAutoOptions`. Engine choice exposed in UI.

## Key Conventions

- Backend dependencies in `backend/requirements.txt` (floor-pinned)
- Docling models pre-downloaded at Docker build time (`docling-tools models download`)
- PyTorch CPU-only (`--extra-index-url https://download.pytorch.org/whl/cpu`)
- `DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models`
- Supported formats: PDF, DOCX, PPTX, XLSX, HTML, Markdown

## Development

```bash
# Local dev with hot-reload
docker compose -f docker-compose.build.yml -f docker-compose.dev.yml up

# Run backend tests
docker compose exec backend pytest

# Rebuild after dependency changes
docker compose -f docker-compose.build.yml build --no-cache backend
```
