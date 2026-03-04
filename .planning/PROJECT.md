# Docling Webapp

## What This Is

A self-hosted web application that exposes Docling's document conversion through a clean browser interface. Users can upload one or more documents (PDF, DOCX, PPTX, XLSX, HTML, MD) and receive Markdown output, with real-time SSE progress streaming, configurable OCR engines, batch conversion with ZIP download, and a dark/light theme.

## Core Value

Convert any document to clean Markdown with a simple browser upload — making Docling's power accessible without touching the CLI.

## Current State (v1.0 — shipped 2026-03-04)

- **Stack:** FastAPI 0.135 + Uvicorn 0.41 | React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS 4
- **Docling:** v2.76.0 with RapidOCR 1.4.4 (default), EasyOCR 1.7.2, Tesseract 2.10.0
- **Deployment:** Single `docker compose up --build -d` — nginx reverse proxy, pre-baked Docling models, configurable port/concurrency
- **LOC:** ~3,046 (Python + TS/TSX) across 9 phases, 26 plans
- **Formats:** PDF, DOCX, PPTX, XLSX, HTML, MD — up to 50MB per file

## Requirements

### Validated (v1.0)

- ✓ User can drag-and-drop or click-to-browse files — v1.0 (UPLD-01, UPLD-02)
- ✓ Client-side format and size validation with clear error messages — v1.0 (UPLD-03, UPLD-04)
- ✓ Single-file conversion with real-time SSE progress and Markdown preview — v1.0 (CONV-01..05, OUTP-01..03)
- ✓ Advanced options panel: OCR mode, table detection, page range, language selection — v1.0 (CONF-01..05)
- ✓ Batch conversion with per-file status badges and ZIP download — v1.0 (BTCH-01..04)
- ✓ Cancel in-progress conversions (single and batch) — v1.0 (UX-CANCEL-SINGLE, UX-CANCEL-BATCH)
- ✓ Header click resets app to idle state — v1.0 (UX-HEADER-NAV)
- ✓ OCR engine selection (Auto, RapidOCR, EasyOCR, Tesseract) with fallback badge — v1.0
- ✓ Emerald theme, dark/light mode toggle, entry animations, two-column success layout — v1.0
- ✓ Production Docker Compose stack with nginx, healthchecks, multi-format support — v1.0 (INFR-01..03)

### Active (next milestone)

- [ ] Multi-arch Docker images (linux/amd64 + linux/arm64) published to DockerHub
- [ ] Single `docker compose up -d` with pre-built images (no local build required)
- [ ] Makefile with `make push` build+push targets for both architectures
- [ ] `docker-compose.prod.yml` referencing registry images

### Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Self-hosted personal use — adds friction with no benefit |
| Persistent storage / database | Session-only; no GDPR surface, no added complexity |
| Cloud API calls | Defeats privacy value; all processing local |
| JSON/HTML output formats | Focus on Markdown; other formats v2+ |
| Audio/video conversion | Niche formats; Docling support secondary |
| Admin queue management UI | Use external tooling if Celery added in v2 |
| Embedded PDF viewer | Heavy dependency; out of scope for conversion tool |
| VLM pipeline (Granite-vision) | GPU required; v2+ feature |

## Context

- Docling 2.76.0 — LF AI & Data Foundation open-source library
- OCR: RapidOCR (CPU ONNX, default), EasyOCR (80+ langs), Tesseract (via tesserocr C-API)
- Models pre-baked in Docker image (~1.5 GB download at build time, zero latency at runtime)
- Conversion is CPU-bound and slow (~30s per PDF page on Apple Silicon); async worker + SSE keeps UX non-blocking
- IPv6/IPv4 quirk in BusyBox wget (Alpine): healthcheck must use `127.0.0.1` not `localhost`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI + asyncio.to_thread | Docling is Python; async without Celery complexity | ✓ Good — sufficient for single-user |
| DocumentConverter per-request | Docling bundles PipelineOptions at construction time | ✓ Good — enables per-job options |
| asyncio.Lock in DoclingAdapter | Thread-safety for concurrent Docling calls | ✓ Good — no race conditions observed |
| SSE via StreamingResponse | EventSourceResponse prevents HTTPException propagation | ✓ Good — clean error handling |
| React + Vite + Tailwind v4 | Modern SPA, minimal setup, shadcn/ui compatibility | ✓ Good — fast iteration |
| Discriminated union AppPhase | Exhaustive state modeling for UI transitions | ✓ Good — TypeScript catches all cases |
| RapidOCR as default OCR | CPU-only, multilingual, fast ONNX inference | ✓ Good — best default for self-hosted |
| Multi-stage Dockerfile.frontend | Node 22 build → nginx 1.27 serve | ✓ Good — ~50MB final image |
| 127.0.0.1 in healthcheck | BusyBox wget resolves localhost as IPv6 first in Alpine | ✓ Good — required fix |
| Markdown-only output | Focus on core use case | ✓ Good — no scope creep |

## Constraints

- **Python:** ≥3.10 required by Docling (using 3.12)
- **Execution:** Local models only — no cloud API calls
- **Output:** Markdown only for v1
- **Performance:** Heavy conversions run async; UX never blocks

---
*Last updated: 2026-03-04 after v1.0 milestone*
