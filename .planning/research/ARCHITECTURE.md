# Architecture Research — Docling Webapp

**Research type**: Project Research — Architecture dimension
**Date**: 2026-03-02
**Milestone**: Greenfield — initial architecture design

---

## Question Being Answered

How are document processing web apps typically structured when the processing is heavy/async (like ML-based document parsing)? Key concerns: async job handling in FastAPI, file storage for uploads and results, progress tracking via WebSocket or polling, multi-container Docker Compose layout, and how to integrate Docling's Python API.

---

## Summary

A FastAPI + React document conversion webapp handling heavy ML workloads (Docling) follows a well-established pattern: a thin HTTP API layer accepts uploads and returns job IDs, a background worker (in-process or separate) runs the actual conversion, file storage mediates between services, and a real-time channel (SSE or WebSocket) streams progress back to the browser. The React frontend manages a local job state machine and renders results inline. Everything runs as distinct Docker Compose services sharing a volume mount.

For this project's scope (no auth, no persistent DB, self-hosted), the lightest viable architecture is: **FastAPI with asyncio background tasks + in-memory job state + shared Docker volume + SSE for progress**. Celery/Redis adds operational overhead that is not justified until multi-user concurrency or job persistence become requirements.

---

## Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│   React SPA (Vite)                                          │
│   ├── UploadForm        — file selection, option config     │
│   ├── JobList           — tracks active/completed jobs      │
│   ├── ProgressStream    — SSE consumer, updates job state   │
│   └── ResultViewer      — Markdown preview + download       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / SSE
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend                           │
│                                                             │
│   API Layer                                                 │
│   ├── POST /jobs          — accept upload, create job       │
│   ├── GET  /jobs/{id}     — poll job status (fallback)      │
│   ├── GET  /jobs/{id}/stream — SSE progress stream          │
│   ├── GET  /jobs/{id}/result — download Markdown result     │
│   └── DELETE /jobs/{id}  — cleanup temp files               │
│                                                             │
│   Job Manager (in-process)                                  │
│   ├── JobStore           — dict[job_id → JobState]          │
│   ├── TaskRunner         — asyncio.create_task wrapper      │
│   └── EventBus           — asyncio.Queue per job for SSE    │
│                                                             │
│   Docling Worker (sync → thread pool)                       │
│   ├── DoclingAdapter     — wraps DocumentConverter          │
│   ├── OptionMapper       — HTTP params → PipelineOptions    │
│   └── OutputWriter       — writes .md to shared volume      │
└────────────────────┬────────────────────────────────────────┘
                     │ filesystem read/write
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared Volume (Docker bind mount)              │
│                                                             │
│   /data/uploads/{job_id}/input.{ext}                        │
│   /data/results/{job_id}/output.md                          │
│   /data/results/{job_id}/output.zip  (batch)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### 1. React Frontend

**Owns**: UI state, job lifecycle state machine, SSE connection management.

**Does NOT own**: conversion logic, file persistence, job ID generation.

Key sub-components:

| Component | Responsibility |
|-----------|---------------|
| `UploadForm` | File picker, Docling option controls (basic/advanced panel), submit triggers POST /jobs |
| `JobStore` (Zustand or useReducer) | Client-side job registry: `{ id, status, progress, resultUrl }` |
| `SSEManager` | Opens `EventSource` to `/jobs/{id}/stream` on job creation; dispatches progress events into JobStore |
| `ResultViewer` | Renders Markdown via react-markdown; download button hits `/jobs/{id}/result` |
| `BatchManager` | For multi-file uploads: fans out to N parallel POST /jobs, aggregates into ZIP download |

**State machine per job**:
```
PENDING → UPLOADING → QUEUED → PROCESSING → DONE
                                          ↘ ERROR
```

### 2. FastAPI API Layer

**Owns**: HTTP contract, request validation, job ID generation, response formatting.

**Does NOT own**: conversion execution, file I/O.

Key endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs` | POST | Receive multipart upload + options JSON. Save file to `/data/uploads/{id}/`. Create JobState. Launch background task. Return `{ job_id, status: "queued" }`. |
| `/jobs/{id}` | GET | Return current JobState as JSON (polling fallback). |
| `/jobs/{id}/stream` | GET | Server-Sent Events stream. Yields progress events until job terminal state. |
| `/jobs/{id}/result` | GET | Stream the output `.md` file (or `.zip` for batch). |
| `/jobs/{id}` | DELETE | Remove temp files, drop from JobStore. |

**Validation**: Pydantic models for option parameters. File type whitelist checked on upload (MIME + extension).

### 3. Job Manager (in-process, within FastAPI)

**Owns**: job state, progress event routing, background task lifecycle.

**Does NOT own**: actual conversion.

Implementation pattern:

```python
# In-memory store — acceptable for single-process, no persistence required
job_store: dict[str, JobState] = {}

