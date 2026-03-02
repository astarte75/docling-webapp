---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-02T22:54:30Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Convertire qualsiasi documento in Markdown pulito con un semplice browser upload, rendendo accessibile la potenza di Docling senza toccare la CLI.
**Current focus:** Phase 2 — Async Job System + SSE Progress

## Current Position

Phase: 2 of 5 (Async Job System + SSE Progress) — IN PROGRESS
Plan: 1 of 4 in phase 2 — plan 02-01 complete
Status: Phase 2 in progress — 02-01 complete, async job pipeline and worker ready
Last activity: 2026-03-02 — Phase 2 Plan 01: non-blocking POST /convert + conversion_worker

Progress: [███░░░░░░░] 21%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~17 min
- Total execution time: ~47 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-backend-core-docker-foundation | 2 | ~45 min | ~22.5 min |
| 02-async-job-system-sse-progress | 1 | ~2 min | ~2 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~10 min), 01-02 (~35 min), 02-01 (~2 min)
- Trend: stable

*Updated after each plan completion*
| Phase 01-backend-core-docker-foundation P01 | 1 | 3 tasks | 4 files |
| Phase 01-backend-core-docker-foundation P02 | 2 | 3 tasks | 3 files |
| Phase 02-async-job-system-sse-progress P01 | 3 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Use `asyncio.to_thread` for v1 (not Celery) — simpler, sufficient for single-user; DoclingAdapter abstraction makes Celery upgrade contained
- [Research]: `DocumentConverter` singleton at FastAPI startup via `lifespan` — prevents per-request model reload
- [Research]: Python 3.12 (not 3.13 — free-threaded builds experimental), Tailwind 3.4 (not v4 — beta risk)
- [Phase 01-backend-core-docker-foundation]: python:3.12-slim-bookworm + CPU-only PyTorch via extra-index-url keeps image under 5GB; Docling models pre-baked at build time
- [Phase 01-backend-core-docker-foundation]: libgl1 + libglib2.0-0 mandatory system deps — Docling/OpenCV fail at import time without them
- [Phase 01-backend-core-docker-foundation]: asyncio.Lock inside DoclingAdapter serializes concurrent Docling calls — shared internal state in PDF backend
- [Phase 01-backend-core-docker-foundation]: size check via chunked 1MB read BEFORE disk write prevents disk exhaustion from oversized uploads
- [Phase 01-backend-core-docker-foundation]: custom HTTPException + RequestValidationError handlers ensure all errors return {error: ...} — never FastAPI default {detail: ...}
- [Phase 02-async-job-system-sse-progress 02-01]: conversion_worker runs as asyncio.create_task in lifespan — task reference kept on app.state._worker to prevent GC collection
- [Phase 02-async-job-system-sse-progress 02-01]: dispatch_queue.task_done() in finally block — enables join() for deterministic test synchronization
- [Phase 02-async-job-system-sse-progress 02-01]: POST handler does NOT delete temp file — worker owns lifecycle via finally block to prevent race condition

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 Risk]: `DocumentConverter` thread-safety under concurrent `asyncio.to_thread` calls — use `asyncio.Lock`; validate during Phase 1 implementation
- [Phase 1 Risk]: Docling system dependencies in Docker may be incomplete for full OCR (Tesseract, poppler-utils) — verify during Phase 1 Docker work
- [Phase 5 Risk]: SSE + nginx buffering — `X-Accel-Buffering: no` header must be tested explicitly in Phase 5

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 02-01-PLAN.md — async job pipeline and worker ready, proceeding to 02-02
Resume file: None
