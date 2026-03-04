---
phase: 08-ocr-engine-research-and-selection
plan: 04
status: complete
completed_at: 2026-03-04
---

## What Was Built

Human verification checkpoint for the complete OCR engine selection feature.
All verification items confirmed during live testing in this session.

## Verification Results

**UI selector**: ✓ Engine selector visible in advanced options panel with 4 engines (Auto, EasyOCR, RapidOCR, Tesseract) and language picker per engine.

**End-to-end conversions tested**:
- Auto → RapidOCR: ✓ (confirmed via log interception + green badge)
- RapidOCR: ✓
- EasyOCR + English: ✓ (after downloading models with `docling-tools models download easyocr`)
- Tesseract + Italian: ✓ (after switching to TesseractCliOcrOptions for thread-safety)

**OCR badge**: ✓ Green when engine matches selection, yellow when fallback occurred (e.g. Tesseract → RapidOCR before fix).

## Issues Found and Fixed During Verification

1. **Pipeline options silently ignored**: `format_options` was keyed with string `"application/pdf"` instead of `InputFormat.PDF` enum — Docling always fell back to `OcrAutoOptions`. Fixed in `adapter.py`.

2. **Tesseract thread crash**: `TesseractOcrOptions` (Python bindings via tesserocr/cysignals) cannot be imported in asyncio worker threads. Switched to `TesseractCliOcrOptions` (CLI-based, no thread restrictions).

3. **EasyOCR models missing**: `docling-tools models download easyocr` not called in Dockerfile. Added and downloaded manually into running container for immediate use.

4. **Language selector redesigned**: EasyOCR changed from single-select dropdown to multi-select toggle buttons (same as Tesseract). Languages limited to those with pre-downloaded models (EN IT FR DE ES PT NL PL TR via latin_g2 + english_g2).

## TypeScript Check

```
npx tsc --noEmit → TS OK
```