# Per-job asyncio queue feeds SSE streams
event_queues: dict[str, asyncio.Queue] = {}

async def create_job(file_path: Path, options: ConvertOptions) -> str:
    job_id = str(uuid4())
    job_store[job_id] = JobState(id=job_id, status="queued")
    event_queues[job_id] = asyncio.Queue()
    asyncio.create_task(run_conversion(job_id, file_path, options))
    return job_id
```

**Critical detail**: Docling's `DocumentConverter.convert()` is synchronous and CPU-bound. It must run in a thread pool via `asyncio.to_thread()` or `loop.run_in_executor()` to avoid blocking the event loop. Without this, SSE streams stall while conversion runs.

```python
async def run_conversion(job_id: str, file_path: Path, options: ConvertOptions):
    await emit_event(job_id, {"status": "processing", "progress": 0})
    try:
        result = await asyncio.to_thread(docling_adapter.convert, file_path, options)
        write_result(job_id, result)
        await emit_event(job_id, {"status": "done", "progress": 100})
    except Exception as e:
        await emit_event(job_id, {"status": "error", "message": str(e)})
```

### 4. Docling Adapter

**Owns**: all Docling-specific code, option translation.

**Does NOT own**: HTTP concerns, job state.

```python
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions

class DoclingAdapter:
    def __init__(self):
        # Converter is expensive to initialize — create once, reuse
        self._converter = DocumentConverter()

    def convert(self, file_path: Path, options: ConvertOptions) -> str:
        """Runs synchronously — must be called from thread pool."""
        result = self._converter.convert(str(file_path))
        return result.document.export_to_markdown()
```

**Key Docling facts**:
- `DocumentConverter` should be instantiated once at startup (model loading is expensive, ~seconds)
- `.convert()` accepts a file path string or URL
- `.document.export_to_markdown()` produces the output
- Pipeline options (`PdfPipelineOptions`) control OCR, table structure, image handling
- The converter is not thread-safe if sharing state — safe pattern is a single instance with a lock, or a pool of converters

**Option mapping** (HTTP params → Docling):

| HTTP option | Docling equivalent |
|------------|-------------------|
| `ocr=true` | `PdfPipelineOptions(do_ocr=True)` |
| `table_structure=true` | `PdfPipelineOptions(do_table_structure=True)` |
| `pipeline=vlm` | Use `VlmPipelineOptions` (heavier, GPU beneficial) |
| `image_resolution=high` | `PdfPipelineOptions(images_scale=2.0)` |

### 5. SSE Progress Stream

**Pattern**: Server-Sent Events over a persistent HTTP connection. Simpler than WebSocket for unidirectional server→client flow. Native browser `EventSource` API, no library needed on the client.

**Server implementation**:
```python
from fastapi.responses import StreamingResponse

@app.get("/jobs/{job_id}/stream")
async def stream_progress(job_id: str):
    async def event_generator():
        queue = event_queues.get(job_id)
        if not queue:
            yield "data: {\"error\": \"job not found\"}\n\n"
            return
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("status") in ("done", "error"):
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
```

**Client implementation**:
```javascript
const es = new EventSource(`/api/jobs/${jobId}/stream`);
es.onmessage = (e) => {
  const event = JSON.parse(e.data);
  dispatch({ type: 'JOB_PROGRESS', jobId, event });
  if (event.status === 'done' || event.status === 'error') {
    es.close();
  }
};
```

**Why SSE over WebSocket**: WebSocket requires bidirectional protocol upgrade and more complex lifecycle management. SSE is HTTP, works through proxies/nginx without special config, auto-reconnects, and is sufficient for server→client progress events.

**Why SSE over polling**: Polling requires the client to decide frequency (too fast = load, too slow = laggy UX). SSE pushes immediately. For conversions that can take 10-60 seconds, immediate notification of completion matters.

### 6. File Storage

**Pattern**: Shared Docker volume accessible by both the FastAPI container and (if split) any worker container. No object storage (S3, MinIO) needed for v1 — local filesystem is sufficient.

**Directory layout**:
```
/data/
  uploads/
    {job_id}/
      input.pdf          # original upload
  results/
    {job_id}/
      output.md          # single file result
      output.zip         # batch result (multiple .md files)
  tmp/                   # intermediate files if needed
