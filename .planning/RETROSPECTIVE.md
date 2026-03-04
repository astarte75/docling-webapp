# Retrospective: Docling Webapp

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-04
**Phases:** 9 | **Plans:** 26 | **Commits:** ~125

### What Was Built

- FastAPI backend wrapping Docling with async job queue and SSE progress streaming
- React + Vite frontend with drag-and-drop upload, real-time progress, Markdown preview with tabs
- Configurable OCR: Auto, RapidOCR (default), EasyOCR, Tesseract — selectable from UI
- Batch conversion with per-file status tracking and ZIP download
- Cancel controls for single and batch conversions
- Emerald theme with dark/light mode, entry animations, two-column success layout
- Production Docker Compose stack: multi-stage Dockerfile (Node 22 → nginx 1.27), SSE-safe nginx config
- Multi-format support: PDF, DOCX, PPTX, XLSX, HTML, MD
- README + CHANGELOG, git tags v1.0 through v1.2

### What Worked

- **Phase-first approach:** Starting with Docling-in-Docker (Phase 1) before any frontend eliminated the biggest unknown early. Every subsequent phase built on a verified foundation.
- **SSE + asyncio.to_thread:** Simple async pattern worked well for single-user self-hosted use case. No Celery complexity needed.
- **Discriminated union AppPhase:** TypeScript exhaustive state modeling caught several bugs at compile time. Worth the upfront design effort.
- **Per-request DocumentConverter:** Docling's design (PipelineOptions baked at construction) made per-request instances the right call. The asyncio.Lock kept concurrency safe.
- **Human verification checkpoints:** Catching real bugs mid-phase (IPv6 healthcheck, SSE buffering) before moving forward saved rework.

### What Was Inefficient

- **Phase 5 was planned but replaced:** The roadmap originally had a Phase 5 for nginx deployment, but it was skipped and deferred to Phase 10 after other phases were inserted. Some confusion from phase numbering gaps (5, 6, 7...).
- **Vite proxy target bug:** Proxy was initially pointed at `localhost:8000` (container internal) instead of `localhost:3000` (host port). Caught during Phase 3 verification.
- **IPv6 healthcheck quirk:** BusyBox wget resolves `localhost` as `::1` in Alpine — only caught during live Docker testing. Could have been caught earlier with a documented note about Alpine networking.
- **UI language inconsistency:** Italian strings crept into the frontend across multiple phases and had to be cleaned up in a single pass after Phase 10. Better to enforce English from Phase 3.

### Patterns Established

- `asyncio.Lock` inside adapter wraps both construction and conversion — prevents race conditions under concurrent `asyncio.to_thread`
- `StreamingResponse` preferred over `EventSourceResponse` for SSE — the latter swallows `HTTPException` before stream start
- Healthcheck in Alpine containers: always use `127.0.0.1` explicitly, never `localhost`
- `proxy_buffering off` on the nginx `/api/` block is sufficient for SSE — no separate `location` block needed
- `start_period: 90s` on backend healthcheck accommodates Docling ML model loading time

### Key Lessons

1. **Validate Docker/networking assumptions early.** Alpine's IPv6 behavior and nginx buffering are non-obvious. Add a networking sanity check to Phase 1 of future Docker projects.
2. **Lock UI language in Phase 1.** Decide once and enforce — mixing languages across phases creates cleanup debt.
3. **Phase insertions work well.** Phases 6-10 were all inserted after Phase 4. The decimal/integer numbering scheme handled it cleanly without renumbering.
4. **SSE is simpler than expected.** `asyncio.Queue` per job + `StreamingResponse` generator is ~30 lines and handles backpressure, cancellation, and cleanup correctly.

### Cost Observations

- Model: 100% Sonnet 4.6
- Sessions: ~10 across 2 days
- Notable: Phase 1 and 3 were the heaviest (Docker setup + React scaffold). Later phases were faster due to established patterns.

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | LOC Added |
|-----------|--------|-------|------|-----------|
| v1.0 MVP | 9 | 26 | 2 | ~3,046 |
