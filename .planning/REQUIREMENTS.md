# Requirements: Docling Webapp

**Defined:** 2026-03-02
**Core Value:** Convertire qualsiasi documento in Markdown pulito con un semplice browser upload, rendendo accessibile la potenza di Docling senza toccare la CLI.

## v1 Requirements

### Upload & File Handling

- [x] **UPLD-01**: User can drag-and-drop one or more files onto the upload area
- [x] **UPLD-02**: User can click to browse and select files from the file system
- [ ] **UPLD-03**: System validates file format client-side and rejects unsupported types with a clear error message (PDF, DOCX, PPTX, XLSX, HTML, PNG, JPEG, TIFF, AsciiDoc)
- [ ] **UPLD-04**: System enforces a 50MB per-file size limit (configurable via env var) and shows a clear rejection message for oversized files
- [ ] **UPLD-05**: User sees a progress bar during file upload to the server

### Conversion

- [x] **CONV-01**: User can trigger document conversion with a single action after upload
- [x] **CONV-02**: System processes conversion asynchronously and returns immediately with a job ID (non-blocking)
- [x] **CONV-03**: User sees real-time conversion progress driven by Server-Sent Events (SSE)
- [x] **CONV-04**: User sees a clear success state with result preview when conversion completes
- [x] **CONV-05**: User sees a clear error state with an actionable error message when conversion fails

### Output

- [ ] **OUTP-01**: User sees a rendered Markdown preview of the converted document inline in the browser
- [ ] **OUTP-02**: User can download the converted document as a `.md` file
- [ ] **OUTP-03**: User can copy the full Markdown content to clipboard with a single click

### Configuration

- [ ] **CONF-01**: User can set OCR mode (auto / on / off) from the main interface with a simple control
- [ ] **CONF-02**: User can expand/collapse an advanced options panel for additional Docling settings
- [ ] **CONF-03**: User can toggle table detection on/off in the advanced panel
- [ ] **CONF-04**: User can set a page range (from / to) for PDF documents in the advanced panel
- [ ] **CONF-05**: User can select OCR language from a list of supported EasyOCR languages in the advanced panel

### Batch Conversion

- [ ] **BTCH-01**: User can upload multiple files in a single session from the same upload area
- [ ] **BTCH-02**: User sees individual conversion status for each file in the batch (pending / converting / done / error)
- [ ] **BTCH-03**: System converts batch files in parallel up to a maximum of 2 concurrent jobs (configurable via env var)
- [ ] **BTCH-04**: User can download all successfully converted files as a single `.zip` archive

### Infrastructure

- [x] **INFR-01**: Application starts with a single `docker compose up` command
- [x] **INFR-02**: Docling models are pre-downloaded in the Docker image so the first conversion does not hang waiting for downloads
- [x] **INFR-03**: Application is accessible via browser at a configurable localhost port (default 3000)

## v2 Requirements

### Advanced Docling Options

- **ADV-01**: User can enable VLM pipeline (Granite-vision) for layout-aware conversion — GPU check required
- **ADV-02**: User can set image resolution for OCR quality vs. speed trade-off
- **ADV-03**: User can force full-page OCR override regardless of auto-detection

### Output Enhancements

- **OUTP-04**: User can select table output format (GFM / HTML / CSV-in-fenced-code)
- **OUTP-05**: Output Markdown includes YAML frontmatter with source filename, conversion date, and settings used

### UX Improvements

- **UX-01**: Side-by-side source (PDF preview) and Markdown output
- **UX-02**: Dark mode support
- **UX-03**: Session-scoped conversion history (lost on page refresh)
- **UX-04**: Preset configurations (e.g. "Scanned document", "Academic paper")
- **UX-05**: Mobile optimization pass

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Self-hosted, personal use — auth adds friction with no benefit |
| Persistent storage / database | Session-only; no GDPR surface, no added complexity |
| Cloud API calls | Defeats privacy value of self-hosted; all processing local |
| Output formats other than Markdown | Focus on core use case; JSON/HTML export is v2+ |
| Audio/video conversion (WAV, MP3, WebVTT) | Niche formats; Docling support is secondary feature |
| Admin queue management UI | Use Flower externally if Celery is introduced in v2 |
| PDF viewer embedded | Heavy dependency (~1MB PDF.js); out-of-scope for conversion tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| CONV-01 | Phase 1 | Complete |
| CONV-02 | Phase 2 | Complete |
| CONV-03 | Phase 2 | Complete |
| CONV-04 | Phase 2 | Complete |
| CONV-05 | Phase 2 | Complete |
| UPLD-01 | Phase 3 | Complete |
| UPLD-02 | Phase 3 | Complete |
| UPLD-03 | Phase 3 | Pending |
| UPLD-04 | Phase 3 | Pending |
| UPLD-05 | Phase 3 | Pending |
| OUTP-01 | Phase 3 | Pending |
| OUTP-02 | Phase 3 | Pending |
| OUTP-03 | Phase 3 | Pending |
| CONF-01 | Phase 4 | Pending |
| CONF-02 | Phase 4 | Pending |
| CONF-03 | Phase 4 | Pending |
| CONF-04 | Phase 4 | Pending |
| CONF-05 | Phase 4 | Pending |
| BTCH-01 | Phase 4 | Pending |
| BTCH-02 | Phase 4 | Pending |
| BTCH-03 | Phase 4 | Pending |
| BTCH-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
