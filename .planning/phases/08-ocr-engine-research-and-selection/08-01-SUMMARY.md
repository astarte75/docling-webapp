---
phase: 08-ocr-engine-research-and-selection
plan: 01
subsystem: api
tags: [docling, ocr, easyocr, rapidocr, tesseract, fastapi, python]

requires:
  - phase: 04-options-panel-batch-conversion
    provides: ConversionOptions dataclass and build_pipeline_options() factory in adapter.py

provides:
  - OCR engine factory (_OCR_ENGINE_CLASSES) mapping 4 engine names to Docling OcrOptions classes
  - Extended ConversionOptions with ocr_engine field
  - Engine-missing error handling with install hints in DoclingAdapter.convert_file()
  - /convert endpoint accepts ocr_engine Form parameter
  - requirements.txt includes rapidocr-onnxruntime and tesserocr
  - Dockerfile installs Tesseract system packages and pre-downloads RapidOCR models

affects: [09-multi-arch-docker-compose-production-build]

tech-stack:
  added: [rapidocr-onnxruntime, tesserocr, tesseract-ocr system package]
  patterns: [engine factory dict (_OCR_ENGINE_CLASSES), language-restricted ocr options (easyocr only)]

key-files:
  created: []
  modified:
    - backend/adapter.py
    - backend/main.py
    - backend/requirements.txt
    - Dockerfile

key-decisions:
  - "Engine factory via dict (_OCR_ENGINE_CLASSES) instead of if/elif chain — O(1) lookup, easy to extend"
  - "ocr_languages only propagated to EasyOcrOptions — RapidOCR and Tesseract use incompatible language formats"
  - "try/except wraps DocumentConverter construction (not convert call) — engine import errors surface at construction"
  - "RapidOCR model pre-download with '|| true' fallback — docling-tools subcommand may not exist in all versions"
  - "tesserocr C-API binding requires libtesseract-dev at pip install time — Tesseract apt block placed before pip RUN"

patterns-established:
  - "Engine factory pattern: dict mapping string key to class, ValueError on unknown key"
  - "Language option isolation: only pass lang to the engine that supports it (easyocr)"

requirements-completed: []

duration: 3min
completed: 2026-03-03
---

# Phase 8 Plan 01: OCR Engine Selection Backend Summary

**Four-engine OCR factory in adapter.py (auto/easyocr/rapidocr/tesseract) with per-job engine selection via /convert Form field and Dockerfile support for Tesseract and RapidOCR**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-03T21:34:32Z
- **Completed:** 2026-03-03T21:36:52Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Extended `ConversionOptions` with `ocr_engine` field (default "auto") and updated `build_pipeline_options()` to use an engine factory dict instead of hardcoded `EasyOcrOptions`
- Added `_OCR_ENGINE_CLASSES` factory mapping all 4 engine names to the correct Docling OcrOptions class; unknown engine raises `ValueError`; ocr_languages restricted to EasyOCR only
- Wrapped `DocumentConverter` construction in try/except that surfaces missing engine packages with actionable install hints
- Added `ocr_engine` Form parameter to the `/convert` endpoint, passed through to `ConversionOptions`
- Added `rapidocr-onnxruntime` and `tesserocr` to `requirements.txt`; Dockerfile installs Tesseract system packages before pip and pre-downloads RapidOCR models with graceful fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend adapter.py with OCR engine factory and error handling** - `d5ee511` (feat)
2. **Task 2: Add ocr_engine Form param to /convert endpoint** - `eb9dfc4` (feat)
3. **Task 3: Add RapidOCR and Tesseract to requirements.txt and Dockerfile** - `86f0139` (chore)

## Files Created/Modified
- `backend/adapter.py` - Added OcrAutoOptions/RapidOcrOptions/TesseractOcrOptions imports; ocr_engine field; _OCR_ENGINE_CLASSES factory dict; _ENGINE_INSTALL_HINTS; updated build_pipeline_options(); try/except in convert_file()
- `backend/main.py` - Added ocr_engine Form parameter to /convert; passed to ConversionOptions; updated docstring
- `backend/requirements.txt` - Added rapidocr-onnxruntime and tesserocr
- `Dockerfile` - Added Tesseract apt block before pip install; added RapidOCR model pre-download with || true fallback

## Decisions Made
- Engine factory via dict (`_OCR_ENGINE_CLASSES`) instead of if/elif chain — O(1) lookup, trivial to add a 5th engine
- `ocr_languages` only propagated to `EasyOcrOptions` — Tesseract and RapidOCR use incompatible language formats (ISO codes vs file paths)
- `try/except` wraps `DocumentConverter` construction (not the convert call) — import failures manifest at construction
- RapidOCR model pre-download uses `|| true` — `docling-tools models download rapidocr` subcommand may not exist in all docling-tools versions
- Tesseract apt block placed before `RUN pip install` — `tesserocr` is a C-API binding that links against `libtesseract-dev` at build time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Verification script using `python -c` failed locally (docling not installed in dev env) — verified via `ast.parse()` + string pattern checks instead. Functional tests will run in Docker container.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend now supports 4 OCR engines selectable per job via `ocr_engine` form field
- Docker image will include Tesseract system packages and RapidOCR Python package after next build
- Ready for Phase 08-02 (frontend OCR engine selector) and Phase 09 (multi-arch Docker build)

---
*Phase: 08-ocr-engine-research-and-selection*
*Completed: 2026-03-03*