```

**Lifecycle**:
1. Upload received → save to `/data/uploads/{job_id}/input.{ext}`
2. Conversion runs → write to `/data/results/{job_id}/output.md`
3. Client downloads result via `/jobs/{id}/result` (streams from filesystem)
4. Client calls DELETE `/jobs/{id}` OR a background cleanup task removes files after TTL (e.g., 1 hour)

**No database needed**: Job state is in-process memory. This is a deliberate v1 constraint. If the FastAPI process restarts, in-flight jobs are lost, but temp files on disk can be cleaned up at startup.

---

## Data Flow

### Single File Conversion

```
1. User selects file + options in React UI
2. React POSTs multipart/form-data to POST /jobs
   → FastAPI saves file to /data/uploads/{id}/
   → Creates JobState{ status: "queued" }
   → asyncio.create_task(run_conversion(...))
   → Returns { job_id: "abc123", status: "queued" }

3. React opens EventSource to GET /jobs/abc123/stream
   → FastAPI SSE endpoint yields from asyncio.Queue

4. Background task (thread pool):
   → emit { status: "processing", progress: 0 }
   → asyncio.to_thread → DoclingAdapter.convert()
   → Docling loads/processes document (10s–60s)
   → emit { status: "processing", progress: 50 }  (if intermediate hooks available)
   → write output.md to /data/results/{id}/
   → emit { status: "done", progress: 100, result_url: "/jobs/abc123/result" }

5. React receives "done" event
   → Closes EventSource
   → Updates JobStore: status=DONE
   → ResultViewer fetches /jobs/abc123/result and renders Markdown

6. User optionally clicks Download → browser downloads /jobs/abc123/result
7. User or TTL cleanup → DELETE /jobs/abc123 removes files + JobState
```

### Batch Conversion (Multiple Files)

```
1. User selects N files → React fans out N independent POST /jobs requests
2. React tracks N job IDs, opens N SSE streams
3. Each job runs independently through the single-file flow
4. When all jobs reach DONE:
   → React requests a ZIP: POST /batch/zip { job_ids: [...] }
   → FastAPI assembles ZIP from /data/results/{id}/output.md files
   → Returns ZIP stream
   → React triggers download
```

Alternative: Server-side batch endpoint that accepts N files in one request and runs them sequentially or concurrently. Trade-off: simpler client but less granular per-file progress.

---

## Docker Compose Layout

### Service Architecture

```yaml
# docker-compose.yml (conceptual)

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"       # Vite dev server in dev mode
    # In production: nginx serving static build, proxying /api → backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - docling-data:/data
    environment:
      - WORKERS=2         # uvicorn worker count
      - DATA_DIR=/data

  # Optional: separate nginx for prod routing
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - frontend-build:/usr/share/nginx/html
    depends_on:
      - backend

volumes:
  docling-data:
