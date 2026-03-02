# Phase 2: Async Job System + SSE Progress - Research

**Researched:** 2026-03-02
**Domain:** FastAPI async job management, Server-Sent Events, asyncio concurrency primitives
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### SSE event structure
- Emit 3 nominal phases: `started → converting → completed` (or `failed`)
- Event format: `{"type": "<phase>", "message": "<human-readable description>"}`
- No fake percentage — Docling is opaque, honest phase names are preferred over invented numbers

#### Conversion result delivery
- The final SSE event includes the markdown directly: `{"type": "completed", "markdown": "..."}`
- No separate GET /jobs/{id} call required — client gets everything from the stream
- On failure: `{"type": "failed", "message": "<error description>"}`

#### Job storage
- In-memory only (Python dict on the FastAPI app state)
- No TTL, no expiry — jobs persist until container restart
- No persistent storage required

#### Concurrency / queue
- Jobs queue FIFO — never reject an incoming job
- The existing `asyncio.Lock` in DoclingAdapter already serializes conversions
- No queue size limit — accept all jobs

### Claude's Discretion
- Exact endpoint URL structure (e.g., `/jobs/{id}/stream` vs `/convert/{id}/events`)
- SSE keep-alive / heartbeat implementation
- How to store job state (dataclass, TypedDict, or simple dict)
- Temp file cleanup strategy for queued jobs

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-02 | System processes conversion asynchronously and returns immediately with a job ID (non-blocking) | asyncio.Queue worker + BackgroundTasks pattern; POST returns 202 with job_id immediately |
| CONV-03 | User sees real-time conversion progress driven by Server-Sent Events (SSE) | FastAPI 0.135.1 EventSourceResponse + asyncio.Queue per job as notification channel |
| CONV-04 | User sees a clear success state with result accessible via the API when conversion completes | Final SSE event carries `{"type": "completed", "markdown": "..."}` — no polling needed |
| CONV-05 | User sees a clear error state with actionable error message when conversion fails | Worker catches RuntimeError from DoclingAdapter; emits `{"type": "failed", "message": "..."}` |
</phase_requirements>

---

## Summary

Phase 2 replaces the blocking `/convert` endpoint with a two-endpoint async pipeline: POST to `/convert` queues a job and returns HTTP 202 with a `job_id`, then GET to an SSE endpoint streams progress events until the conversion completes or fails. The final event delivers the full markdown result inline, eliminating the need for a separate result-fetch call.

The implementation relies entirely on Python standard library asyncio primitives — `asyncio.Queue` for FIFO job dispatch, `asyncio.Queue` per job for SSE event bridging, and a long-running worker task started in the FastAPI `lifespan`. No external dependencies are needed. The `DoclingAdapter.asyncio.Lock` already handles concurrency serialization, so no additional semaphore is required at the queue layer.

FastAPI 0.135.0 (released March 2025) added native `EventSourceResponse` and `ServerSentEvent` support directly in `fastapi.sse`. Since `requirements.txt` pins no version, the current install (0.135.1) will include this. The recommended SSE pattern uses an async generator that awaits `asyncio.Queue.get()` — this cleanly bridges the background worker (producer) with the SSE stream (consumer).

**Primary recommendation:** One global `asyncio.Queue` for job dispatch + one `asyncio.Queue` per job for SSE event delivery. Store both in `app.state.job_store` (a plain dict). Background worker loop runs as `asyncio.create_task` in `lifespan`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.135.1 | `EventSourceResponse`, `ServerSentEvent` from `fastapi.sse` | Native SSE added in 0.135.0; no extra dependency needed |
| asyncio (stdlib) | Python 3.12 | `asyncio.Queue`, `asyncio.create_task` | Zero-dependency FIFO + task management; already in use |
| uuid (stdlib) | Python 3.12 | Generate `job_id` | Already used in Phase 1 for temp file names |
| starlette | bundled with FastAPI | `StreamingResponse` fallback (superseded by `EventSourceResponse`) | Bundled — no install |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dataclasses (stdlib) | Python 3.12 | Typed job state container | When Claude's discretion: prefer over plain dict for IDE support |
| typing.TypedDict (stdlib) | Python 3.12 | Alternative typed job state | Lighter than dataclass; good for dicts-as-state |
| logging (stdlib) | Python 3.12 | Trace job lifecycle events | Already configured in main.py |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fastapi.sse.EventSourceResponse` | `sse-starlette` (3rd party) | `sse-starlette` was the pre-0.135 standard; now superseded — use native |
| `asyncio.Queue` (in-memory) | Celery + Redis | Celery adds Redis dep + process boundary; overkill for single-user self-hosted |
| `asyncio.create_task` in lifespan | `BackgroundTasks.add_task` per request | `BackgroundTasks` tasks are request-scoped and can be cancelled on disconnect; global worker is more robust |

**Installation:**

No new packages needed. `fastapi` (unpinned) resolves to 0.135.1 which includes `fastapi.sse`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── main.py          # Routes: POST /convert, GET /jobs/{id}/stream (or similar)
├── adapter.py       # DoclingAdapter — no changes needed
├── config.py        # No changes expected
└── job_store.py     # (optional) JobStore class or plain module with dataclass/TypedDict
```

