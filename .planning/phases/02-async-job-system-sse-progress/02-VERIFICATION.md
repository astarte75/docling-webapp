---
phase: 02-async-job-system-sse-progress
verified: 2026-03-03T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "POST /convert returns HTTP 202 immediately without blocking on conversion"
    expected: "Response arrives instantly with {\"job_id\": \"<uuid>\"} and HTTP 202 before Docling finishes"
    why_human: "Requires live Docker container with a real PDF to confirm non-blocking timing"
  - test: "SSE stream delivers started then completed/failed and then closes automatically"
    expected: "curl -N streams event: started then event: completed or event: failed, then curl returns (no hang)"
    why_human: "Real-time streaming behaviour and connection closure cannot be verified statically"
  - test: "Conversion failure delivers structured error via SSE"
    expected: "Corrupted or invalid PDF triggers failed event with human-readable message field"
    why_human: "Requires injecting a bad PDF against the running container"
  - test: "Docker logs confirm temp file deleted after each job"
    expected: "No /tmp/<job_id>.pdf remains after job completes or fails"
    why_human: "Filesystem state after conversion only observable at runtime"
---

# Phase 2: Async Job System + SSE Progress Verification Report

**Phase Goal:** Conversions run non-blocking and clients receive real-time progress events
**Verified:** 2026-03-03
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn from the ROADMAP.md success criteria plus both plan `must_haves` blocks.

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | POST /convert returns HTTP 202 immediately with a job_id | VERIFIED | `main.py:118` — `JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"job_id": job_id})` |
| 2 | Job queued in FIFO order via asyncio.Queue, processed by a single background worker | VERIFIED | `main.py:115` — `await request.app.state.dispatch_queue.put(job_id)`; `job_store.py:23-24` — `while True: job_id = await state.dispatch_queue.get()` |
| 3 | Worker always pushes a terminal event (completed or failed) — SSE stream never hangs | VERIFIED | `job_store.py:34,38,43` — all three execution paths (success, RuntimeError, bare Exception) push to `job.events` before the finally block |
| 4 | Temp file deleted by worker finally block, not by POST handler | VERIFIED | `job_store.py:46-47` — `os.remove` in finally block; `main.py` — no `os.remove` in POST handler |
| 5 | On failure the job carries a structured error message | VERIFIED | `job_store.py:38` — `{"type": "failed", "message": str(exc)}`; `job_store.py:43` — `{"type": "failed", "message": "Internal server error"}` |
| 6 | Client can connect to GET /jobs/{job_id}/stream and receive SSE events in text/event-stream format | VERIFIED | `main.py:135,150` — route registered; `StreamingResponse(..., media_type="text/event-stream")` |
| 7 | SSE stream emits started event then completed or failed as terminal event | VERIFIED | `main.py:127-132` — generator loops on `job.events.get()`, yields each event, breaks on `completed`/`failed` |
| 8 | completed event includes full markdown | VERIFIED | `job_store.py:34` — `{"type": "completed", "markdown": markdown}`; serialised via `json.dumps` in `main.py:130` |
| 9 | failed event includes human-readable message | VERIFIED | `job_store.py:38,43` — `{"type": "failed", "message": ...}` |
| 10 | SSE connection closes after terminal event — stream does not hang | VERIFIED | `main.py:131-132` — `if event_type in ("completed", "failed"): break` exits the async generator |
| 11 | Requesting stream for unknown job_id returns HTTP 404 | VERIFIED | `main.py:144-148` — `if job_id not in jobs: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")` — raised before StreamingResponse, in normal function scope (not inside generator), so HTTPException propagates correctly |
| 12 | FIFO jobs queue — no request rejected, all accepted and processed in order | VERIFIED | `asyncio.Queue` is unbounded by default; worker processes one item at a time from the queue head |

