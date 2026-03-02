# PITFALLS — Docling Webapp

> Research type: Project Research — Pitfalls dimension
> Milestone context: Greenfield
> Date: 2026-03-02

---

## Overview

This document captures known failure modes specific to building a FastAPI + React webapp that wraps Docling for document conversion. Each pitfall includes warning signs, a prevention strategy, and the phase where it must be addressed.

---

## P1 — Docling model download blocks the first request

**Category:** Docling integration
**Severity:** High

### Description

Docling downloads its layout models (EasyOCR, TableFormer, Heron layout model, etc.) on the first call to `DocumentConverter`. In a containerized environment this means the first HTTP request triggers a multi-GB download, causing a 2–10 minute timeout for the end user and likely crashing the request entirely.

### Warning signs

- No explicit model pre-warming in the Dockerfile or entrypoint
- `DocumentConverter()` is instantiated inside a request handler (not at module level or startup)
- First conversion in a fresh container silently hangs

### Prevention strategy

1. Add a model pre-download step to the Docker image build (`RUN python -c "from docling.document_converter import DocumentConverter; DocumentConverter()"`) or to a dedicated entrypoint script that runs before the server starts.
2. Instantiate `DocumentConverter` once at application startup (FastAPI `lifespan` or `@app.on_event("startup")`), not per-request.
3. Mount a named Docker volume for the Hugging Face model cache (`~/.cache/huggingface`) so models survive container rebuilds.
4. Log a clear startup message when models finish loading so ops can tell when the service is actually ready.

### Phase

Phase 1 (Backend skeleton / Docker setup). Must be solved before any end-to-end test.

---

## P2 — Blocking conversion inside an async FastAPI endpoint

**Category:** FastAPI async / long-running jobs
**Severity:** High

### Description

Docling conversion is CPU/IO bound and can take 30–300 seconds on a complex PDF. Running it directly inside an `async def` endpoint with `await` does not help — `DocumentConverter.convert()` is synchronous and will block the entire event loop, making the server unresponsive to all other requests.

### Warning signs

- `DocumentConverter.convert()` called directly in an `async def` handler
- No task queue or thread pool in the architecture
- Frontend polls a status endpoint but gets no response during conversion

### Prevention strategy

1. Run conversion in a thread pool using `asyncio.get_event_loop().run_in_executor(None, convert_fn)` or FastAPI's `BackgroundTasks` for fire-and-forget.
2. For production quality, use a proper task queue (Celery + Redis, or `arq`) so jobs survive server restarts and can be monitored.
3. Return a `202 Accepted` with a `job_id` immediately; expose a `/jobs/{id}/status` polling endpoint.
4. Set a per-job timeout to prevent zombie workers.

### Phase

Phase 1 (Backend API design). The async pattern must be baked in from the start — retrofitting it later requires rewriting all endpoints.

---

## P3 — Unbounded file upload size causes OOM or disk exhaustion

**Category:** FastAPI file handling
**Severity:** High

### Description

FastAPI's `UploadFile` buffers small files in memory and spills larger ones to a temp file, but there is no default size limit. A 500 MB PDF upload will fill `/tmp` or RAM, and multiple concurrent uploads multiply the problem. In Docker the default tmpfs or overlay filesystem can fill up quickly.

### Warning signs

- No `MAX_UPLOAD_SIZE` guard in the endpoint
- `await file.read()` called without checking `Content-Length` first
- No disk space monitoring on the container

### Prevention strategy

1. Enforce a size limit at the application layer by streaming the file and raising `413` if the total bytes exceed the threshold:
   ```python
   MAX_SIZE = 50 * 1024 * 1024  # 50 MB
   contents = await file.read(MAX_SIZE + 1)
   if len(contents) > MAX_SIZE:
       raise HTTPException(413, "File too large")
   ```
2. Configure Nginx (if used as reverse proxy) with `client_max_body_size`.
3. Use a dedicated upload directory mounted as a Docker volume with a known size, not `/tmp`.
4. Delete uploaded files immediately after conversion completes (or on job failure).

### Phase

Phase 1 (Backend API). Must be implemented before any public-facing test.

---

## P4 — Temp file leaks fill the disk over time

**Category:** FastAPI file handling / resource management
**Severity:** Medium

### Description

Every uploaded file and every intermediate Docling artifact (images extracted from PDFs, OCR temp files) must be cleaned up after the job. If the cleanup path is not reached on exception or timeout, temp files accumulate silently until the disk fills.

### Warning signs

- No `try/finally` or context manager around file operations
- No periodic cleanup job or TTL-based sweep
- Container disk usage grows monotonically in load tests

### Prevention strategy