The job store can stay in `main.py` for simplicity if it remains small. Extract to `job_store.py` if it grows beyond ~50 lines.

---

### Pattern 1: Global Worker Loop via asyncio.create_task in lifespan

**What:** A single long-running coroutine processes jobs from `asyncio.Queue` in FIFO order. Started once at startup, runs for the lifetime of the application.

**When to use:** Always — this is the core dispatch mechanism. The `DoclingAdapter.asyncio.Lock` already serializes Docling calls; the queue ensures order.

**Example:**
```python
# Source: https://johnsturgeon.me/2022/12/10/fastapi-writing-a-fifo-queue-with-asyncioqueue/
# + adapted for job_id tracking

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.converter = DoclingAdapter()
    app.state.dispatch_queue = asyncio.Queue()
    app.state.jobs: dict[str, Job] = {}
    # Start worker as a tracked task (not fire-and-forget)
    worker_task = asyncio.create_task(conversion_worker(app.state))
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down")

async def conversion_worker(state):
    """Process jobs from dispatch_queue sequentially."""
    while True:
        job_id: str = await state.dispatch_queue.get()
        job = state.jobs[job_id]
        try:
            # notify SSE stream: converting started
            await job.events.put({"type": "started", "message": "Conversion started"})
            markdown = await state.converter.convert_file(job.tmp_path)
            await job.events.put({"type": "completed", "markdown": markdown})
        except RuntimeError as exc:
            await job.events.put({"type": "failed", "message": str(exc)})
        except Exception:
            await job.events.put({"type": "failed", "message": "Internal server error"})
        finally:
            # Temp file cleanup — always, even on failure
            if os.path.exists(job.tmp_path):
                os.remove(job.tmp_path)
        state.dispatch_queue.task_done()
```

---

### Pattern 2: Per-Job asyncio.Queue as SSE Event Bridge

**What:** Each job gets its own `asyncio.Queue`. The SSE endpoint awaits `queue.get()` — blocking until the worker pushes an event. When the terminal event arrives (`completed` or `failed`), the generator exits.

**When to use:** Always — this is how the background worker communicates with the SSE stream without polling or shared mutable state.

**Example:**
```python
# Source: https://dev.to/zachary62/build-an-llm-web-app-in-python-from-scratch-part-4-fastapi-background-tasks-sse-21g4

@app.get("/jobs/{job_id}/stream", response_class=EventSourceResponse)
async def stream_job(job_id: str, request: Request) -> AsyncIterable[ServerSentEvent]:
    jobs = request.app.state.jobs
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    while True:
        event_data = await job.events.get()
        yield ServerSentEvent(data=json.dumps(event_data), event=event_data["type"])
        if event_data["type"] in ("completed", "failed"):
            break
```

---

### Pattern 3: Job State as dataclass

**What:** A dataclass holds job metadata alongside the events queue. Cleaner than a plain dict, no external dependency.

**When to use:** Recommended by Claude's discretion — TypedDict also valid but dataclass gives attribute access and default factories.

**Example:**
```python
# Source: stdlib dataclasses
from dataclasses import dataclass, field
import asyncio

@dataclass
class Job:
    job_id: str
    tmp_path: str
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    status: str = "queued"  # queued | converting | completed | failed
```

---

### Pattern 4: POST /convert Returns HTTP 202

**What:** Accepts the file, writes to temp, creates a Job, enqueues the `job_id`, returns `{"job_id": "..."}` immediately with HTTP 202 Accepted.

**When to use:** Always — this is the non-blocking contract (CONV-02).

**Example:**
```python
@app.post("/convert", status_code=status.HTTP_202_ACCEPTED)
async def submit_conversion(request: Request, file: UploadFile) -> JSONResponse:
    # ... validate extension, size (reuse existing logic) ...
    job_id = str(uuid.uuid4())
    tmp_path = f"/tmp/{job_id}.pdf"
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = Job(job_id=job_id, tmp_path=tmp_path)
    request.app.state.jobs[job_id] = job
    await request.app.state.dispatch_queue.put(job_id)
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"job_id": job_id}
    )
```

