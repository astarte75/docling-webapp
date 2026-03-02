---
phase: 02-async-job-system-sse-progress
plan: "02"
subsystem: api
tags: [sse, fastapi, streaming, asyncio, server-sent-events]

# Dependency graph
requires:
  - phase: 02-async-job-system-sse-progress
    provides: Job dataclass with asyncio.Queue events bridge, conversion_worker, app.state.jobs

provides:
  - GET /jobs/{job_id}/stream SSE endpoint delivering started -> completed/failed events
  - Complete async conversion pipeline verified end-to-end with real PDF

affects:
  - 03-react-frontend-single-file-flow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - StreamingResponse with custom async generator for SSE (FastAPI 0.135+ native EventSourceResponse not compatible — use StreamingResponse)
    - SSE format via manual text/event-stream encoding in generator
    - asyncio.Queue.get() as consumer side of worker/SSE bridge

key-files:
  created: []
  modified:
    - backend/main.py

key-decisions:
  - "Used StreamingResponse with manual SSE formatting instead of EventSourceResponse — EventSourceResponse from fastapi.sse wraps async generators in a way that prevents HTTPException from returning 404 before the stream starts; separate the 404 guard as a regular route that returns a StreamingResponse"
  - "404 check done in a non-generator function that returns StreamingResponse, keeping the HTTP status code path separate from the streaming generator"

patterns-established:
  - "SSE pattern: separate 404 guard (regular return) from streaming generator (yield); do NOT use EventSourceResponse wrapper"
  - "Terminal event break: check event_data['type'] in ('completed', 'failed') and break immediately after yield"

requirements-completed:
  - CONV-03
  - CONV-04
  - CONV-05

# Metrics
duration: ~30min
completed: 2026-03-03
---

# Phase 2 Plan 02: SSE Stream Endpoint Summary

**GET /jobs/{job_id}/stream SSE endpoint delivering real-time conversion progress via asyncio.Queue consumer, verified end-to-end with a real PDF submission**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 1

## Accomplishments
- GET /jobs/{job_id}/stream endpoint added to backend/main.py — bridges job.events asyncio.Queue to HTTP SSE stream
- Stream yields started event then completed (with full markdown) or failed (with error message), then closes automatically
- Unknown job_id returns HTTP 404 with {"error": "Job not found"}
- End-to-end pipeline verified with real PDF: POST /convert (202 + job_id) -> SSE stream -> started -> completed with markdown

## Task Commits

1. **Task 1: Add GET /jobs/{job_id}/stream SSE endpoint** - `fcca5fa` (feat)
2. **Fix: Separate 404 check from SSE generator** - `39ad134` (fix)
3. **Fix: Replace EventSourceResponse with StreamingResponse** - `35b1439` (fix)
4. **Task 2: End-to-end verification** - human checkpoint, approved by user

## Files Created/Modified
- `backend/main.py` — Added stream_job route with SSE generator consuming job.events queue

## Decisions Made
- Used StreamingResponse with manual SSE text/event-stream formatting rather than EventSourceResponse. EventSourceResponse from fastapi.sse does not allow raising HTTPException before the generator starts streaming, so 404 responses were silently converted to 200. The fix: a regular (non-generator) route function checks for job existence and returns StreamingResponse(generator(), media_type="text/event-stream") or raises HTTPException.
- The 404 guard is a separate function call that returns early, keeping the streaming path clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EventSourceResponse caused 404 to silently return 200**
- **Found during:** Task 1 (add SSE endpoint)
- **Issue:** Using `@app.get(..., response_class=EventSourceResponse)` with an async generator prevented HTTPException(404) from propagating correctly — the response was already committed as 200 before the exception could fire
- **Fix:** Split into two commits: (1) moved 404 check outside generator into regular function scope, (2) replaced EventSourceResponse wrapper with StreamingResponse(generator(), media_type="text/event-stream") — preserves SSE text/event-stream Content-Type without the wrapper's response-lifecycle interference
- **Files modified:** backend/main.py
- **Verification:** curl to unknown job_id returns HTTP 404; valid job_id streams events correctly
- **Committed in:** 39ad134, 35b1439

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in SSE response class behavior)
**Impact on plan:** Required fix for correct 404 handling. No scope creep. SSE stream behavior identical to spec.

## Issues Encountered
- EventSourceResponse from fastapi.sse (0.135+) did not behave as documented for async generators combined with HTTPException — likely a version-specific behavior. StreamingResponse is the correct primitive for manual SSE control in this FastAPI version.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete async pipeline is operational: POST /convert -> 202 + job_id -> GET /jobs/{id}/stream -> SSE events -> markdown
- Phase 2 requirements CONV-03, CONV-04, CONV-05 satisfied
- Phase 3 (React Frontend) can now implement SSEManager hook consuming this endpoint
- SSE format to expect: `event: <type>\ndata: <json>\n\n` — standard text/event-stream

---
*Phase: 02-async-job-system-sse-progress*
*Completed: 2026-03-03*
