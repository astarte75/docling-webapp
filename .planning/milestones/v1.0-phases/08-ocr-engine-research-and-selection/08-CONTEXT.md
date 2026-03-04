# Phase 8: OCR Engine Research and Selection - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Research OCR engine alternatives available natively in Docling, evaluate accuracy/speed/dependency trade-offs, produce a written benchmark document, and expose engine selection in the UI (advanced options) and backend so users can pick the best engine for their documents.

</domain>

<decisions>
## Implementation Decisions

### Engine support
- Support 4 engine options: **Auto** (OcrAutoOptions), **EasyOCR** (EasyOcrOptions), **RapidOCR** (RapidOcrOptions), **Tesseract** (TesseractOcrOptions)
- OcrMac excluded (macOS only, useless in Docker Linux)
- TesseractCliOcrOptions excluded (redundant with TesseractOcrOptions)
- PaddleOCR, Surya, cloud engines (AWS/Google) excluded — not natively supported by Docling

### UI placement
- Engine selector goes inside the existing **advanced options collapsible** in OptionsPanel.tsx
- Consistent with current pattern (table detection, language select are already there)

### Missing engine handling
- If a selected engine is not installed in the container: **clear error message** surfaced to the user
- Error should indicate what needs to be installed (e.g., "RapidOCR not available — install rapidocr-onnxruntime")
- No silent fallback — user must make an explicit choice

### Benchmark scope
- Produce a **written benchmark document** (manual comparison, not automated script)
- Document covers: accuracy on scanned PDFs, speed on CPU, Docker image size impact, language coverage, and recommendation per use case
- Document lives in `.planning/phases/08-ocr-engine-research-and-selection/` as `08-BENCHMARK.md`

### Claude's Discretion
- Exact UI label/description for each engine option in the dropdown
- Whether "Auto" is the default selected engine or EasyOCR remains default
- Dockerfile changes needed to install Tesseract and RapidOCR
- How to surface the "engine not installed" error (backend exception vs. startup check)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/adapter.py`: `ConversionOptions` dataclass — add `ocr_engine: str = "easyocr"` field; `build_pipeline_options()` — extend to map engine string → correct `*OcrOptions` class
- `frontend/src/components/OptionsPanel.tsx`: advanced options Collapsible already contains Select (language) and Switch (table detection) — add a new Select for engine in the same section
- `frontend/src/types/job.ts`: `ConversionOptions` type — add `ocrEngine` field with union type

### Established Patterns
- Backend options flow: `ConversionOptions` dataclass → `build_pipeline_options()` → `PdfPipelineOptions(ocr_options=...)` — engine selection plugs directly into this
- Frontend options flow: `OptionsPanel` emits `ConversionOptions` via `onChange` → `App.tsx` sends as form fields to `/convert` — add `ocr_engine` form field
- Docling OCR options classes: `OcrAutoOptions`, `EasyOcrOptions`, `RapidOcrOptions`, `TesseractOcrOptions` all imported from `docling.datamodel.pipeline_options`

### Integration Points
- `backend/adapter.py:build_pipeline_options()` — primary change point for engine mapping
- `backend/main.py:/convert` endpoint — add `ocr_engine: str = Form(default="easyocr")` parameter
- `frontend/src/components/OptionsPanel.tsx` advanced section — add engine Select between existing controls

</code_context>

<specifics>
## Specific Ideas

- Engine selector should show friendly names: "Auto (best available)", "EasyOCR", "RapidOCR (fast)", "Tesseract"
- Benchmark document should give a clear recommendation per document type (scanned PDF, native PDF with images, multilingual doc)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-ocr-engine-research-and-selection*
*Context gathered: 2026-03-03*
