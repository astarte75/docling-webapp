# Features Research — Docling Webapp

**Research type:** Project Research — Features dimension
**Date:** 2026-03-02
**Milestone context:** Greenfield — what to build first

---

## Research Question

What features do document conversion web apps have? What is table stakes vs differentiating for a tool that wraps Docling for document-to-Markdown conversion?

---

## Competitive Landscape: Document Conversion Web Apps

### Reference products analyzed

- **Pandoc web frontends** (TryPandoc, Pandoc Online) — minimal UI wrapping CLI, format-in/format-out
- **Smallpdf / ILovePDF / PDF2Doc** — polished consumer-grade converters, heavy on UX
- **CloudConvert** — API-first conversion service, broad format support, progress polling
- **Mathpix Snip / PDF to Markdown** — specialized academic/technical converters with LaTeX/table support
- **Marker** (web front for marker-pdf) — open-source PDF-to-Markdown, similar space to Docling
- **Adobe Acrobat Export** — incumbent, good table/layout fidelity, cloud-only
- **Docling CLI** — the direct predecessor UX; what this webapp replaces for non-technical users

---

## Feature Categories

### 1. TABLE STAKES — Must have or users leave immediately

These are baseline expectations users bring from any file conversion tool. Missing these creates immediate abandonment.

#### File Upload

| Feature | Complexity | Notes |
|---|---|---|
| Drag-and-drop upload zone | Low | Industry standard since ~2015, users expect it |
| Click-to-browse fallback | Low | Accessibility and mobile fallback |
| Upload progress indicator | Low | Visual feedback during upload, especially for large PDFs |
| File size display | Low | User-facing confirmation of what was received |
| File type validation (client-side) | Low | Reject unsupported formats before upload, with clear error message |
| Multiple file selection | Medium | Docling supports batch; users expect multi-select from OS dialog |

**Dependencies:** File type validation depends on knowing Docling's accepted MIME types list.

#### Conversion Feedback

| Feature | Complexity | Notes |
|---|---|---|
| Progress indicator during conversion | Medium | Async jobs; spinner or progress bar while Docling runs |
| Clear success/error states | Low | "Done" vs "Failed: OCR model not found" — must be explicit |
| Estimated time or "processing" state | Low | Docling on complex PDFs can take 30–120s; user must know it's working |
| Error message with actionable copy | Low | "File could not be parsed" is useless; "PDF appears to be image-only, try enabling OCR" is useful |

**Dependencies:** Requires async job architecture on backend (already decided in PROJECT.md).

#### Result Delivery

| Feature | Complexity | Notes |
|---|---|---|
| Markdown preview (rendered) | Medium | Render the Markdown in-browser so user can validate quality before download |
| Download as .md file | Low | Primary delivery mechanism |
| Download as .zip for batch | Low | Multiple files → archive, per PROJECT.md requirement |
| Copy to clipboard button | Low | High-value for single-file use case (paste into Obsidian, Notion, etc.) |

**Dependencies:** Rendered preview needs a Markdown renderer (e.g., react-markdown). Clipboard API is browser-native.

#### Supported Formats (must accept all Docling formats)

| Format | Complexity | Notes |
|---|---|---|
| PDF (native text) | Baseline | Core use case |
| PDF (scanned/image) | Medium | Requires OCR pipeline |
| DOCX / DOC | Low | Docling handles natively |
| PPTX | Low | Docling handles natively |
| XLSX | Low | Docling handles natively; table output quality matters |
| HTML | Low | Docling handles natively |
| PNG / JPEG / TIFF / BMP | Medium | Image inputs, always require OCR |
| AsciiDoc | Low | Docling handles natively |

**Dependencies:** Format support is entirely determined by the Docling version deployed. UI must reflect actual backend capabilities.

---

### 2. DIFFERENTIATORS — Competitive advantage in this niche

These features are not found in generic converters and are only possible because this app wraps Docling specifically.

#### Docling-Specific Pipeline Exposure

| Feature | Complexity | Notes |
|---|---|---|
| OCR toggle (on/off) | Low | Simple boolean. Default: auto-detect (on for images, off for native PDFs). Expose as a checkbox. |
| OCR language selection | Medium | Docling uses EasyOCR/Tesseract engines; language affects accuracy significantly for non-Latin scripts |
| Table detection toggle | Low | Simple boolean. Docling has dedicated TableFormer model. Default: on. |
| Table output format control | Medium | Tables can render as Markdown tables (GFM), HTML, or CSV-in-fenced-code. User choice matters. |
| Page range selection | Medium | For large PDFs, let user specify "pages 1–20" to avoid long processing on unwanted content |
| Image resolution for OCR | Medium | DPI setting affects OCR quality vs speed trade-off |
| Force OCR mode | Low | Override auto-detection; useful for PDFs with embedded text but bad encoding |
| VLM pipeline option | High | Docling supports Granite-vision VLM pipeline for higher-quality layout understanding. GPU-intensive. Only expose if hardware supports it. |

