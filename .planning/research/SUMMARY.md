# Project Research Summary

**Project:** Docling Webapp
**Domain:** Document conversion web app (ML-backed, self-hosted)
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

This is a self-hosted document-to-Markdown conversion webapp built on top of the Docling Python library. The established pattern for this class of product is a thin HTTP API that accepts uploads and returns job IDs, a background processing layer that isolates the CPU-bound ML workload, and a React SPA that manages job state and renders results inline. The critical architectural insight from combined research is that Docling's `DocumentConverter` is synchronous and CPU-bound — it cannot be run in an async FastAPI handler without blocking the event loop. This single constraint drives most of the backend design.

The recommended approach differs subtly between the two research threads. STACK.md recommends Celery + Redis for production-grade durability and process isolation. ARCHITECTURE.md recommends `asyncio.to_thread` + SSE for v1 simplicity, deferring Celery to v2 when multi-user concurrency becomes a requirement. For this project's stated scope (self-hosted, single user, no persistence), the lighter asyncio approach is the pragmatic starting point, with a clean upgrade path to Celery already defined. The frontend layer is unambiguous: React 19 + Vite 6 + TanStack Query v5 with SSE-driven job status, progressive disclosure of Docling pipeline options, and Markdown preview before download.

The top risks are all rooted in Phase 1: Docling model downloads at runtime causing multi-minute first-request hangs, `DocumentConverter` being instantiated per-request instead of as a singleton, blocking synchronous conversion inside async handlers, and unbounded file upload sizes. All four are preventable with patterns clearly documented in research and must be addressed before any end-to-end testing begins.

---

## Key Findings

### Recommended Stack

FastAPI 0.115+ with Pydantic v2 is the unambiguous backend choice — its async model, automatic OpenAPI docs, and `UploadFile` streaming support map directly to the upload-queue-poll pattern. For async job execution, `asyncio.to_thread()` wrapping `DocumentConverter.convert()` is sufficient for single-user v1; Celery 5.4 + Redis 7 is the documented upgrade path if concurrency requirements grow. The frontend is React 19 + Vite 6, with TanStack Query v5 for server state management and SSE (not WebSockets, not polling) as the progress channel. Docker Compose v2 with a shared named volume connects the services.

**Core technologies:**
- **FastAPI 0.115+**: HTTP layer — async, Pydantic v2 validation, auto-generated OpenAPI schema
- **asyncio.to_thread / Celery 5.4 + Redis 7**: Async job execution — isolates CPU-bound Docling from the event loop
- **Docling 2.5+**: Document conversion engine — `DocumentConverter` singleton, pre-downloaded models
- **React 19 + Vite 6**: Frontend SPA — fast HMR, no SSR overhead
- **TanStack Query v5**: Server state — `refetchInterval`-based polling or SSE integration
- **shadcn/ui + Tailwind CSS 3.4**: UI components — headless, accessible, full style control
- **react-dropzone 14.x**: File upload UI — headless, zero dependencies beyond React
- **Docker Compose v2**: Multi-service orchestration — shared volume for uploads/results/models

**Critical version constraints:**
- Python 3.12 (not 3.13 — free-threaded builds experimental)
- Tailwind CSS 3.4 (not v4 — beta, breaking changes risk)
- Pydantic v2 required (FastAPI 0.100+ dropped v1 compatibility layer)

### Expected Features

**Must have (table stakes) — ship in v1:**
- Drag-and-drop + click upload with upload progress indicator
- File type validation client-side (PDF, DOCX, PPTX, XLSX, HTML, images, AsciiDoc)
- Multi-file batch upload support
- Async conversion with real-time progress indicator (SSE-driven)
- Clear success / error states with actionable error messages
- Rendered Markdown preview (react-markdown) before download
- Download single `.md` file or batch `.zip`
- Copy-to-clipboard button
- OCR toggle (on/off, auto-detect) and table detection toggle
- Page range input for large PDFs
- Simple / Advanced panel toggle (progressive disclosure)
- Docker Compose single-command deployment

**Should have (differentiators) — v1.1:**
- OCR language selection (EasyOCR language packs)
- Table output format control (GFM / HTML / CSV-in-fenced-code)
- Image resolution slider for OCR quality vs. speed
- Force full-page OCR override
- Per-file status display in batch conversion
- YAML frontmatter metadata in output (source filename, conversion date, settings)

**Defer (v2+):**
- VLM pipeline (Granite-vision) — GPU-intensive, requires separate hardware check
- Side-by-side source/output preview (PDF.js dependency, ~1MB)
- Session-scoped conversion history
- Preset configurations ("Scanned document", "Academic paper")
- Mobile optimization pass

**Anti-features — deliberately not building:**
- User accounts / authentication (self-hosted, no need, adds friction)
- Persistent storage / database (session-only, no GDPR surface)
- Cloud API calls (defeats self-hosted privacy value proposition)
- Admin queue management UI (use Flower externally if needed)

### Architecture Approach

