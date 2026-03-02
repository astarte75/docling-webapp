# Phase 1: Backend Core + Docker Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove Docling runs correctly inside Docker and accepts a PDF file upload, returning converted Markdown via a synchronous blocking response. No frontend work. The API contract defined here (response shape, error format) becomes the foundation that Phase 2 (async) and Phase 3 (frontend) build on.

</domain>

<decisions>
## Implementation Decisions

### File format scope
- Accept only PDF in Phase 1 (proof of concept — the primary use case)
- Validation via FastAPI: check Content-Type header + file extension before saving to disk
- Reject non-PDF with HTTP 415 `{"error": "Unsupported file type. Only PDF accepted."}`
- `ALLOWED_EXTENSIONS = {".pdf"}` as a hardcoded constant — easy to extend in Phase 4 by adding entries

### Temporary file handling
- Save uploaded PDF to `/tmp/<uuid>.pdf`
- Convert with Docling
- Return Markdown response
- Delete temp file immediately after conversion (success or failure)
- No persistent upload directory

### API response shape (success)
- HTTP 200 OK
- Content-Type: application/json
- Body: `{"markdown": "<converted content>"}`
- Simple and extensible: Phase 2 adds `job_id` and `status` fields, the `markdown` field stays consistent

### Upload size limit
- Reject files over 50MB with HTTP 413 `{"error": "File exceeds 50MB limit"}`
- Configurable via env var: `MAX_UPLOAD_SIZE_MB` (default: `"50"`)
- Applied before saving file to disk

### DoclingAdapter lifecycle
- Instantiated once at application startup via FastAPI lifespan context manager
- Stored in `app.state.converter`
- Destroyed cleanly on shutdown
- Never instantiated per-request

### Error response format
- All errors return `{"error": "<message>"}` JSON body — consistent field name for the frontend
- HTTP 413: file too large
- HTTP 415: unsupported file type
- HTTP 422: Docling conversion failed — includes the original exception message for debugging
- HTTP 500: unexpected server errors (generic)

### Logging
- Python `logging` module on stdout
- Uvicorn access log + application logs visible via `docker compose logs`
- INFO level for normal operations (request received, conversion complete, timing)
- ERROR level with traceback for failures

### Claude's Discretion
- Exact Python project structure (flat vs src layout)
- requirements.txt vs pyproject.toml
- Uvicorn worker configuration
- Exact apt packages needed for Docling native deps

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns

### Integration Points
- `/convert` endpoint is the sole integration point for Phase 2 (which will replace it with async `/convert` → HTTP 202 + job_id)

</code_context>

<specifics>
## Specific Ideas

- No specific requirements — open to standard FastAPI/Docker approaches

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-backend-core-docker-foundation*
*Context gathered: 2026-03-02*