**VLM Pipeline note:** This is Docling's most differentiating feature vs Marker/other tools. However, it requires a GPU or significant CPU time. The UI should expose it but gated behind a warning ("This pipeline is significantly slower but produces higher quality results for complex layouts"). It must be disabled by default.

**Dependencies:**
- VLM option depends on whether the deployed backend has the Granite model available
- OCR language depends on which EasyOCR language packs are installed in the Docker image
- Table format control requires the backend to pass the right `TableFormerMode` or output serialization options

#### Progressive Disclosure UI Pattern

| Feature | Complexity | Notes |
|---|---|---|
| Simple mode (defaults only) | Low | Upload → Convert → Download. Zero config. This is the primary path. |
| Advanced panel (expandable) | Medium | Collapsible section reveals pipeline options. Hidden by default. |
| Preset configurations | Medium | "Scanned document", "Academic paper", "Spreadsheet" — pre-fill advanced options. Nice UX but not critical. |

**Dependencies:** None. Pure frontend concern.

#### Quality & Fidelity Indicators

| Feature | Complexity | Notes |
|---|---|---|
| Docling version display | Low | Users integrating this into workflows need to know what version produced the output |
| Conversion metadata in output | Low | Optionally prepend a YAML frontmatter block to .md with source filename, conversion date, settings used |
| Confidence/quality warnings | High | Docling doesn't expose per-page confidence scores publicly; would require custom instrumentation |

#### Batch Processing UX

| Feature | Complexity | Notes |
|---|---|---|
| Per-file status in batch | Medium | Show individual progress per document when batch-converting |
| Partial download (some succeeded, some failed) | Medium | Download the zip of files that converted OK even if one file failed |
| Re-run failed files only | High | Complex state management. Probably out of scope for v1. |

---

### 3. NICE-TO-HAVE — V2+ territory

These are valuable but not necessary for v1 and add significant complexity.

| Feature | Complexity | Reason to defer |
|---|---|---|
| Side-by-side preview (source + markdown) | High | Requires PDF rendering in browser (PDF.js) — heavy dependency |
| Dark mode | Low | Cosmetic; easy to add via CSS variables but not a conversion feature |
| Conversion history (session-only) | Medium | In-memory session list of "what you converted today" — no persistence needed |
| Shareable result URL | High | Requires persistence/storage — explicitly out of scope in PROJECT.md |
| Export to other formats (HTML, JSON) | Medium | Out of scope for v1 per PROJECT.md |
| Webhook/API endpoint for programmatic use | High | Converts the app to a service — separate product |
| Mobile-optimized upload | Medium | touch-friendly but document conversion is mostly a desktop workflow |

---

### 4. ANTI-FEATURES — Deliberately NOT building

These are things that would be tempting to add but would harm the product's focus, add maintenance burden, or contradict the stated design philosophy.

| Anti-feature | Reason to avoid |
|---|---|
| User accounts / authentication | PROJECT.md is explicit: self-hosted personal use, no auth needed. Adding it creates login friction and maintenance burden with zero value for the target use case. |
| Persistent storage / conversion history DB | SESSION ONLY. A database means migrations, backups, GDPR concerns. The value prop is "convert and download", not "store your documents". |
| Cloud API calls (OpenAI, AWS Textract, etc.) | Docling runs models locally. Sending documents to a cloud API defeats the privacy/self-hosted value proposition. |
| Output formats other than Markdown (v1) | JSON, HTML, DOCX output adds UI complexity and multiplies QA surface. Markdown is the focus. |
| "Pretty" PDF viewer embedded in app | PDF.js is ~1MB, complex, and not needed when the OUTPUT is what matters, not the input visualization. |
| Real-time collaborative conversion | No use case for this tool. Would require WebSockets, session sharing, server-side state — massive complexity for zero value. |
| Conversion queue management UI (admin) | Celery/Redis queue introspection dashboard. This is devops tooling, not user-facing. Use Flower/existing tools externally if needed. |
| Multi-language UI (i18n) | Adds localization maintenance overhead. The underlying tool (Docling) and Markdown are language-agnostic anyway. |

---