The architecture is a three-tier single-container system for v1: React SPA communicates with FastAPI over HTTP and SSE, FastAPI manages in-memory job state and dispatches work via `asyncio.to_thread()` to a `DoclingAdapter` singleton, and results are written to a shared Docker named volume accessible by both frontend (via API streaming) and the backend. The DoclingAdapter is deliberately isolated as an abstraction boundary — this makes the upgrade from `asyncio.to_thread` to a Celery worker a contained change limited to that module. SSE over `StreamingResponse` handles the progress channel: simpler than WebSocket, HTTP-native, works through nginx without special config, and auto-reconnects.

**Major components:**
1. **React SPA** — UploadForm, SSEManager (EventSource), JobStore (useReducer/Zustand), ResultViewer, BatchManager
2. **FastAPI API Layer** — request validation, job ID generation, SSE streaming, file routing
3. **Job Manager (in-process)** — `dict[job_id → JobState]`, `asyncio.Queue` per job for SSE events, `asyncio.Semaphore` for concurrency cap
4. **DoclingAdapter** — `DocumentConverter` singleton, option translation (HTTP params → PipelineOptions), thread-pool execution
5. **Shared Volume** — `/data/uploads/{job_id}/`, `/data/results/{job_id}/` — accessible by API container, cleaned by TTL sweep

### Critical Pitfalls

1. **Docling model download blocks first request (P1, HIGH)** — Pre-download models at Docker build time (`RUN python -c "from docling.document_converter import DocumentConverter; DocumentConverter()"`) AND mount a named volume for the HuggingFace cache. Instantiate `DocumentConverter` once at FastAPI startup via `lifespan`, not per-request.

2. **Blocking conversion inside async endpoint (P2, HIGH)** — Never call `DocumentConverter.convert()` directly in an `async def` handler. Always wrap with `asyncio.to_thread()` or `loop.run_in_executor()`. Return `202 Accepted` with `job_id` immediately.

3. **DocumentConverter per-request (P5, HIGH)** — Creates a new model-loading cycle per request. Use a module-level singleton or FastAPI dependency with `lru_cache`. One instance is reusable across all requests after initialization.

4. **Unbounded file upload size causes OOM (P3, HIGH)** — Enforce `MAX_UPLOAD_SIZE` (50MB recommended) by checking byte count during streaming read. Also configure nginx `client_max_body_size`. Use a dedicated Docker volume for uploads, not `/tmp`.

5. **No concurrency limit leads to OOM (P6, MEDIUM)** — Docling with OCR uses 2–4 GB RAM per job. Cap concurrent conversions with `asyncio.Semaphore(2)`. Set `mem_limit` in `docker-compose.yml`. Return `503` when limit is reached.

---

## Implications for Roadmap

Based on combined research, the dependency graph enforces a clear 5-phase build order. Phase 1 is the highest-risk phase — it must prove the core Docling integration works in Docker before any other work proceeds.

### Phase 1: Backend Core + Docker Foundation
**Rationale:** Docling is the riskiest dependency. Model downloads, memory footprint, cold-start time, and thread-safety all need to be proven in a Docker environment before building anything else. Four of the five critical pitfalls (P1, P2, P3, P5) must be resolved here. This phase is the riskiest and needs the most care.
**Delivers:** Working FastAPI container that accepts a file upload and returns Markdown synchronously (blocking OK for now). Dockerfile with pre-downloaded models. Named volume for model cache.
**Addresses:** File upload acceptance, basic format validation
**Avoids:** P1 (model download latency), P2 (blocking async), P3 (unbounded uploads), P5 (per-request converter), P8 (CORS config), P9 (Vite proxy), P10 (Docker image size)

### Phase 2: Async Job System + SSE Progress
**Rationale:** Async infrastructure must exist before the frontend can show progress. Converting from synchronous to async + SSE is a contained backend change once DoclingAdapter is working. Must be solid before React integration to avoid frontend rework.
**Delivers:** Non-blocking conversions with in-memory job state, SSE progress stream, polling fallback endpoint, TTL-based cleanup
**Uses:** `asyncio.to_thread`, `asyncio.Queue`, `asyncio.Semaphore`, FastAPI `StreamingResponse`
**Implements:** Job Manager component, EventBus, background cleanup task
**Avoids:** P4 (temp file leaks), P6 (concurrency OOM), P7 (naive polling), P11 (error propagation)

### Phase 3: React Frontend — Single File Flow
**Rationale:** Frontend has no blockers once the async API is stable. Can start with polling against `GET /jobs/{id}` before wiring SSE. This phase proves the end-to-end user journey: upload → progress → preview → download.
**Delivers:** Complete single-file conversion UX — drag-and-drop, upload progress, SSE-driven job status, rendered Markdown preview, download and copy-to-clipboard
**Uses:** React 19, Vite 6, TanStack Query v5, react-dropzone 14, react-markdown, shadcn/ui, Tailwind 3.4
**Implements:** UploadForm, SSEManager hook, JobStore, ResultViewer

