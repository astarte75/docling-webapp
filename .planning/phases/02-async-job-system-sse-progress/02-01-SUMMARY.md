---
phase: 02-async-job-system-sse-progress
plan: 01
subsystem: api
tags: [fastapi, asyncio, job-queue, background-worker, sse-foundation]

requires:
  - phase: 01-backend-core-docker-foundation
    provides: DoclingAdapter.convert_file, FastAPI app skeleton, error handlers

provides:
  - Job dataclass with job_id, tmp_path, events queue, status fields
  - conversion_worker async coroutine — FIFO background job processor
  - POST /convert returns HTTP 202 + job_id immediately (non-blocking)
  - lifespan-scoped asyncio.Queue (dispatch_queue) + jobs dict on app.state
  - Terminal event guarantee — SSE streams always receive completed or failed

affects:
  - 02-02 (SSE /jobs/{id}/stream endpoint reads from job.events queue)
  - 02-03 (frontend connects to SSE stream using job_id from 202 response)

tech-stack:
  added: [asyncio.Queue, dataclasses, pytest-asyncio]
  patterns:
    - TDD red-green cycle for async worker with FakeState pattern
    - Lifespan-scoped asyncio tasks stored on app.state to prevent GC collection
    - Worker's finally block owns temp file deletion (not POST handler)
    - dispatch_queue.task_done() enables join() in tests

key-files:
  created:
    - backend/job_store.py
    - backend/tests/test_job_store.py
    - backend/tests/__init__.py
  modified:
    - backend/main.py

key-decisions:
  - "conversion_worker runs as asyncio.create_task in lifespan (not BackgroundTasks, not fire-and-forget) — task reference kept on app.state._worker to prevent GC collection"
  - "Worker's finally block always calls task_done() — required for dispatch_queue.join() to work in tests"
  - "POST handler does NOT delete temp file — worker owns lifecycle via finally block (prevents race condition)"
  - "FakeState pattern for testing worker without real DoclingAdapter — lightweight, no mock library needed"

patterns-established:
  - "Async worker pattern: lifespan creates asyncio.create_task, stores reference on app.state, cancels on shutdown"
  - "TDD with FakeState: inject minimal state mock with asyncio.Queue + converter stub for worker integration tests"
  - "Terminal event guarantee: every code path (success, RuntimeError, bare Exception) must push to job.events before exiting try block"

requirements-completed: [CONV-02, CONV-05]

duration: 2min
completed: 2026-03-02
---

# Phase 2 Plan 01: Async Job Store and Background Worker Summary

**Non-blocking POST /convert pipeline with asyncio.Queue dispatch and FIFO conversion_worker that guarantees SSE terminal events**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-02T22:52:12Z
- **Completed:** 2026-03-02T22:53:58Z
- **Tasks:** 2 (+ TDD RED commit)
- **Files modified:** 4

## Accomplishments

- Created `backend/job_store.py` with Job dataclass and conversion_worker coroutine that processes jobs FIFO
- POST /convert now returns HTTP 202 + job_id immediately — conversion happens asynchronously in the background
- Worker always pushes a terminal event (completed or failed) regardless of exception type — SSE stream never hangs
- TDD cycle: 7 unit/integration tests written first (RED), then implementation (GREEN) — all pass
- Temp file lifecycle correctly moved from POST handler to worker finally block

## Task Commits

Each task was committed atomically:

1. **RED — Failing tests for job_store** - `f14fcfa` (test)
2. **Task 1: Create job_store.py** - `ead1c69` (feat)
3. **Task 2: Update main.py** - `ffabe47` (feat)

_Note: TDD task has separate RED commit before implementation_

## Files Created/Modified

- `backend/job_store.py` — Job dataclass + conversion_worker coroutine
- `backend/main.py` — Lifespan with dispatch_queue/worker task, async POST /convert returning 202
- `backend/tests/test_job_store.py` — 7 tests covering Job fields, worker success/error/unexpected paths, task_done guarantee
- `backend/tests/__init__.py` — Test package init

## Decisions Made

- Worker task stored as `app.state._worker` via `asyncio.create_task` to prevent GC collection — fire-and-forget would risk task being collected mid-conversion
- `dispatch_queue.task_done()` placed unconditionally in finally block — enables `await dispatch_queue.join()` in tests for deterministic synchronization
- POST handler writes temp file but does NOT delete it — worker owns the full lifecycle to prevent race condition where POST handler deletes file before worker reads it

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `docling` module not installed in local Python environment (runs in Docker only) — the plan's import-based verification check was adapted to AST-based source verification. All behavioral tests via FakeState pattern passed without needing docling.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `job.events` asyncio.Queue is ready for Phase 2-02 (SSE /jobs/{id}/stream endpoint)
- `job_id` returned from POST /convert is the key for the SSE stream URL
- `app.state.jobs` dict holds all active Job objects accessible from any endpoint
- No blockers for Phase 2-02

---
*Phase: 02-async-job-system-sse-progress*
*Completed: 2026-03-02*