1. Use `tempfile.TemporaryDirectory()` as a context manager for all per-job working directories — guaranteed cleanup even on exception.
2. Add a background sweep task that deletes directories older than N minutes.
3. Log file creation and deletion with sizes so leaks are visible in metrics.
4. Keep job working directories under a single root path (e.g., `/app/jobs/{job_id}/`) to make auditing easy.

### Phase

Phase 1 (Backend). Implement alongside the job model.

---

## P5 — DocumentConverter instantiated per-request causes high RAM and slow startup

**Category:** Docling integration / performance
**Severity:** High

### Description

`DocumentConverter` loads all enabled pipelines and their models into memory when instantiated. Instantiating it per request wastes several seconds and hundreds of MB of RAM per call. Under concurrent load this is catastrophic.

### Warning signs

- `DocumentConverter(...)` inside the route handler function
- RAM usage scales linearly with concurrent requests
- Profiling shows model-loading time > conversion time

### Prevention strategy

1. Create a single `DocumentConverter` instance at module level or via a FastAPI dependency with `lru_cache` / singleton pattern.
2. Reuse the same instance across all requests (it is stateless after initialization).
3. If different pipeline configurations are needed (standard vs VLM), maintain a small pool of pre-initialized converters, not one per request.

### Phase

Phase 1 (Backend). Lock in the singleton pattern in the first prototype.

---

## P6 — No backpressure on concurrent jobs leads to OOM

**Category:** FastAPI async / resource management
**Severity:** Medium

### Description

Docling with OCR enabled can use 2–4 GB RAM per job. Without a concurrency limit, even 3–4 simultaneous uploads on a typical 8 GB dev machine will OOM-kill the container.

### Warning signs

- No semaphore or queue depth limit in the backend
- `docker stats` shows memory climbing to the container limit under modest load
- No `mem_limit` set in `docker-compose.yml`

### Prevention strategy

1. Use an `asyncio.Semaphore` to cap concurrent conversions (e.g., max 2 at a time).
2. Return `503 Service Unavailable` or enqueue the job when the limit is reached.
3. Set `mem_limit` and `memswap_limit` in `docker-compose.yml` to fail fast rather than thrash.
4. Expose a `/health` endpoint that reports queue depth so ops can observe pressure.

### Phase

Phase 1/2 boundary. Implement before any load test or shared deployment.

---

## P7 — React frontend polls naively and hammers the backend

**Category:** Frontend / API design
**Severity:** Medium

### Description

Long-running jobs require the frontend to check job status. A naive `setInterval` polling every second per job floods the backend, especially with multiple concurrent uploads. This also creates confusing UX when the tab is backgrounded.

### Warning signs

- `setInterval(poll, 1000)` in React component
- No exponential backoff or polling stop on terminal status
- Backend access logs show hundreds of status requests per minute per client

### Prevention strategy

1. Use exponential backoff for polling: start at 1s, double up to 10s max.
2. Stop polling immediately when the job reaches a terminal state (`done`, `error`).
3. Clear intervals on component unmount to prevent memory leaks.
4. Consider Server-Sent Events (SSE) as a lightweight alternative to polling — FastAPI supports SSE natively with `StreamingResponse`.

### Phase

Phase 2 (Frontend job tracking). Design the polling strategy before writing the first status-checking component.

---

## P8 — CORS misconfiguration blocks frontend in development and production

**Category:** Docker Compose / FastAPI configuration
**Severity:** Medium

### Description

With FastAPI on port 8000 and Vite on port 5173 (or Nginx on 80), CORS errors are the first thing developers hit. Over-permissive CORS (`allow_origins=["*"]`) is then left in place for production, or conversely, production origins are hardcoded and break on port changes.

### Warning signs

- `CORSMiddleware` with `allow_origins=["*"]` committed to production config
- Hardcoded `http://localhost:5173` in backend
- CORS errors appear when switching from dev to prod Docker Compose profile

### Prevention strategy

1. Drive `allow_origins` from an environment variable (`CORS_ORIGINS=http://localhost:5173,https://mydomain.com`).
2. In Docker Compose, the frontend container calls the backend via the internal Docker network name (e.g., `http://backend:8000`), not `localhost`.
3. For production, put Nginx as a reverse proxy so frontend and backend share the same origin — eliminates CORS entirely.

### Phase

Phase 1 (Docker Compose setup). Define the env var pattern before writing the first fetch call.

---

## P9 — Vite dev server proxying not configured, causing mixed-content and path issues

**Category:** React + Vite / Docker Compose
**Severity:** Low-Medium

### Description

In development, Vite runs on its own port and `fetch('/api/...')` calls fail because there is no proxy configured. Developers add the full `http://localhost:8000` URL to every fetch call, which breaks inside Docker where the backend is not on `localhost`.

