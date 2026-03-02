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

duration: ~35min (includes 30min Docker build + model download)
completed: 2026-03-02
---

# Phase 1 Plan 2: Backend API Summary

**FastAPI /convert endpoint with DoclingAdapter singleton, chunked upload validation, and guaranteed temp file cleanup — full PDF-to-Markdown conversion API**

## Performance

- **Duration:** ~35 min (includes 30min Docker build + Docling model download on first build)
- **Started:** 2026-03-02T22:15:00Z
- **Completed:** 2026-03-02T23:00:00Z
- **Tasks:** 3 of 3 (all complete, including human-verify checkpoint)
- **Files created:** 3

## Accomplishments

- Created `backend/config.py` with MAX_UPLOAD_SIZE_BYTES (from MAX_UPLOAD_SIZE_MB env var) and ALLOWED_EXTENSIONS ({".pdf"})
- Created `backend/adapter.py` with DoclingAdapter: asyncio.Lock + asyncio.to_thread wrapping DocumentConverter singleton
- Created `backend/main.py` with FastAPI lifespan, custom error handlers, /health, /convert endpoints with all required status codes and {"error": "..."} format

## Task Commits

Each task was committed atomically:

1. **Task 1: Create config.py and adapter.py** - `3de8f6b` (feat)
2. **Task 2: Create main.py with /convert endpoint** - `ee2f57f` (feat)
3. **Task 3: Docker build and e2e verify** - approved by user (all 7 checks passed)

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

## End-to-End Verification (Task 3 — Human Approved)

All 7 checks passed and approved by user:

1. Docker build completed successfully
2. Container running (backend "Up")
3. GET /health returns `{"status":"ok"}`
4. POST /convert with `.txt` file returns HTTP 415 `{"error":"Unsupported file type. Only PDF accepted."}`
5. POST /convert with 51MB fake PDF returns HTTP 413 `{"error":"File exceeds 50MB limit"}`
6. POST /convert with real PDF returns HTTP 200 `{"markdown":"..."}`
7. Docker logs show "Initializing DocumentConverter" exactly once at startup (singleton confirmed)

## Next Phase Readiness

- All three backend Python files created, syntactically valid, and verified in Docker
- Docker image built with Docling models pre-baked (no download on first request)
- Phase 2 (Async Job System + SSE Progress) can begin

---
*Phase: 01-backend-core-docker-foundation*
*Completed: 2026-03-02*
