# Roadmap: Docling Webapp

## Overview

Five phases that build from the riskiest unknown outward. Phase 1 proves Docling runs correctly in Docker — the single biggest technical risk — before any frontend work begins. Phase 2 adds the async job system and SSE progress channel that the frontend depends on. Phase 3 delivers the complete single-file conversion UX, making the app usable end-to-end. Phase 4 layers in advanced configuration options and batch conversion as isolated feature additions. Phase 5 hardens the Docker Compose deployment for self-hosted production use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Core + Docker Foundation** - Prove Docling works in Docker and establish the FastAPI upload endpoint (completed 2026-03-02)
- [x] **Phase 2: Async Job System + SSE Progress** - Add non-blocking conversion pipeline with real-time progress via SSE (completed 2026-03-03)
- [x] **Phase 3: React Frontend — Single File Flow** - Complete end-to-end UX for uploading, converting, previewing, and downloading one file (completed 2026-03-03)
- [x] **Phase 4: Options Panel + Batch Conversion** - Add Docling configuration controls and multi-file batch support with ZIP download (completed 2026-03-03)
- [ ] **Phase 5: Production Docker Compose** - Finalize deployment with nginx, environment configuration, and health checks

## Phase Details

### Phase 1: Backend Core + Docker Foundation
**Goal**: Docling runs correctly inside Docker and accepts a file upload, returning converted Markdown
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, CONV-01
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` starts the backend container without errors
  2. User can POST a PDF to the API and receive Markdown back (blocking response acceptable in this phase)
  3. Docling models are present in the Docker image — no download occurs on first request
  4. The API rejects files over 50MB with a clear error response
  5. The `DocumentConverter` is instantiated once at startup, not per request
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Dockerfile + docker-compose.yml with Docling pre-installed and models pre-downloaded
- [x] 01-02-PLAN.md — FastAPI app with `/convert` endpoint, `DoclingAdapter` singleton, upload size enforcement

### Phase 2: Async Job System + SSE Progress
**Goal**: Conversions run non-blocking and clients receive real-time progress events
**Depends on**: Phase 1
**Requirements**: CONV-02, CONV-03, CONV-04, CONV-05
**Success Criteria** (what must be TRUE):
  1. POSTing a file to `/convert` returns immediately with a `job_id` (HTTP 202)
  2. Connecting to the SSE endpoint streams conversion progress events in real time
  3. A completed job's markdown is delivered inline in the final SSE event
  4. A failed conversion returns a structured error message describing what went wrong
  5. Jobs queue FIFO — no request is rejected, all are accepted and processed in order
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Job dataclass + FIFO conversion_worker, async POST /convert returning 202 + job_id
- [x] 02-02-PLAN.md — GET /jobs/{job_id}/stream SSE endpoint with StreamingResponse, end-to-end verification

### Phase 3: React Frontend — Single File Flow
**Goal**: A user can upload one document, watch it convert, and download or copy the Markdown result
**Depends on**: Phase 2
**Requirements**: UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, OUTP-01, OUTP-02, OUTP-03
**Success Criteria** (what must be TRUE):
  1. User can drag a file onto the upload area or click to browse and select a file
  2. Unsupported file types are rejected client-side before upload with a clear error message
  3. A file over 50MB is rejected client-side with a clear size error message
  4. After upload, the user sees live conversion progress driven by the SSE stream (spinner, no progress bar — per user decision)
  5. When conversion completes, the user sees rendered Markdown inline, can download the `.md` file, and can copy the content to clipboard
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — Vite + React scaffold, TypeScript types, Tailwind v4, shadcn/ui, TanStack Query, Vite /api proxy
- [ ] 03-02-PLAN.md — useUpload + useJobStream hooks, UploadZone component with drag-and-drop and validation
- [ ] 03-03-PLAN.md — ConversionProgress spinner, ResultViewer with Preview/Raw tabs + sticky action bar
- [ ] 03-04-PLAN.md — App.tsx state machine wiring all components + human verification checkpoint

### Phase 4: Options Panel + Batch Conversion
**Goal**: Users can configure Docling settings and convert multiple files at once, downloading results as a ZIP
**Depends on**: Phase 3
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, BTCH-01, BTCH-02, BTCH-03, BTCH-04
**Success Criteria** (what must be TRUE):
  1. User can set OCR mode (auto / on / off) from the main interface without opening any panel
  2. User can expand an advanced panel revealing table detection toggle, page range inputs, and OCR language selector
  3. User can upload multiple files in one session and see individual status for each file (pending / converting / done / error)
  4. The backend converts batch files with a maximum of 2 concurrent jobs running simultaneously
  5. User can download all successfully converted files as a single `.zip` archive with one click
**Plans**: 5 plans

Plans:
- [ ] 04-01-PLAN.md — Backend ConversionOptions dataclass, DoclingAdapter + PipelineOptions, semaphore worker, POST /convert form fields
- [ ] 04-02-PLAN.md — Frontend types (ConversionOptions, BatchFile, AppPhase), JSZip + shadcn components install
- [ ] 04-03-PLAN.md — OptionsPanel component (OCR ToggleGroup + Collapsible advanced panel)
- [ ] 04-04-PLAN.md — useBatchUpload hook, BatchFileRow + BatchList components with ZIP download
- [ ] 04-05-PLAN.md — UploadZone multi-file + App.tsx wiring + human verification checkpoint

### Phase 5: Production Docker Compose
**Goal**: The application deploys with a single command and is ready for self-hosted production use
**Depends on**: Phase 4
**Requirements**: (Infrastructure hardening — no new v1 requirements; INFR-01/02/03 established in Phase 1, finalized here)
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts the full stack (nginx + backend + frontend build) with no manual steps
  2. The app is accessible in the browser at `localhost:3000` (port configurable via env var)
  3. nginx serves the built React assets and proxies `/api` requests to the FastAPI backend
  4. SSE streams through nginx without buffering issues (X-Accel-Buffering: no header applied)
  5. All tunable settings (port, upload size limit, concurrency) are configurable via environment variables with documented defaults
**Plans**: TBD

Plans:
- [ ] 05-01: Production multi-stage Dockerfiles (backend Python, frontend Node build + nginx serve)
- [ ] 05-02: nginx configuration (static serving, `/api` proxy, SSE buffering, `client_max_body_size`)
- [ ] 05-03: Final docker-compose.yml with named volumes, env var configuration, health checks

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Core + Docker Foundation | 2/2 | Complete   | 2026-03-02 |
| 2. Async Job System + SSE Progress | 2/2 | Complete   | 2026-03-03 |
| 3. React Frontend — Single File Flow | 4/4 | Complete   | 2026-03-03 |
| 4. Options Panel + Batch Conversion | 5/5 | Complete   | 2026-03-03 |
| 5. Production Docker Compose | 0/3 | Not started | - |

### Phase 6: cancel-and-ux-fixes

**Goal:** Add cancellation controls for in-progress conversions, clickable header for global reset, and "Nuova conversione" button in success state — pure frontend UX controls, no backend changes
**Requirements**: UX-CANCEL-SINGLE, UX-CANCEL-BATCH, UX-HEADER-NAV, UX-RESET-SUCCESS
**Depends on:** Phase 5
**Plans:** 2/2 plans executed — COMPLETE

Plans:
- [x] 06-01-PLAN.md — Extend types, add cancelFile hook, update ConversionProgress/BatchFileRow/BatchList/App.tsx
- [x] 06-02-PLAN.md — Human verification of all four UX controls

### Phase 7: visual-redesign-frontend-design

**Goal:** Redesign visivo completo del frontend: palette emerald come accent, dark mode con toggle nell'header, UploadZone con bordo e glow emerald, ResultViewer con tipografia curata e dark:prose-invert
**Requirements**: (visual design — no nuovi requirement ID; miglioramento estetico dei componenti esistenti)
**Depends on:** Phase 6
**Plans:** 3/3 plans complete

Plans:
- [ ] 07-01-PLAN.md — CSS vars emerald in index.css, ThemeProvider context, ModeToggle componente
- [ ] 07-02-PLAN.md — App.tsx wiring ThemeProvider + ModeToggle, UploadZone glow emerald, ResultViewer tipografia
- [ ] 07-03-PLAN.md — Human verification checkpoint del redesign visivo completo

### Phase 8: OCR Engine Research and Selection

**Goal:** Expose OCR engine selection (Auto, EasyOCR, RapidOCR, Tesseract) in the UI and backend; install Tesseract and RapidOCR in the Docker image; produce a written benchmark document
**Requirements**: (feature addition — no new requirement IDs; extends CONF-05 pattern)
**Depends on:** Phase 7
**Plans:** 3/4 plans executed

Plans:
- [ ] 08-01-PLAN.md — Backend engine factory in adapter.py, ocr_engine Form param in main.py, Dockerfile + requirements.txt
- [ ] 08-02-PLAN.md — Frontend OcrEngine type in job.ts, engine Select in OptionsPanel, ocrEngine wired to FormData
- [ ] 08-03-PLAN.md — Written benchmark document (08-BENCHMARK.md)
- [ ] 08-04-PLAN.md — Human verification checkpoint

### Phase 9: UI Improvements

**Goal:** Improve the frontend interface with bug fixes and visual enhancements — fix the OCR Mode/Engine inconsistency (selecting a specific engine deselects Auto), and apply design improvements (animations, background, layout polish) using the frontend-design skill
**Requirements**: (UX improvements — no new requirement IDs)
**Depends on:** Phase 8
**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md — Split two-column layout in App.tsx for success state (340px sidebar + flex-1 ResultViewer)
- [ ] 09-02-PLAN.md — Human verification checkpoint of all Phase 9 UI improvements

### Phase 10: Multi-arch Docker Compose Production Build

**Goal:** Produce a production `docker-compose.yml` that builds and runs the full stack (FastAPI backend + React frontend via nginx) as multi-architecture images (linux/amd64 and linux/arm64), enabling one-command deployment on any Linux x86 or ARM server with no manual steps
**Requirements**: INFR-01, INFR-02, INFR-03
**Depends on:** Phase 9
**Plans:** TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 10 to break down)

### Phase 11: DockerHub Multi-arch Publish

**Goal:** Build and publish multi-arch Docker images (linux/amd64 + linux/arm64) to DockerHub so end users can deploy the full stack with a single `docker compose up -d` without building locally — includes Makefile with buildx push targets and a `docker-compose.prod.yml` referencing pre-built images
**Requirements**: (release automation — no new requirement IDs)
**Depends on:** Phase 10
**Plans:** TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 11 to break down)