### Phase 4: Docling Options Panel + Batch Conversion
**Rationale:** Options panel and batch handling are isolated features that layer on top of the working single-file flow. The progressive disclosure pattern keeps the simple path clean. Batch is a frontend fan-out pattern with a ZIP assembly endpoint.
**Delivers:** Advanced options panel (OCR toggle, table detection, page range), batch multi-file upload, per-file status display, ZIP download
**Uses:** Docling `PdfPipelineOptions`, `OptionMapper` backend component, `BatchManager` frontend component
**Avoids:** P12 (multipart form-data batch contract)

### Phase 5: Docker Compose Polish + Production Readiness
**Rationale:** Production Dockerfile, nginx reverse proxy, and environment variable configuration should be finalized after features are stable to avoid iterating on infrastructure while features change.
**Delivers:** Single `docker compose up` production deployment — nginx serving built frontend assets, proxying `/api` to backend, health check endpoints, environment variable configuration for CORS and settings
**Uses:** nginx:alpine, multi-stage Dockerfiles, Docker Compose named volumes
**Avoids:** P8 (CORS — solved with nginx same-origin), P9 (proxy config)

### Phase Ordering Rationale

- Phase 1 before everything: Docling in Docker is the riskiest unknown. Validating it first prevents discovering blocking issues after significant frontend work.
- Phase 2 before Phase 3: Frontend polling/SSE integration requires a working async backend. Building in the right order avoids rewriting the status-checking components.
- Phase 4 after Phase 3: Advanced options and batch are feature additions on top of a working base flow. Progressive disclosure means simple mode ships earlier.
- Phase 5 last: Infrastructure polish makes most sense when features are stable. Iterating on nginx config while features change wastes effort.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Docling v2.x Docker integration specifics — exact system dependencies (`libgl1-mesa-glx`, `libgomp1`), model cache paths, and memory requirements under different pipeline configurations need verification against actual Docling 2.5+ releases.
- **Phase 4:** VLM pipeline option — GPU detection from within FastAPI, Granite model availability check, and conditional UI gating need deeper investigation if VLM is scoped into v1.1.

Phases with standard patterns (skip additional research):
- **Phase 2:** asyncio + SSE patterns are well-documented in FastAPI. Standard implementations available.
- **Phase 3:** React 19 + TanStack Query + react-dropzone patterns are extensively documented.
- **Phase 5:** nginx reverse proxy + Docker Compose static serving is a solved, well-documented pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major decisions backed by official docs and strong community consensus. Versions verified as current stable releases. |
| Features | HIGH | Clear competitive analysis against real tools. Docling API capabilities cross-referenced with documented options. Feature scoping is well-reasoned against PROJECT.md constraints. |
| Architecture | MEDIUM-HIGH | Two research threads produced slightly different recommendations (Celery vs asyncio). Both are valid — asyncio is right for v1 scope, Celery is the documented upgrade path. Thread-safety of `DocumentConverter` needs runtime validation. |
| Pitfalls | HIGH | All pitfalls are grounded in real failure modes specific to this stack. Phase assignments are accurate. Prevention strategies are concrete and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **`DocumentConverter` thread-safety under concurrent `asyncio.to_thread` calls:** Research notes it "is not thread-safe if sharing state" but also says "safe pattern is a single instance with a lock." The asyncio.Lock approach needs to be validated during Phase 1 implementation. If locking becomes a bottleneck, a small converter pool is the fallback.
- **Docling 2.5+ exact system dependencies in Docker:** The Dockerfile in STACK.md lists `libgl1-mesa-glx`, `libglib2.0-0`, `libgomp1`. This list may be incomplete for full OCR functionality (Tesseract, poppler-utils). Validate during Phase 1 Docker work.
- **SSE + nginx buffering:** The `X-Accel-Buffering: no` header suppresses nginx buffering for SSE. This needs explicit testing in the production nginx configuration in Phase 5.
- **Celery vs asyncio decision point:** The architecture explicitly defers this to v2. If usage patterns during Phase 1-3 development reveal that even single-user load saturates the thread pool, escalate to Celery earlier. The DoclingAdapter abstraction makes this a contained change.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official documentation (fastapi.tiangolo.com) — 0.115.x async patterns, UploadFile, StreamingResponse, CORS
- Celery documentation (docs.celeryq.dev) — 5.4.x task configuration, worker memory management
- Docling GitHub (github.com/DS4SD/docling) — v2.x DocumentConverter API, PipelineOptions, format support
- TanStack Query documentation — v5 refetchInterval, useMutation
- React release notes — v19 (December 2024)
- Vite changelog — v6 (November 2024)

### Secondary (MEDIUM confidence)
- react-dropzone README (14.x) — headless API, onDrop callback
- shadcn/ui documentation — Radix UI primitives, Tailwind integration
- SSE specification (W3C) + FastAPI SSE implementation patterns — StreamingResponse media_type

### Tertiary (LOW confidence)
- Docling system dependency list in Docker — may be incomplete for all OCR backends; validate during Phase 1
- `DocumentConverter` thread-safety under concurrent load — documented as "safe with lock" but needs runtime validation

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