**Score:** 12/12 truths verified (automated static analysis)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/job_store.py` | Job dataclass + conversion_worker coroutine | VERIFIED | 49 lines; exports `Job` (dataclass with job_id, tmp_path, events, status) and `conversion_worker` (async coroutine). Substantive — full implementation with all error paths. |
| `backend/main.py` | Async POST /convert + GET /jobs/{job_id}/stream + lifespan | VERIFIED | 151 lines; contains lifespan with `asyncio.create_task`, POST handler returning 202, SSE streaming endpoint. Substantive — no placeholders. |
| `backend/tests/test_job_store.py` | 7 unit/integration tests for worker | VERIFIED | 186 lines; tests Job defaults, queue independence, success path, RuntimeError path, unexpected Exception path, task_done guarantee. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `main.py lifespan` | `job_store.conversion_worker` | `asyncio.create_task` | WIRED | `main.py:32` — `app.state._worker = asyncio.create_task(conversion_worker(app.state))` |
| `main.py POST /convert` | `app.state.dispatch_queue` | `await dispatch_queue.put(job_id)` | WIRED | `main.py:115` — `await request.app.state.dispatch_queue.put(job_id)` |
| `GET /jobs/{job_id}/stream` | `job.events asyncio.Queue` | `await job.events.get()` in async generator | WIRED | `main.py:128` — `event_data: dict = await job.events.get()` inside `_job_event_generator` |
| `SSE generator` | terminal event check | `break` on completed/failed | WIRED | `main.py:131-132` — `if event_type in ("completed", "failed"): break` |
| `conversion_worker finally` | dispatch_queue | `task_done()` | WIRED | `job_store.py:48` — `state.dispatch_queue.task_done()` unconditionally in finally |

All 5 key links verified.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CONV-02 | 02-01-PLAN.md | System processes conversion asynchronously and returns immediately with a job ID (non-blocking) | SATISFIED | `main.py:118` — HTTP 202 + job_id returned before conversion starts; worker processes via separate asyncio task |
| CONV-03 | 02-02-PLAN.md | User sees real-time conversion progress driven by SSE | SATISFIED | `main.py:135-150` — GET /jobs/{job_id}/stream endpoint; `StreamingResponse` with `text/event-stream`; events delivered as they are pushed by the worker |
| CONV-04 | 02-02-PLAN.md | User sees clear success state with result preview when conversion completes | SATISFIED (backend) | `job_store.py:34` — `{"type": "completed", "markdown": markdown}` delivered via SSE; frontend rendering is Phase 3 |
| CONV-05 | 02-01-PLAN.md + 02-02-PLAN.md | User sees clear error state with actionable error message when conversion fails | SATISFIED (backend) | `job_store.py:38,43` — `{"type": "failed", "message": ...}` delivered via SSE; frontend error display is Phase 3 |

**Coverage:** 4/4 requirements declared in phase plans are satisfied at the backend level.

Note: CONV-03, CONV-04, CONV-05 have a user-visible component (what the user *sees*) that depends on the Phase 3 frontend. The backend contract — SSE events with the specified payloads — is fully implemented and verified. The "user sees" assertion requires human verification against a running instance.

---

## Plan Artifact Deviation

Plan 02-02 specified `contains: "EventSourceResponse"` in its artifact definition. The implementation uses `StreamingResponse` instead. This is a documented intentional deviation (SUMMARY 02-02, key-decisions): `EventSourceResponse` from `fastapi.sse` prevents `HTTPException(404)` from propagating correctly when used as a response class on async generator routes. The fix — a regular function returning `StreamingResponse(generator(), media_type="text/event-stream")` — achieves identical SSE wire format (`event: type\ndata: json\n\n`) with correct HTTP error handling.

The SSE *behaviour* specified by the plan is fully implemented. The deviation is in the implementation mechanism, not the contract. No impact on goal achievement.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No TODOs, FIXMEs, placeholders, empty returns, or stub implementations detected in any modified file.

---

## Human Verification Required

The following items require a running Docker container and real PDF to verify:

### 1. Non-blocking 202 response timing

**Test:** `curl -s -w "\nHTTP Status: %{http_code}\n" -F "file=@/path/to/any.pdf" http://localhost:8000/convert`
**Expected:** Response arrives within 1 second with `{"job_id":"<uuid>"}` and HTTP 202, regardless of how long Docling takes
**Why human:** Timing behaviour (non-blocking vs blocking) cannot be verified by static analysis

### 2. SSE stream delivers events and closes

**Test:** Copy the `job_id` from step 1, then run `curl -N -H "Accept: text/event-stream" http://localhost:8000/jobs/<job_id>/stream`
**Expected:**
```
event: started
data: {"type": "started", "message": "Conversion started"}

event: completed
data: {"type": "completed", "markdown": "# ..."}
```
Stream closes (curl returns) immediately after the terminal event.
**Why human:** Real-time streaming and connection lifecycle cannot be verified statically

### 3. Failure path delivers structured SSE error

**Test:** Submit a text file renamed to `.pdf` or a corrupt PDF, stream its events
**Expected:**
```
event: started
data: {"type": "started", "message": "Conversion started"}

event: failed
data: {"type": "failed", "message": "<readable error>"}
```
**Why human:** Requires injecting an invalid document against the running container

### 4. Temp file cleanup confirmed in logs

**Test:** `docker compose logs backend --tail=30` after a successful conversion
**Expected:** No `/tmp/<job_id>.pdf` file remains; logs show job completion
**Why human:** Filesystem state only observable at runtime

### 5. FIFO queue ordering under concurrent load

**Test:** Submit two PDFs simultaneously in separate terminals, stream both jobs
**Expected:** Second job's `started` event appears only after first job's `completed` or `failed` event
**Why human:** Concurrency ordering requires runtime observation

---

## Summary

Phase 2 goal is **fully implemented** at the code level. All 12 observable truths are statically verified across `backend/job_store.py` and `backend/main.py`:

- `job_store.py` implements the complete async worker with FIFO dispatch, terminal event guarantee on all code paths, and temp file cleanup in the finally block.
- `main.py` implements the non-blocking POST /convert (HTTP 202 + job_id), the lifespan-scoped worker task, and the SSE streaming endpoint using `StreamingResponse` with manual `text/event-stream` formatting.
- All 4 requirements (CONV-02, CONV-03, CONV-04, CONV-05) are satisfied at the backend API contract level.
- 7 unit/integration tests cover the worker's key behavioural guarantees.

The only items requiring human verification are runtime behaviours (timing, streaming, Docker logs) that cannot be asserted via static analysis. The automated evidence strongly supports that these will pass — the implementation is correct and complete.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
