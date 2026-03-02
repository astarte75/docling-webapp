# Phase 3: React Frontend — Single File Flow - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete end-to-end UX for uploading one PDF, watching it convert, and downloading or copying the Markdown result. One file at a time. Batch, options panel, and configuration controls are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Layout
- Hero-style upload area centered and prominent on initial load
- After conversion completes: upload area shrinks to a compact form at the top (stays visible — user can immediately drop another file without scrolling)
- Result section appears below: generic "Conversion complete" message + prominent download button + full-width Markdown preview
- No split view — single-column flow

### Conversion state
- No upload progress bar — transition directly from file selected to "Converting..." state (UPLD-05 is technically a requirement but user confirmed it adds no value for typical PDF sizes; Claude can implement a minimal/instant progress if needed to satisfy the requirement without visual noise)
- Converting state: animated spinner + static text "Converting your document..."
- No fake progress steps or changing messages — honest minimal UI
- Error state: error message displayed + file remains selected + retry button — user can retry without reselecting the file
- Success state: upload area compresses to top, result section appears below

### Result viewer
- Full-width preview area below the action bar
- Tab switcher: "Preview" (rendered Markdown via react-markdown, default) | "Raw" (monospace source)
- Sticky action bar at the top of the preview area — always visible when scrolling long results
- Action bar contains: "Download .md" button (primary) + "Copy to clipboard" button
- Copy feedback: button text changes to "Copied!" for 2 seconds, then reverts — no toast

### Claude's Discretion
- Exact spacing, typography, and color palette within shadcn/ui + Tailwind constraints
- Upload area visual design (border style, icon, helper text)
- Exact compact layout of upload area after conversion (height, visibility of dropzone vs just a button)
- Loading skeleton or transition animations between states
- Error message formatting and iconography

</decisions>

<specifics>
## Specific Ideas

- Use case is task-focused and single-shot: user opens app, converts one file, closes — not a persistent workspace
- Download is the primary action; preview is secondary (user wants to confirm "it worked", not read the output)
- Keep it simple and fast — no unnecessary chrome

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing frontend — starting from scratch with Vite + React + shadcn/ui + Tailwind + TanStack Query + react-dropzone (stack defined in ROADMAP.md Phase 3 plans)

### Established Patterns
- Backend error format: always `{"error": "..."}` (HTTPException handler in main.py)
- SSE event types: `started` → `completed` (with `markdown` field) | `failed` (with `message` field)
- File validation: backend enforces `.pdf` only and 50MB max — frontend must mirror these client-side for UX (UPLD-03, UPLD-04)
- Job flow: POST /convert → {job_id} (202) → GET /jobs/{job_id}/stream (SSE)

### Integration Points
- `POST /convert` — multipart/form-data with `file` field → returns `{job_id}`
- `GET /jobs/{job_id}/stream` — SSE stream, connect immediately after receiving job_id
- SSE `completed` event carries `markdown` inline: no second request needed
- Frontend runs on separate port from backend in dev; nginx proxies `/api` in production (Phase 5)

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-react-frontend-single-file-flow*
*Context gathered: 2026-03-03*
