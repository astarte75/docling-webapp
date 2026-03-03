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
- [ ] **Phase 4: Options Panel + Batch Conversion** - Add Docling configuration controls and multi-file batch support with ZIP download
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
| 4. Options Panel + Batch Conversion | 3/5 | In Progress|  |
| 5. Production Docker Compose | 0/3 | Not started | - |