```

### Why no separate worker service (for v1)?

A separate Celery worker container adds:
- Redis/RabbitMQ broker service
- Celery result backend (Redis or DB)
- Worker container with same Python deps
- Complexity in config, health checks, restart policies

For v1 with single-user self-hosted usage, **FastAPI + asyncio.to_thread is sufficient**. The CPU-bound work runs in the default thread pool executor without blocking the event loop. Uvicorn with 1-2 workers handles the load.

**Upgrade path to Celery**: If multi-user concurrency or job persistence across restarts becomes needed, the DoclingAdapter and task logic are already isolated — wrapping them in a Celery task is a contained change.

### Docling Model Downloads

Docling downloads ML models on first use (~several hundred MB). This must be handled in the Docker image build or via a volume mount to avoid re-downloading on every container start.

```dockerfile
# In backend/Dockerfile
FROM python:3.11-slim
RUN pip install docling
# Pre-download models at build time
RUN python -c "from docling.document_converter import DocumentConverter; DocumentConverter()"
```

Alternative: Mount a `~/.cache/docling` or `~/.cache/huggingface` volume for model persistence across container rebuilds.

---

## Suggested Build Order

The dependency graph determines what must exist before each component can be built and tested end-to-end.

### Phase 1 — Backend Core (no async, no frontend)
**Goal**: Docling converts a file, returns Markdown. Verify the integration works.

1. FastAPI project scaffold with Docker
2. `POST /jobs` endpoint — synchronous, blocking (temporary)
3. `DoclingAdapter` with `DocumentConverter` singleton
4. File save/read on shared volume
5. `GET /jobs/{id}/result` endpoint
6. Manual curl tests against running container

**Why first**: Docling is the riskiest dependency. Validate it works in Docker before building anything else. Discover model download issues, memory requirements, cold start time here.

### Phase 2 — Async Job Handling
**Goal**: Non-blocking conversions with in-memory job state.

1. `JobState` dataclass and in-memory `job_store`
2. `asyncio.to_thread` wrapping for `DoclingAdapter.convert()`
3. `asyncio.Queue` per job for event emission
4. `GET /jobs/{id}` polling endpoint
5. `GET /jobs/{id}/stream` SSE endpoint
6. Background cleanup task (TTL-based file removal)

**Why second**: Async infrastructure is needed before the frontend can show progress. Must be solid before React integration.

### Phase 3 — React Frontend (single file)
**Goal**: Upload → progress → result rendered in browser.

1. Vite + React project scaffold
2. File upload form with fetch POST
3. SSE consumer hook (`useJobStream`)
4. Job state management (useReducer or Zustand)
5. Markdown renderer (react-markdown)
6. Basic styling (Tailwind or CSS modules)

**Why third**: Frontend has no blockers once API is stable. Can start with polling fallback (`GET /jobs/{id}` polling) before SSE is wired in.

### Phase 4 — Options Panel + Batch
**Goal**: Expose Docling configuration; handle multiple files.

1. Option schema (basic defaults + advanced expandable)
2. `OptionMapper` in backend (HTTP params → PipelineOptions)
3. Batch fan-out in React (N parallel jobs)
4. ZIP assembly endpoint
5. Per-file progress in batch UI

### Phase 5 — Docker Compose Integration + Polish
**Goal**: Single `docker compose up` starts everything correctly.

1. Production Dockerfile for frontend (nginx static)
2. Nginx reverse proxy config (no CORS issues in prod)
3. Volume mounts, environment variables
4. Health check endpoints
5. Cold-start model download strategy finalized

---

## Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docling model download at runtime | Container startup takes minutes | Pre-download in Dockerfile or cache volume |
| `DocumentConverter` not thread-safe | Race conditions in concurrent conversions | Single instance + asyncio Lock, or converter pool |
| Large PDF memory spike | OOM in container | Set memory limits in Compose; warn user on large files |
| SSE connection dropped mid-conversion | Client misses completion event | Persist final state in JobStore; client can poll `/jobs/{id}` as fallback |
| Temp file accumulation | Disk full over time | TTL cleanup task + DELETE endpoint + total size limit |
| Uvicorn blocking under load | Slow if multiple concurrent conversions | Thread pool size tuning; document "single-user" scope in README |

---

## What Was Considered and Rejected

### Celery + Redis
Adds 2 extra services, ~200 lines of config, and Redis dependency for a feature set that asyncio handles adequately for single-user usage. Deferred to v2 if concurrency requirements emerge.

### WebSocket instead of SSE
More complex protocol, requires ws:// URL scheme, and needs special nginx config for proxying. SSE is unidirectional (server→client), fits the use case perfectly, works over plain HTTP, and is natively supported in browsers without libraries.

### Polling only (no SSE/WebSocket)
Simpler to implement but creates latency in result notification and unnecessary load. With 10-60s conversion times, even 2s polling intervals add noticeable wait. SSE solves this cleanly.

### Separate worker container (from day 1)
Operational overhead not justified for v1. The DoclingAdapter abstraction means it's easy to extract later.

### MinIO / S3 for file storage
Over-engineered for local self-hosted usage. Docker volumes are simpler, faster, and sufficient.

### SQLite/PostgreSQL for job state
No persistence requirement in v1. In-memory dict is simpler and has zero operational overhead. Jobs are ephemeral.

---

## Sources

This research is based on:
- Project requirements from `.planning/PROJECT.md`
- Docling library documentation and known API (Python ≥3.10, `DocumentConverter`, `export_to_markdown()`)
- FastAPI async patterns: `asyncio.to_thread`, `BackgroundTasks`, `StreamingResponse`
- SSE specification (W3C) and FastAPI SSE implementation patterns
- Docker Compose multi-service patterns for Python/Node stacks
- General knowledge of async ML inference serving architectures (Hugging Face, similar ML-heavy web services)