## Docling Feature Set — What to Expose in the UI

Based on Docling's documented capabilities (as of v2.x with Heron layout model):

### Pipeline Types

| Pipeline | What it does | UI exposure | Complexity |
|---|---|---|---|
| Standard pipeline | Rule-based layout analysis + TableFormer for tables | Default, always available | — |
| OCR pipeline | Adds EasyOCR/Tesseract for text extraction from images | Toggle in advanced options | Low |
| VLM pipeline | Granite-vision model for high-fidelity layout understanding | Advanced option with warning | High |

### Key Docling Options to Surface

```
DocumentConverter options (simplified mapping to UI controls):

pipeline_options:
  do_ocr: bool                    → "Enable OCR" checkbox [default: auto]
  ocr_options:
    lang: list[str]               → "OCR Language" multi-select [default: ["en"]]
    force_full_page_ocr: bool     → "Force full-page OCR" checkbox [default: false]
  do_table_structure: bool        → "Detect tables" checkbox [default: true]
  table_structure_options:
    do_cell_matching: bool        → "Improve table cell accuracy" checkbox [default: true]
  images_scale: float             → "Image resolution" slider (1.0 = 72dpi, 2.0 = 144dpi) [default: 1.0]
  generate_page_images: bool      → Internal use only, not surfaced

page_range: [start, end]          → "Page range" input (optional) [default: all pages]
```

### Table Output Format Options

Docling can serialize tables in multiple ways. This is a meaningful UI choice:

| Option | Output example | Best for |
|---|---|---|
| Markdown GFM table | `\| col1 \| col2 \|` | Most Markdown viewers, GitHub, Obsidian |
| HTML table (in Markdown) | `<table>...</table>` | When GFM table width is a problem |
| CSV in fenced code block | ` ```csv ` | Data extraction use case |

**Recommendation:** Default to GFM Markdown table. Expose HTML and CSV as advanced options.

### Format-Specific Notes for UI

| Format | Special handling needed |
|---|---|
| Scanned PDF | Auto-detect and suggest enabling OCR if no text layer found |
| XLSX | Tables extracted as Markdown tables; formula results used (not formulas themselves) |
| PPTX | Slide titles become H2 headers; each slide is a section |
| Images | Always requires OCR; should auto-enable OCR when image files are uploaded |
| HTML | Cleans boilerplate (nav, footer); extracts main content |

---

## Feature Priority Matrix (v1 scope)

### Must ship in v1

- Drag-and-drop + click upload
- Multi-file support (batch)
- File type validation with clear errors
- Async conversion with progress indicator
- Markdown preview (rendered, not raw)
- Download single .md / batch .zip
- Copy to clipboard
- OCR toggle (on/off, auto-detect)
- Table detection toggle
- Page range input
- Simple/Advanced panel toggle (progressive disclosure)
- Clear error states with actionable messages
- Docker Compose deployment

### Target for v1.1

- OCR language selection
- Table output format control (GFM / HTML / CSV)
- Image resolution slider
- Force OCR override
- Per-file status in batch
- Conversion metadata in Markdown frontmatter

### Not in v1

- VLM pipeline (complexity + hardware requirement)
- Preset configurations
- Side-by-side source/output preview
- Session-scoped conversion history
- Partial batch download on failure
- Mobile optimization pass

---

## Key Dependencies Between Features

```
Async job backend
  └── Progress indicator
  └── Per-file batch status
  └── Error state handling

OCR auto-detection
  └── Image file upload → auto-enable OCR
  └── Scanned PDF detection → suggest enabling OCR

Advanced panel (progressive disclosure)
  └── OCR language
  └── Table format control
  └── Page range
  └── Force OCR
  └── Image resolution

VLM pipeline (future)
  └── Requires GPU presence detection on backend
  └── Requires Granite model download (~7GB)
  └── Should be gated: if unavailable, option is greyed out with explanation
```

---

## Sources & Research Basis

- PROJECT.md: stated requirements, out-of-scope items, and constraints
- Docling documentation (docling-project.github.io/docling): pipeline types, options, format support, Heron layout model, TableFormer, VLM/Granite pipeline
- Docling GitHub (github.com/DS4SD/docling): PipelineOptions, OCROptions, TableStructureOptions, DocumentConverter API
- Competitive analysis: Smallpdf, ILovePDF, CloudConvert, Marker, Mathpix, TryPandoc
- Web app UX patterns: progressive disclosure, async job feedback, drag-and-drop upload

---

*Research completed: 2026-03-02*
*Feeds into: requirements definition, UI component planning*
