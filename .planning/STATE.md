---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-03T21:37:48.371Z"
progress:
  total_phases: 8
  completed_phases: 6
  total_plans: 22
  completed_plans: 21
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Convertire qualsiasi documento in Markdown pulito con un semplice browser upload, rendendo accessibile la potenza di Docling senza toccare la CLI.
**Current focus:** Phase 5 — Nginx Production Deployment

## Current Position

Phase: 8 of 9 (OCR Engine Research and Selection) — IN PROGRESS
Plan: 4 of 4 in phase 8 — plan 08-01 complete (all 4 plans executed)
Status: Phase 8 Plan 01 COMPLETE — OCR engine factory backend implemented
Last activity: 2026-03-03 — Phase 8 Plan 01: Four-engine OCR factory (auto/easyocr/rapidocr/tesseract) in adapter.py with per-job /convert Form selection

Progress: [█████████░] 94%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~17 min
- Total execution time: ~47 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-backend-core-docker-foundation | 2 | ~45 min | ~22.5 min |
| 02-async-job-system-sse-progress | 2 | ~32 min | ~16 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~10 min), 01-02 (~35 min), 02-01 (~2 min)
- Trend: stable

*Updated after each plan completion*
| Phase 01-backend-core-docker-foundation P01 | 1 | 3 tasks | 4 files |
| Phase 01-backend-core-docker-foundation P02 | 2 | 3 tasks | 3 files |
| Phase 02-async-job-system-sse-progress P01 | 3 | 2 tasks | 4 files |
| Phase 02-async-job-system-sse-progress P02 | 30 | 2 tasks | 1 files |
| Phase 03-react-frontend-single-file-flow P01 | 4 | 2 tasks | 20 files |
| Phase 03-react-frontend-single-file-flow P02 | 1 | 2 tasks | 3 files |
| Phase 03-react-frontend-single-file-flow P03 | 5 | 2 tasks | 2 files |
| Phase 03-react-frontend-single-file-flow P04 | 20 | 2 tasks | 2 files |
| Phase 04-options-panel-batch-conversion P02 | 5 | 2 tasks | 8 files |
| Phase 04-options-panel-batch-conversion P01 | 3 | 3 tasks | 7 files |
| Phase 04-options-panel-batch-conversion P03 | 6 | 1 tasks | 1 files |
| Phase 04-options-panel-batch-conversion P04 | 8 | 2 tasks | 4 files |
| Phase 04-options-panel-batch-conversion P05 | 15 | 3 tasks | 2 files |
| Phase 06-cancel-and-ux-fixes P01 | 2 | 3 tasks | 6 files |
| Phase 06-cancel-and-ux-fixes P02 | ~5 | 1 tasks | 0 files |
| Phase 07-visual-redesign-frontend-design P01 | 2 | 2 tasks | 3 files |
| Phase 07-visual-redesign-frontend-design P02 | 8 | 2 tasks | 3 files |
| Phase 07-visual-redesign-frontend-design P03 | 5 | 2 tasks | 0 files |
| Phase 08-ocr-engine-research-and-selection P02 | 8 | 3 tasks | 4 files |
| Phase 08-ocr-engine-research-and-selection P01 | 3 | 3 tasks | 4 files |

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
- [Phase 02-async-job-system-sse-progress]: StreamingResponse instead of EventSourceResponse for SSE — EventSourceResponse prevents HTTPException(404) from propagating before stream start
- [Phase 03-react-frontend-single-file-flow]: shadcn init requires path alias in tsconfig.json root — added compilerOptions.paths alongside project references
- [Phase 03-react-frontend-single-file-flow]: AppPhase discriminated union for exhaustive UI state modeling (idle/uploading/converting/success/error)
- [Phase 03-react-frontend-single-file-flow 03-02]: Callbacks via useRef in useJobStream — avoids infinite re-renders from inline function props
- [Phase 03-react-frontend-single-file-flow 03-02]: No upload progress bar — UploadZone hands file to parent via onFileSelected; App manages state machine
- [Phase 03-react-frontend-single-file-flow]: react-markdown v10: wrap in div.prose (not className on Markdown component) — v10 removed className prop
- [Phase 03-react-frontend-single-file-flow]: Copy feedback via useState+setTimeout 2s, no toast — no external dependency
- [Phase 03-react-frontend-single-file-flow]: Vite proxy target corrected to localhost:3000 (docker-compose host port) — was incorrectly set to localhost:8000 (container internal port)
- [Phase 03-react-frontend-single-file-flow]: jobId=null passed to useJobStream in all non-converting phases — prevents spurious SSE connections
- [Phase 04-options-panel-batch-conversion 04-02]: ConversionOptions uses null for pageFrom/pageTo to represent "use default" — avoids magic numbers
- [Phase 04-options-panel-batch-conversion 04-02]: Options snapshot captured at drop time, immutable per BatchFile — each file carries its own conversion config
- [Phase 04-options-panel-batch-conversion 04-02]: BatchFile.id uses crypto.randomUUID() client-generated — no server round-trip needed for list key
- [Phase 04-options-panel-batch-conversion]: Per-request DocumentConverter: Docling bundles PipelineOptions at construction time, so singleton cannot support per-job options
- [Phase 04-options-panel-batch-conversion]: Semaphore + create_task fire-and-forget: main loop non-blocking, Semaphore inside process_job limits concurrent Docling calls to MAX_CONCURRENT_JOBS
- [Phase 04-options-panel-batch-conversion]: ocr_languages as comma-separated Form string: HTML multipart doesn't natively support repeated field names in all clients
- [Phase 04-options-panel-batch-conversion 04-03]: Radix Select.Item does not accept empty string as value — use __none__ sentinel for "Qualsiasi (default)" option
- [Phase 04-options-panel-batch-conversion 04-03]: Single language select (not multi-select) — ocrLanguages array contains 0 or 1 elements for backend compatibility
- [Phase 04-options-panel-batch-conversion 04-04]: Direct EventSource (not useJobStream) in useBatchUpload — manages streams outside React lifecycle with Map-based deduplication via useRef
- [Phase 04-options-panel-batch-conversion 04-04]: Sequential uploads in addFiles() loop — simpler, avoids race condition; SSE streams are concurrent (each EventSource independent)
- [Phase 04-options-panel-batch-conversion 04-04]: retryFile() closes existing EventSource before retry — prevents ghost streams updating state after retry
- [Phase 04-options-panel-batch-conversion]: Single-file flow usa fetch diretto invece di useUpload per includere ConversionOptions nel FormData
- [Phase 04-options-panel-batch-conversion]: UploadZone usa onFilesSelected (array) + compact prop per riutilizzo in strip mode
- [Phase 06-cancel-and-ux-fixes]: cancelFile usa functional setFiles con guard per evitare race condition con evento SSE completed
- [Phase 06-cancel-and-ux-fixes]: setState({ phase: 'idle' }) sufficiente per chiudere SSE — useJobStream cleanup gestisce es.close() automaticamente
- [Phase 06-cancel-and-ux-fixes]: Header reset chiama clearFiles() + setState idle atomicamente per coprire qualsiasi fase dell'app
- [Phase 07-visual-redesign-frontend-design]: oklch emerald values exact from tailwindcolor.com: emerald-600 primary light, emerald-400 primary dark
- [Phase 07-visual-redesign-frontend-design]: ThemeProvider storageKey 'docling-theme' fixed, ModeToggle cycles only light/dark
- [Phase 07-visual-redesign-frontend-design]: Header flex spacer pattern keeps title centered with ModeToggle at right
- [Phase 07-visual-redesign-frontend-design]: Visual redesign approved by user: emerald palette, dark mode toggle, UploadZone glow, ResultViewer typography all confirmed correct
- [Phase 08-ocr-engine-research-and-selection]: OcrEngine type co-located with OcrMode in types/job.ts — keeps OCR-related types together
- [Phase 08-ocr-engine-research-and-selection]: Engine Select placed above language Select in advanced collapsible — engine choice is broader and more impactful
- [Phase 08-ocr-engine-research-and-selection]: Language label updated with (EasyOCR) hint to clarify which engines use the language setting
- [Phase 08-ocr-engine-research-and-selection 08-03]: EasyOCR recommended for scanned PDFs/multilingual; RapidOCR for fast CPU-only; Auto as default — see 08-BENCHMARK.md
- [Phase 08-ocr-engine-research-and-selection 08-03]: ocr_languages field is EasyOCR-only — must be documented in UI; applying it to other engines has no effect
- [Phase 08-ocr-engine-research-and-selection]: Engine factory dict (_OCR_ENGINE_CLASSES) for O(1) OCR engine lookup; ocr_languages restricted to EasyOCR only; Tesseract apt block before pip install; tesserocr C-API requires libtesseract-dev at build time

### Roadmap Evolution

- Phase 06 added: cancel-and-ux-fixes — cancel conversione in corso, navigazione logo→homepage, reset upload zone post-conversione
- Phase 07 added: visual-redesign-frontend-design — redesign estetico completo con font, colori, animazioni e microinterazioni (frontend-design skill)
- Phase 08 added: OCR Engine Research and Selection — ricerca alternative OCR migliori rispetto a Tesseract, implementazione selezione motore OCR nell'interfaccia
- Phase 09 added: Multi-arch Docker Compose Production Build — build multi-architettura (amd64/arm64) per deploy su server Linux x86, docker-compose unico per backend + frontend

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 Risk]: `DocumentConverter` thread-safety under concurrent `asyncio.to_thread` calls — use `asyncio.Lock`; validate during Phase 1 implementation
- [Phase 1 Risk]: Docling system dependencies in Docker may be incomplete for full OCR (Tesseract, poppler-utils) — verify during Phase 1 Docker work
- [Phase 5 Risk]: SSE + nginx buffering — `X-Accel-Buffering: no` header must be tested explicitly in Phase 5

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 08-03-PLAN.md — OCR engine benchmark written (08-BENCHMARK.md)
Resume file: None
