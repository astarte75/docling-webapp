# Changelog

## [v1.3] — 2026-03-28

### Changed
- Renamed `docker-compose.prod.yml` → `docker-compose.yml` (pre-built DockerHub images are now the default)
- Renamed `docker-compose.yml` → `docker-compose.build.yml` (build from source)
- Removed `nginx.conf` volume mount from default compose — nginx config is already baked into the frontend image via `Dockerfile.frontend`
- Deploy is now a single file: just copy `docker-compose.yml` to any machine and run `docker compose up -d`
- Updated all documentation (README, compose file comments, dev override) to reflect new naming

---

## [v1.2] — 2026-03-04

### Added
- Production Docker Compose stack (`docker-compose.yml`) with multi-stage frontend build (Node 22 → nginx 1.27)
- `Dockerfile.frontend` — multi-stage: Node 22-alpine build + nginx:1.27-alpine serve
- `nginx.conf` — SSE-safe reverse proxy (`proxy_buffering off`, `proxy_read_timeout 86400s`), SPA fallback
- `docker-compose.dev.yml` — development overrides with `--reload` and backend volume mount
- `.dockerignore` — excludes `node_modules`, `dist`, `__pycache__`, `.planning`, `.git`
- Multi-format upload support: DOCX, PPTX, XLSX, HTML, MD (previously PDF only)
- `README.md` — project description, version table, OCR engine details, installation guide for macOS / Linux / Windows

### Fixed
- Frontend healthcheck: replaced `localhost:80` with `127.0.0.1:80` to avoid IPv6 resolution failure in BusyBox wget (nginx:alpine)

### Changed
- Full English UI — all Italian strings replaced (badges, buttons, labels, error messages, Advanced options panel)
- Backend error message for unsupported file types now lists all accepted formats

---

## [v1.1] — 2025-12-15

### Added
- Batch file upload and conversion with ZIP download
- Per-file status badges and cancel support
- EasyOCR and Tesseract engine options alongside RapidOCR

---

## [v1.0] — 2025-11-01

### Added
- Initial release
- Single-file PDF conversion to Markdown via Docling
- Real-time SSE progress streaming
- OCR mode selector (Auto / On / Off)
- Advanced options: page range, table detection, language selection
- Dark / light theme toggle
