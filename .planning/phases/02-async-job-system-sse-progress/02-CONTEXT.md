# Phase 2: Async Job System + SSE Progress - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the blocking `/convert` endpoint with an async job pipeline: POST returns immediately with a `job_id` (HTTP 202), a SSE endpoint streams real-time progress events, and the final event includes the conversion result. No frontend work in this phase — API-only.

</domain>

<decisions>
## Implementation Decisions

### SSE event structure
- Emit 3 nominal phases: `started → converting → completed` (or `failed`)
- Event format: `{"type": "<phase>", "message": "<human-readable description>"}`
- No fake percentage — Docling is opaque, honest phase names are preferred over invented numbers

### Conversion result delivery
- The final SSE event includes the markdown directly: `{"type": "completed", "markdown": "..."}`
- No separate GET /jobs/{id} call required — client gets everything from the stream
- On failure: `{"type": "failed", "message": "<error description>"}`

### Job storage
- In-memory only (Python dict on the FastAPI app state)
- No TTL, no expiry — jobs persist until container restart
- No persistent storage required

### Concurrency / queue
- Jobs queue FIFO — never reject an incoming job
- The existing `asyncio.Lock` in DoclingAdapter already serializes conversions
- No queue size limit — accept all jobs

### Claude's Discretion
- Exact endpoint URL structure (e.g., `/jobs/{id}/stream` vs `/convert/{id}/events`)
- SSE keep-alive / heartbeat implementation
- How to store job state (dataclass, TypedDict, or simple dict)
- Temp file cleanup strategy for queued jobs

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard FastAPI SSE approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DoclingAdapter.convert_file(path)`: async method using `asyncio.to_thread` — ready to be called from a background task
- `asyncio.Lock` in adapter: already serializes conversions, queue can rely on this
- `lifespan` context manager in `main.py`: good place to initialize the job store alongside the adapter

### Established Patterns
- App state via `app.state`: converter is stored there, job store should follow the same pattern
- Error format `{"error": "..."}`: must be preserved for error responses
- Temp file lifecycle: already handled with try/finally in current `/convert` — same pattern needed for async path

### Integration Points
- `main.py`: `/convert` endpoint will be replaced or augmented; new SSE endpoint added
- `adapter.py`: no changes expected — already async-ready
- `config.py`: may need new env vars (none identified yet, Claude's discretion)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-async-job-system-sse-progress*
*Context gathered: 2026-03-02*
