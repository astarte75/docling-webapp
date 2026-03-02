---
phase: 01-backend-core-docker-foundation
plan: "01"
subsystem: infra
tags: [docker, python, docling, fastapi, uvicorn, pytorch-cpu]

requires: []
provides:
  - Dockerfile with python:3.12-slim-bookworm, CPU-only PyTorch, pre-baked Docling models
  - docker-compose.yml with configurable PORT (default 3000) mapping to container port 8000
  - backend/requirements.txt with FastAPI + Docling dependencies
  - .env.example documenting all configurable env vars
affects:
  - 01-02-backend-api (backend code must match WORKDIR /app and CMD uvicorn main:app)
  - all future phases (Docker foundation is shared infrastructure)

tech-stack:
  added:
    - python:3.12-slim-bookworm (base image)
    - docling (document conversion library)
    - fastapi + uvicorn[standard] (ASGI web framework)
    - python-multipart (file upload support)
    - pytorch CPU-only wheels (via download.pytorch.org/whl/cpu)
  patterns:
    - Models baked at build time via docling-tools models download (no runtime downloads)
    - CPU-only PyTorch via --extra-index-url (avoids 8GB CUDA wheels)
    - Host port configurable via PORT env var, container always on 8000

key-files:
  created:
    - Dockerfile
    - docker-compose.yml
    - .env.example
    - backend/requirements.txt
  modified: []

key-decisions:
  - "python:3.12-slim-bookworm chosen (not 3.11 or 3.13 — 3.13 free-threaded builds are experimental)"
  - "libgl1 + libglib2.0-0 mandatory — Docling/OpenCV fail at import without them"
  - "CPU-only PyTorch via --extra-index-url keeps image under 5GB vs ~8GB with CUDA wheels"
  - "Models pre-baked via docling-tools models download — prevents 5-10min hang on first request"

patterns-established:
  - "Dockerfile at project root, backend/ subdirectory for Python code (COPY backend/ . into /app)"
  - "Port mapping: ${PORT:-3000}:8000 — configurable host, fixed container port"

requirements-completed: [INFR-01, INFR-02, INFR-03]

duration: 1min
completed: 2026-03-02
---

# Phase 1 Plan 1: Docker Foundation Summary

**Dockerfile with python:3.12-slim-bookworm, CPU-only PyTorch (~1.7GB vs 8GB CUDA), pre-baked Docling models, and single-command `docker compose up` startup on configurable PORT**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-02T22:09:58Z
- **Completed:** 2026-03-02T22:10:54Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- Created `backend/requirements.txt` with FastAPI, uvicorn, python-multipart, and docling — no pinned versions to allow pip to resolve CPU-only PyTorch compatibility
- Created `Dockerfile` with all required constraints: python:3.12-slim-bookworm base, libgl1 + libglib2.0-0 system deps, CPU-only PyTorch index URL, pre-baked Docling models, DOCLING_ARTIFACTS_PATH and OMP_NUM_THREADS env vars
- Created `docker-compose.yml` with configurable PORT (default 3000), MAX_UPLOAD_SIZE_MB (default 50), and `restart: unless-stopped`; created `.env.example` documenting all env vars

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backend/requirements.txt** - `6ae0656` (chore)
2. **Task 2: Create Dockerfile** - `fa2fb25` (feat)
3. **Task 3: Create docker-compose.yml and .env.example** - `e6ad726` (feat)

## Files Created/Modified

- `backend/requirements.txt` - Python dependencies: fastapi, uvicorn[standard], python-multipart, docling
- `Dockerfile` - Container definition with CPU-only PyTorch and pre-baked Docling models
- `docker-compose.yml` - Single-command startup with configurable PORT env var
- `.env.example` - Template documenting PORT and MAX_UPLOAD_SIZE_MB

## Decisions Made

- `libgl1` and `libglib2.0-0` must be installed as system deps — Docling/OpenCV fail at import time without them (confirmed from official Docling Dockerfile)
- `--extra-index-url https://download.pytorch.org/whl/cpu` on pip install RUN step keeps image well under 5GB; CUDA wheels would push it to ~8GB
- `docling-tools models download` is a separate RUN step after pip install so Docker layer caching works correctly — model layer is cached independently
- `DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models` set explicitly so Docling finds pre-baked models at runtime
- `docker build` is NOT run in this plan — the image build (10-20min due to model download) is validated in Plan 01-02 after backend code exists

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The backend Python code (`main.py`) will be added in Plan 01-02, at which point the image can be built.

## Next Phase Readiness

- Docker foundation complete: Dockerfile, docker-compose.yml, backend/requirements.txt, .env.example all present
- Plan 01-02 will create `backend/main.py` (FastAPI app) and validate the full `docker build` + `docker compose up` flow
- The `COPY backend/ .` instruction expects `backend/main.py` to exist at build time — Plan 01-02 provides this

---
*Phase: 01-backend-core-docker-foundation*
*Completed: 2026-03-02*
