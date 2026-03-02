---
phase: 01-backend-core-docker-foundation
plan: "02"
subsystem: api
tags: [fastapi, uvicorn, docling, python, asyncio, docker]

requires:
  - phase: 01-backend-core-docker-foundation/01-01
    provides: Dockerfile, docker-compose.yml, backend/requirements.txt with FastAPI + Docling deps

provides:
  - FastAPI app with lifespan DoclingAdapter singleton
  - POST /convert endpoint accepting PDF, returning {"markdown": "..."}
  - GET /health endpoint
  - Custom error handlers ensuring {"error": "..."} response format for all errors
  - config.py with MAX_UPLOAD_SIZE_BYTES and ALLOWED_EXTENSIONS from env vars
  - adapter.py with DoclingAdapter (asyncio.Lock + asyncio.to_thread wrapper)

affects:
  - all future phases (backend API contract established)
  - Phase 2 frontend (must call POST /convert with multipart/form-data)

tech-stack:
  added:
    - asyncio.to_thread (Python 3.9+ idiom for CPU-bound work in async context)
    - asyncio.Lock (serializes concurrent Docling calls)
    - FastAPI lifespan context manager (replaces deprecated @app.on_event)
  patterns:
    - DoclingAdapter singleton stored in app.state.converter at startup
    - Chunked file read (1MB) enforces size limit BEFORE writing to disk
    - try/finally guarantees temp file deletion even on exception
    - Custom exception handlers override FastAPI default {"detail": "..."} format

key-files:
  created:
    - backend/config.py
    - backend/adapter.py
    - backend/main.py
  modified: []

key-decisions:
  - "asyncio.Lock inside DoclingAdapter serializes concurrent convert() calls — Docling PDF backend has shared internal state"
  - "asyncio.to_thread (not run_in_executor) — cleaner Python 3.9+ idiom"
  - "size check via chunked read BEFORE disk write — prevents disk exhaustion from oversized uploads"
  - "lifespan context manager (not deprecated @app.on_event) for DoclingAdapter singleton"
  - "custom HTTPException + RequestValidationError handlers ensure all errors return {\"error\": \"...\"} (never {\"detail\": \"...\"})"

patterns-established:
  - "DoclingAdapter: async wrapper isolates caller from thread-safety concerns"
  - "All API errors use {\"error\": \"...\"} format — never FastAPI default {\"detail\": \"...\"}"
  - "Temp files in /tmp with uuid4 names, always cleaned up in finally block"

requirements-completed: [CONV-01]

duration: ~5min
completed: 2026-03-02
---

# Phase 1 Plan 2: Backend API Summary

**FastAPI /convert endpoint with DoclingAdapter singleton, chunked upload validation, and guaranteed temp file cleanup — full PDF-to-Markdown conversion API**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-02T22:15:00Z
- **Completed:** 2026-03-02T22:20:00Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files created:** 3

## Accomplishments

- Created `backend/config.py` with MAX_UPLOAD_SIZE_BYTES (from MAX_UPLOAD_SIZE_MB env var) and ALLOWED_EXTENSIONS ({".pdf"})
- Created `backend/adapter.py` with DoclingAdapter: asyncio.Lock + asyncio.to_thread wrapping DocumentConverter singleton
- Created `backend/main.py` with FastAPI lifespan, custom error handlers, /health, /convert endpoints with all required status codes and {"error": "..."} format

## Task Commits

Each task was committed atomically:

1. **Task 1: Create config.py and adapter.py** - `3de8f6b` (feat)
2. **Task 2: Create main.py with /convert endpoint** - `ee2f57f` (feat)
3. **Task 3: Docker build and e2e verify** - awaiting human verification

## Files Created/Modified

- `backend/config.py` - MAX_UPLOAD_SIZE_BYTES and ALLOWED_EXTENSIONS from env vars
- `backend/adapter.py` - DoclingAdapter with async convert_file() using asyncio.Lock + asyncio.to_thread
- `backend/main.py` - FastAPI app: lifespan singleton, /health, /convert, custom error handlers

## Decisions Made

- `asyncio.Lock` inside DoclingAdapter hides thread-safety complexity from callers; correct even if Docling improves internally
- Size check via 1MB chunked read BEFORE writing to disk prevents disk exhaustion attacks
- `lifespan` context manager over deprecated `@app.on_event("startup")` (FastAPI recommendation)
- Both `HTTPException` AND `RequestValidationError` handlers needed — FastAPI uses both types internally

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Task 3 (checkpoint:human-verify):** Build the Docker image and verify end-to-end conversion:

```bash
# From project root /Users/ricky/MyProjects/docling-webapp/
docker compose up --build -d
# Wait 15-30 min for first build (Docling model download)

docker compose ps  # backend should be "Up"
curl -s http://localhost:3000/health  # expected: {"status":"ok"}

# Test 415 — non-PDF rejection
curl -s -X POST http://localhost:3000/convert -F "file=@/dev/null;filename=test.txt"
# expected: HTTP 415, {"error":"Unsupported file type. Only PDF accepted."}

# Test 413 — file too large
dd if=/dev/zero of=/tmp/big.pdf bs=1M count=51 2>/dev/null
curl -s -X POST http://localhost:3000/convert -F "file=@/tmp/big.pdf;filename=big.pdf"
# expected: HTTP 413, {"error":"File exceeds 50MB limit"}
rm /tmp/big.pdf

# Test real PDF conversion
curl -s -X POST http://localhost:3000/convert -F "file=@/path/to/your.pdf" | python3 -m json.tool
# expected: {"markdown": "# <document content>..."}

# Verify singleton (DocumentConverter appears once at startup)
docker compose logs backend | grep "DocumentConverter"

docker compose down
```

## Next Phase Readiness

- All three backend Python files created and syntactically valid
- Awaiting `docker compose up --build` validation (Task 3 checkpoint)
- After human approval, Phase 2 (frontend) can begin

---
*Phase: 01-backend-core-docker-foundation*
*Completed: 2026-03-02*