---

### Pattern 5: SSE Native FastAPI (0.135+)

**What:** Use `fastapi.sse.EventSourceResponse` as `response_class` on the SSE endpoint. FastAPI handles keep-alive pings (every 15s), `Cache-Control: no-cache`, and `X-Accel-Buffering: no` automatically.

**When to use:** Always — do not use `sse-starlette` or raw `StreamingResponse` for SSE in FastAPI 0.135+.

**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/server-sent-events/
from fastapi.sse import EventSourceResponse, ServerSentEvent
from collections.abc import AsyncIterable

@app.get("/jobs/{job_id}/stream", response_class=EventSourceResponse)
async def stream_job(job_id: str, request: Request) -> AsyncIterable[ServerSentEvent]:
    ...
    yield ServerSentEvent(
        data=json.dumps({"type": "started", "message": "Conversion started"}),
        event="started"
    )
```

---

### Anti-Patterns to Avoid

- **Using `BackgroundTasks.add_task` for the worker:** Request-scoped; cancelled on disconnect if the POST request ends (race condition where SSE client connects before worker runs). Use `asyncio.create_task` in `lifespan` instead.
- **Using `asyncio.Semaphore` to limit concurrency:** The `DoclingAdapter.asyncio.Lock` already serializes all Docling calls to one-at-a-time. Adding a separate semaphore adds complexity with no benefit for v1.
- **Storing the markdown result in job state for polling:** CONTEXT.md locked decision: deliver markdown in the final SSE event. No GET /jobs/{id}/result needed.
- **Using `sse-starlette`:** Third-party library superseded by native FastAPI 0.135 SSE support.
- **Fire-and-forget `asyncio.create_task` without keeping reference:** Python GC can collect unreferenced tasks; always hold a reference (store in app.state or a set).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE keep-alive pings | Custom heartbeat timer | `EventSourceResponse` (built-in) | FastAPI 0.135 sends comment ping every 15s automatically |
| SSE headers (cache, buffering) | Manual `Cache-Control`, `X-Accel-Buffering` | `EventSourceResponse` (built-in) | Both headers set automatically; missing them causes proxy buffering |
| Job ID generation | Custom ID scheme | `uuid.uuid4()` | Already in use in Phase 1; collision-resistant |
| Thread-safe Docling calls | Custom locking | `DoclingAdapter._lock` (existing) | Already handles shared internal state of DocumentConverter |
| Async file read | Custom async chunk reader | Already in Phase 1 code | Reuse the 1MB-chunk loop verbatim |

**Key insight:** The only new primitives needed are `asyncio.Queue` (dispatch) and `asyncio.Queue` per job (event bridge). Everything else is existing code or FastAPI builtins.

---

## Common Pitfalls

### Pitfall 1: Background Worker Cancelled on Client Disconnect

**What goes wrong:** If the conversion worker is started with `BackgroundTasks.add_task` inside the POST /convert handler, Starlette may cancel it when the HTTP connection closes (before the SSE client connects). The job silently disappears.

**Why it happens:** `BackgroundTasks` are tied to the request lifecycle. `asyncio.create_task` in `lifespan` is process-scoped.

**How to avoid:** Start the worker once in `lifespan` as `asyncio.create_task(conversion_worker(app.state))`. Store the task reference in `app.state` to prevent GC.

**Warning signs:** Jobs enqueued but never processed; SSE stream hangs forever.

---

### Pitfall 2: SSE Generator Hangs After Job Completes (Queue Never Unblocks)

**What goes wrong:** The SSE generator is `await queue.get()` in a `while True` loop. If the worker crashes before pushing a terminal event, the generator waits forever and the SSE connection never closes.

**Why it happens:** Worker exception not caught; no terminal event pushed to the per-job queue.

**How to avoid:** Worker must have a `try/except Exception` that always pushes either `completed` or `failed` to `job.events`. The `finally` block in the worker ensures temp file cleanup happens regardless.

**Warning signs:** Browser SSE connection stays open indefinitely after conversion should have finished.

---

### Pitfall 3: Temp File Deleted Before Worker Processes Job

**What goes wrong:** Phase 1 pattern deletes the temp file in a `finally` block at the end of the `/convert` handler. In async mode, the file must survive until the worker processes it (which may be after many other jobs are queued).

**Why it happens:** Reusing Phase 1's try/finally pattern without adjusting lifecycle.

**How to avoid:** Do NOT delete the temp file in the POST handler's finally block. Delete it in the worker's `finally` block after `convert_file()` completes (or fails). This is the only Phase 2-specific lifecycle change needed.

**Warning signs:** `FileNotFoundError` from DoclingAdapter; jobs fail immediately with no output.

---

### Pitfall 4: SSE Client Disconnects — Queue Fills Unboundedly

**What goes wrong:** Client disconnects before consuming all SSE events. Worker continues pushing to `job.events` — an unbounded queue that may grow forever (though for single conversions this is a small risk).

**Why it happens:** No backpressure mechanism on the per-job queue.

**How to avoid:** For v1, this is acceptable — each conversion produces at most 3 events. Document as known limitation. If needed, create queue with `asyncio.Queue(maxsize=10)`.

**Warning signs:** Memory growth in long-running containers with many abandoned SSE connections.

---

### Pitfall 5: asyncio.Queue Not Picklable — Can't Use with ProcessPoolExecutor

**What goes wrong:** If someone tries to pass `job.events` (an `asyncio.Queue`) across process boundaries (e.g., via `concurrent.futures.ProcessPoolExecutor`), it will fail silently or raise.

**Why it happens:** `asyncio.Queue` objects are bound to an event loop and cannot be serialized.

**How to avoid:** Keep all queue access within the same asyncio event loop (same process). `DoclingAdapter` already uses `asyncio.to_thread` correctly for this.

**Warning signs:** N/A for this phase — Docling uses `asyncio.to_thread`, not multiprocessing.

---

## Code Examples

Verified patterns from official sources:

### FastAPI EventSourceResponse (native, 0.135+)

```python
# Source: https://fastapi.tiangolo.com/tutorial/server-sent-events/
from fastapi.sse import EventSourceResponse, ServerSentEvent
from collections.abc import AsyncIterable
import json

