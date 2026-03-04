# Phase 4: Options Panel + Batch Conversion - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Docling configuration controls (OCR mode always visible, advanced panel collapsible) and multi-file batch conversion with per-file status tracking and ZIP download. Single-file flow from Phase 3 remains intact — batch mode is a natural extension of the same upload zone, not a separate mode.

</domain>

<decisions>
## Implementation Decisions

### OCR control placement
- OCR toggle (Auto/On/Off) lives **above** the upload zone — user configures before dropping files
- Presented as a **segmented button** (ToggleGroup): `[Auto] [On] [Off]` — all three options visible at once, no click to reveal
- Default: Auto
- Below the OCR toggle: a collapsible `[▼ Opzioni avanzate]` trigger

### Advanced panel
- Opens as **accordion inline** — expands downward in the same column, above the upload zone
- Contents: Table detection toggle, Page range (from/to), OCR language selector
- Page range: `from` and `to` fields; `to` empty = convert until last page (no validation error for empty `to`)

### Options binding
- Options are **baked in at drop time** — when user drops files, current OCR/advanced settings are sent to the backend for those files
- Changing options after dropping does NOT affect already-queued files
- This enables per-file option variance: drop doc1 with Auto, change to OCR On, drop doc2 → different options per file

### Batch mode activation
- **Transparent / native multi-file** — no "batch mode" toggle; upload zone always accepts multiple files
- 1 file dropped → single-file flow (as today, result shown inline)
- 2+ files dropped → batch list appears automatically
- User can add more files mid-batch via `[+ Aggiungi altri file]` button

### Batch layout
- When files are processing: upload zone compacts to a strip at top (`[+ Aggiungi altri file]`) — same pattern as single-file success state in Phase 3
- Batch list occupies the center: **compact rows** — filename + status badge per row
- Status values: `pending` / `converting` / `done` / `error`
- Below the list: `[Scarica ZIP (N file)]` button — appears as soon as ≥1 file is done (disabled if 0 done), shows count of successful files

### Error handling in batch
- Each error row has an inline `[Riprova]` button for per-file retry
- Retry re-queues that single file with its original options

### Settings persistence
- Options are **sticky for the session** — remain set until user changes them explicitly
- Reset to defaults (Auto, no advanced options) on page refresh
- No localStorage persistence

### Claude's Discretion
- Exact styling/colors for status badges (pending/converting/done/error)
- Animation for the converting state (spinner inline in the row)
- ZIP button disabled state styling while conversions are in progress
- Error message display for failed files (tooltip vs inline text)

</decisions>

<specifics>
## Specific Ideas

- The batch list layout should feel consistent with the single-file result area — same border/rounded style already used in App.tsx success state
- ZIP download button label shows count of successful files: "Scarica ZIP (2 file)" — helps user know what they're getting when some files failed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UploadZone` (frontend/src/components/UploadZone.tsx): currently calls `onFileSelected(file: File)` — needs to be extended to support multi-file via `onFilesSelected(files: File[])` or made to detect count
- `card.tsx`: exists, can wrap the batch list container
- `button.tsx`: exists, used for ZIP download and retry buttons
- `tabs.tsx`: exists but not needed for this phase
- `AppPhase` type (frontend/src/types/job.ts): discriminated union — needs new batch phases (e.g. `batch-active`, `batch-complete`) or refactored to support both flows

### Established Patterns
- State machine pattern in App.tsx: discriminated union `AppPhase` — batch state should follow same pattern
- SSE streaming via `useJobStream` hook — reusable per-file, just needs multiple instances or a batch-aware wrapper
- Upload zone compacts on success: already implemented in App.tsx — batch mode reuses this same compact strip pattern

### Integration Points
- Backend `POST /convert`: currently accepts one file per request, returns `job_id` — batch uploads multiple files as separate requests (one per file), frontend manages concurrency
- Backend `GET /jobs/{job_id}/stream`: one SSE connection per job — frontend opens N streams for N files
- `DoclingAdapter.convert_file(file_path)`: needs a `PipelineOptions` parameter for OCR mode, table detection, page range, OCR language
- `Job` dataclass and `conversion_worker` in job_store.py: worker is currently single FIFO — needs semaphore-based concurrency limit (max 2 concurrent, configurable via env var)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-options-panel-batch-conversion*
*Context gathered: 2026-03-03*