### Warning signs

- API base URL hardcoded in React components
- `fetch('http://localhost:8000/...')` in source code
- Works on host machine but fails inside Docker Compose network

### Prevention strategy

1. Configure `vite.config.ts` with a proxy: `'/api' -> 'http://backend:8000'` for Docker, `'http://localhost:8000'` for local dev.
2. Use an environment variable (`VITE_API_BASE_URL`) for the API base, defaulting to `/api` (proxied) in all environments.
3. In production, Nginx handles the proxy so the same relative `/api` path works.

### Phase

Phase 1 (Frontend scaffold). Set up the proxy before writing any API call.

---

## P10 — Docker image too large due to Docling + ML model weights

**Category:** Docker Compose / deployment
**Severity:** Medium

### Description

Docling pulls in PyTorch, Transformers, EasyOCR, and model weights. A naive Dockerfile without multi-stage builds or cache optimization produces images of 10–20 GB. This slows CI, increases disk usage on the server, and makes iterative development painful.

### Warning signs

- `docker build` takes >20 minutes
- Final image size >10 GB
- Model weights baked into the image layer (not in a volume)

### Prevention strategy

1. Use a multi-stage Dockerfile: `builder` stage installs dependencies, `runtime` stage copies only what is needed.
2. Do NOT bake model weights into the image. Mount a named volume and download models at first startup (with the pre-warming script from P1), or pre-populate the volume once and reuse it.
3. Use `pip install --no-cache-dir` and clean up apt caches in the same `RUN` layer.
4. Pin Docling to a specific version to prevent unexpected dependency bloat on rebuilds.

### Phase

Phase 1 (Dockerfile). Decide the volume strategy for models before the first `docker build`.

---

## P11 — No error propagation from Docling to the user

**Category:** Backend error handling
**Severity:** Medium

### Description

Docling raises a variety of exceptions (unsupported format, corrupt file, OCR failure, model inference error). If these are not caught and mapped to meaningful HTTP responses, the user sees a generic 500 or a job that is forever "processing".

### Warning signs

- Bare `except Exception` that swallows the error
- Job status never transitions to `error` state
- Frontend spinner runs indefinitely after a conversion failure

### Prevention strategy

1. Catch Docling-specific exceptions and map them to structured error responses with a `reason` field.
2. Always transition job status to `error` with a message in the `finally` block.
3. Log the full traceback server-side; return a sanitized message to the client.
4. Test explicitly with: a corrupt PDF, a zero-byte file, an unsupported MIME type, and a file that causes OCR timeout.

### Phase

Phase 2 (Error handling pass). Must be complete before any user testing.

---

## P12 — Forgetting to handle multipart/form-data correctly for batch uploads

**Category:** FastAPI file handling
**Severity:** Low-Medium

### Description

FastAPI handles `List[UploadFile]` for multi-file uploads, but the client must send the files as multiple fields with the same name, not as a JSON array. Frontend libraries often default to JSON bodies, causing 422 validation errors.

### Warning signs

- `422 Unprocessable Entity` on batch upload endpoint
- Frontend using `JSON.stringify` for file data instead of `FormData`
- Works for single file but fails for multiple

### Prevention strategy

1. Document and test the multipart format explicitly: `FormData.append('files', file)` repeated for each file.
2. Write a FastAPI endpoint test with `TestClient` using `files=[('files', ...), ('files', ...)]` to validate the contract early.
3. Set explicit `media_type="multipart/form-data"` in the OpenAPI schema for discoverability.

### Phase

Phase 2 (Batch upload feature). Validate the contract with a test before building the React batch UI.

---

## Summary Table

| ID  | Pitfall                                      | Severity | Phase      |
|-----|----------------------------------------------|----------|------------|
| P1  | Model download blocks first request          | High     | Phase 1    |
| P2  | Blocking conversion in async endpoint        | High     | Phase 1    |
| P3  | Unbounded file upload size                   | High     | Phase 1    |
| P4  | Temp file leaks                              | Medium   | Phase 1    |
| P5  | DocumentConverter per-request                | High     | Phase 1    |
| P6  | No concurrency limit → OOM                   | Medium   | Phase 1/2  |
| P7  | Naive polling hammers backend                | Medium   | Phase 2    |
| P8  | CORS misconfiguration                        | Medium   | Phase 1    |
| P9  | Vite proxy not configured                    | Low-Med  | Phase 1    |
| P10 | Docker image too large                       | Medium   | Phase 1    |
| P11 | No error propagation from Docling            | Medium   | Phase 2    |
| P12 | Multipart form-data for batch upload         | Low-Med  | Phase 2    |