@app.get("/jobs/{job_id}/stream", response_class=EventSourceResponse)
async def stream_job(job_id: str, request: Request) -> AsyncIterable[ServerSentEvent]:
    if job_id not in request.app.state.jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = request.app.state.jobs[job_id]
    while True:
        event_data: dict = await job.events.get()
        yield ServerSentEvent(
            data=json.dumps(event_data),
            event=event_data["type"],
        )
        if event_data["type"] in ("completed", "failed"):
            break
```

### Job dataclass with events queue

```python
# Source: stdlib dataclasses — Python 3.12
from dataclasses import dataclass, field
import asyncio

@dataclass
class Job:
    job_id: str
    tmp_path: str
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    status: str = "queued"
```

### asyncio.create_task worker in lifespan (fire-with-reference)

```python
# Source: https://johnsturgeon.me/2022/12/10/fastapi-writing-a-fifo-queue-with-asyncioqueue/
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.converter = DoclingAdapter()
    app.state.dispatch_queue: asyncio.Queue = asyncio.Queue()
    app.state.jobs: dict[str, Job] = {}
    # Keep reference — do not use fire-and-forget
    app.state._worker = asyncio.create_task(conversion_worker(app.state))
    yield
    app.state._worker.cancel()
    try:
        await app.state._worker
    except asyncio.CancelledError:
        pass
```

### Worker with guaranteed terminal event push

```python
# Ensures SSE stream always terminates — no queue hang
async def conversion_worker(state):
    while True:
        job_id: str = await state.dispatch_queue.get()
        job: Job = state.jobs[job_id]
        try:
            job.status = "converting"
            await job.events.put({"type": "started", "message": "Conversion started"})
            markdown = await state.converter.convert_file(job.tmp_path)
            job.status = "completed"
            await job.events.put({"type": "completed", "markdown": markdown})
        except RuntimeError as exc:
            job.status = "failed"
            await job.events.put({"type": "failed", "message": str(exc)})
        except Exception as exc:
            job.status = "failed"
            logger.exception("Unexpected error in worker for job %s", job_id)
            await job.events.put({"type": "failed", "message": "Internal server error"})
        finally:
            if os.path.exists(job.tmp_path):
                os.remove(job.tmp_path)
                logger.info("Temp file deleted: %s", job.tmp_path)
        state.dispatch_queue.task_done()
```

### POST /convert returns 202

```python
# CONV-02: non-blocking, returns job_id immediately
@app.post("/convert", status_code=status.HTTP_202_ACCEPTED)
async def submit_conversion(request: Request, file: UploadFile) -> JSONResponse:
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Only PDF accepted.",
        )
    chunks: list[bytes] = []
    total_bytes = 0
    while chunk := await file.read(1024 * 1024):
        total_bytes += len(chunk)
        if total_bytes > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds 50MB limit",
            )
        chunks.append(chunk)
    content = b"".join(chunks)
    job_id = str(uuid.uuid4())
    tmp_path = f"/tmp/{job_id}.pdf"
    with open(tmp_path, "wb") as f:
        f.write(content)
    job = Job(job_id=job_id, tmp_path=tmp_path)
    request.app.state.jobs[job_id] = job
    await request.app.state.dispatch_queue.put(job_id)
    logger.info("Job %s queued (%d bytes, %s)", job_id, total_bytes, filename)
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"job_id": job_id},
    )
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sse-starlette` (3rd party) | `fastapi.sse.EventSourceResponse` (native) | FastAPI 0.135.0 — March 2025 | No extra dependency; keep-alive, cache headers automatic |
| `StreamingResponse(media_type="text/event-stream")` | `EventSourceResponse` as `response_class` | FastAPI 0.135.0 | Type-safe, Pydantic-validated, auto-documented |
| Raw `BackgroundTasks` for long jobs | `asyncio.create_task` in `lifespan` | Established pattern | Process-scoped lifecycle; not cancelled on request close |

**Deprecated/outdated:**
- `sse-starlette`: Valid pre-0.135, now superseded. Do not introduce as new dependency.
- `@app.on_event("startup")`: Deprecated since FastAPI 0.93.0 in favor of `lifespan` context manager — already avoided in Phase 1 code.

---

## Open Questions

1. **Endpoint URL structure (Claude's discretion)**
   - What we know: CONTEXT.md leaves this open; examples in research use `/jobs/{id}/stream`
   - What's unclear: Whether to keep `/convert` path prefix or use `/jobs/{id}/events`
   - Recommendation: Use `/jobs/{job_id}/stream` — clearly communicates resource type and action; consistent with REST conventions for sub-resources

2. **Job state TypedDict vs dataclass (Claude's discretion)**
   - What we know: Both work; dataclass gives `field(default_factory=asyncio.Queue)`; TypedDict can't hold non-serializable values cleanly
   - What's unclear: Whether linter/IDE support preference matters for this team
   - Recommendation: Use `@dataclass` — `asyncio.Queue` default factory is cleaner than TypedDict

3. **SSE keep-alive interval**
   - What we know: FastAPI 0.135 sends comment ping every 15 seconds automatically via `EventSourceResponse`
   - What's unclear: Whether 15s is sufficient for all proxy configurations
   - Recommendation: Rely on built-in; no custom heartbeat needed for v1. Phase 5 risk (nginx) already tracked in STATE.md.

4. **What happens if SSE client connects after job is already complete?**
   - What we know: Per-job `asyncio.Queue` retains unread events (unbounded by default)
   - What's unclear: Whether to emit all buffered events or just a summary
   - Recommendation: The queue approach naturally handles this — buffered `completed` event is still in the queue and will be yielded on connect. No special handling needed.

---

## Sources

### Primary (HIGH confidence)
- `https://fastapi.tiangolo.com/tutorial/server-sent-events/` — Official FastAPI SSE docs; `EventSourceResponse`, `ServerSentEvent` API, keep-alive behavior, cache headers
- `https://github.com/fastapi/fastapi/releases` — Confirmed 0.135.0 added SSE (March 2025); 0.135.1 is current latest
- `https://fastapi.tiangolo.com/tutorial/background-tasks/` — Official BackgroundTasks docs; confirmed limitations for long-running jobs

### Secondary (MEDIUM confidence)
- `https://dev.to/zachary62/build-an-llm-web-app-in-python-from-scratch-part-4-fastapi-background-tasks-sse-21g4` — Per-job asyncio.Queue as SSE bridge pattern; verified against official asyncio docs
- `https://johnsturgeon.me/2022/12/10/fastapi-writing-a-fifo-queue-with-asyncioqueue/` — FIFO worker pattern with asyncio.Queue in FastAPI; verified against asyncio official docs
- `https://leapcell.io/blog/understanding-pitfalls-of-async-task-management-in-fastapi-requests` — asyncio task management pitfalls; aligned with FastAPI official guidance
- `https://jasoncameron.dev/posts/fastapi-cancel-on-disconnect` — Client disconnect patterns; implementation approach verified against FastAPI/Starlette behavior

### Tertiary (LOW confidence)
- None — all pitfalls and patterns verified against official sources or multiple concordant sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — FastAPI 0.135.1 native SSE verified from official release notes and docs; stdlib asyncio primitives are stable
- Architecture: HIGH — asyncio.Queue per job + lifespan worker is a documented pattern verified from multiple concordant sources
- Pitfalls: HIGH — temp file lifecycle and worker cancellation pitfalls derived from direct code inspection of Phase 1 + FastAPI official docs

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (FastAPI releases are relatively frequent but SSE API is now stable)
