# OCR Engine Benchmark — Docling Webapp

## Overview

This document compares the four OCR engines supported by the Docling Webapp: **Auto**, **EasyOCR**, **RapidOCR**, and **Tesseract**. Data was gathered through research (community benchmarks, official Docling documentation, and PyPI/GitHub sources) rather than automated benchmark runs against this specific project.

**Confidence level:** HIGH for API behaviour and installation requirements (verified via official docs and source code). MEDIUM for accuracy/speed numbers (community benchmarks, not project-specific measurements).

**Docling version scope:** Valid for the Docling version pinned at build time as of 2026-03-03. Verify if `docling` is upgraded — OCR class APIs change between minor versions.

---

## Engines Compared

### Auto (`OcrAutoOptions`)

`OcrAutoOptions` delegates engine selection to Docling's runtime availability detection. It does not try all engines — it picks the best available engine based on what is installed in the environment. In practice, when all four engines are installed, Docling defaults to EasyOCR as its primary selection. When an engine is missing, `OcrAutoOptions` falls back gracefully without raising errors.

**Installation:** No additional packages needed. It is the default selection mode in Docling.

**Use when:** You want a robust default that works regardless of which optional packages are installed, and you do not need to control which exact engine runs.

---

### EasyOCR (`EasyOcrOptions`)

EasyOCR is a deep-learning OCR engine based on CRAFT text detection and CRNN recognition. It supports 80+ languages via pre-trained neural network models and handles complex layouts, rotated text, and mixed scripts well. It is already bundled in the Docling Webapp Docker image as the previous hardcoded default.

**Installation:** No additional packages. EasyOCR is bundled via Docling's default dependencies. Models are pre-baked at Docker image build time via `docling-tools models download`.

**GPU acceleration:** Optional. EasyOCR can use CUDA if available, falling back to CPU. The current Dockerfile uses CPU-only PyTorch.

**Use when:** You need high accuracy on documents with complex layouts, handwritten text, or multilingual content where language selection matters.

---

### RapidOCR (`RapidOcrOptions`)

RapidOCR is an ONNX-based OCR engine that uses PaddlePaddle-trained models exported to ONNX format. It is significantly faster than EasyOCR on CPU because ONNX Runtime is optimised for inference without a full deep-learning framework. The correct package is `rapidocr-onnxruntime` (not the bare `rapidocr` meta-package, which may lack the ONNX backend).

**Installation:** `pip install rapidocr-onnxruntime`. No system packages required. Adds approximately 50MB to the Docker image. Requires Python < 3.13.

**Language support:** English and Chinese (ZH) by default. Additional language models require separate Docling model downloads (`docling-tools models download rapidocr`).

**Use when:** You need fast CPU-only processing and primarily work with English or Chinese documents.

---

### Tesseract (`TesseractOcrOptions`)

Tesseract is the traditional open-source OCR engine originally developed by HP and now maintained by Google. It uses LSTM neural networks (since version 4) and is the industry standard for CPU-only OCR. Docling integrates via `tesserocr`, a Python C-API binding (not the CLI wrapper `TesseractCliOcrOptions`, which is excluded from this project).

**Installation:** Two-step installation required:
1. System packages: `apt-get install tesseract-ocr tesseract-ocr-eng libtesseract-dev libleptonica-dev`
2. Python binding: `pip install tesserocr`

**Critical order:** System packages must be installed before `pip install tesserocr` — the binding compiles against `libtesseract-dev` headers.

**Language support:** 100+ languages available as separate apt packages (`tesseract-ocr-XXX`). Only English (`tesseract-ocr-eng`) is installed by default in this project's Dockerfile.

**Docker size impact:** +200MB (system packages + default English language data). Each additional language pack adds 50-150MB.

**Use when:** You need Tesseract-specific behaviour, are migrating from a Tesseract-based pipeline, or need a language only supported by Tesseract.

---

## Comparison Table

| Dimension | Auto | EasyOCR | RapidOCR | Tesseract |
|-----------|------|---------|----------|-----------|
| Accuracy (printed text) | Depends on selected engine | HIGH | MEDIUM-HIGH | HIGH |
| Accuracy (handwritten) | Depends on selected engine | MEDIUM | LOW | LOW |
| CPU speed (A4 page estimate) | Depends on selected engine | ~13s avg | ~3–5s (ONNX) | 1–3s |
| GPU acceleration | Engine-dependent | Yes (optional, CUDA) | Via ONNX GPU providers | No |
| Docker image size impact | None (no extra packages) | Already present (bundled) | +50MB (pip only) | +200MB (system packages) |
| Multilingual support | Engine-dependent | 80+ languages (ISO 639-1) | EN/ZH default + models | 100+ (per language pack via apt) |
| Python install | Built-in (no extras) | Built-in (already bundled) | `pip install rapidocr-onnxruntime` | `pip install tesserocr` |
| System dependencies | None | None | None | `tesseract-ocr libtesseract-dev libleptonica-dev` |
| `ocr_languages` UI field applies | Engine-dependent | YES | NO (ignored) | NO (different format) |
| Recommended for | General use / unknown docs | Complex layouts, multilingual | Fast CPU-only, high throughput | Legacy pipelines, specific Tesseract needs |

*Speed estimates: community benchmarks on typical A4-page PDFs, not project-specific measurements.*

---

## Recommendations by Document Type

### Scanned PDF (no native text layer)

**Recommended: EasyOCR**

Scanned PDFs often contain variable scan quality, skewed pages, and mixed font types. EasyOCR's deep-learning approach (CRAFT + CRNN) handles these conditions better than Tesseract's traditional approach. It recovers text from low-contrast scans and handles multi-column layouts more reliably. RapidOCR is faster but sacrifices accuracy on challenging scans. Tesseract performs well on clean, high-resolution scans but degrades more on noisy inputs.

If throughput matters more than accuracy and the scans are clean, use **RapidOCR** as a faster alternative.

---

### Native PDF with Embedded Images

**Recommended: Auto**

Native PDFs with embedded images (e.g., diagrams, charts, photos within a mostly-native PDF) benefit from Docling's built-in image detection pipeline. `OcrAutoOptions` is preferred here because Docling itself is best positioned to decide whether OCR is needed for each image region. Using `OcrAutoOptions` avoids unnecessary full-page OCR on native-text regions while applying the best available engine on image regions.

If you know images are complex or multilingual, override to **EasyOCR** for higher accuracy on those regions.

---

### Multilingual Document

**Recommended: EasyOCR** with `ocr_languages` set in the UI

EasyOCR supports 80+ languages via ISO 639-1 codes and is the only engine for which the Docling Webapp UI's language selector (`ocr_languages` field) is applied. Tesseract supports 100+ languages but requires Dockerfile customisation (apt language packs) and uses a different language code format. RapidOCR defaults to EN/ZH.

For multilingual documents in languages beyond EN/ZH, EasyOCR with explicit language selection is the most practical option within the current Docker setup.

---

### Fast CPU-Only Processing

**Recommended: RapidOCR**

When processing throughput is the primary concern and documents are primarily in English or Chinese, RapidOCR is the best option. ONNX Runtime inference is 3–4x faster than EasyOCR on CPU. For batch conversion of high volumes of documents, this difference compounds significantly.

Tesseract is also fast (1–3s/page) but has lower accuracy on complex layouts compared to RapidOCR.

---

### General Use / Unknown Document Type

**Recommended: Auto (default)**

`Auto` is the recommended default for the UI because it is robust to missing optional packages. If a user's container has only EasyOCR installed (the default Docker image), Auto will use EasyOCR. If they install RapidOCR or Tesseract later, Auto adapts without requiring configuration changes.

"Auto" does NOT mean "try all engines and pick the best result" — it means Docling selects the best installed engine at runtime. See Known Limitations for the implication.

---

## Known Limitations

- **Tesseract multilingual:** Only the English language pack (`tesseract-ocr-eng`) is installed by default. Other languages require Dockerfile customisation: `apt-get install tesseract-ocr-fra` (French), `tesseract-ocr-ita` (Italian), etc. Each language pack adds 50–150MB to the Docker image.

- **RapidOCR language models:** English and Chinese are covered by the default models. Additional language models are not included in the standard `docling-tools models download` command and require separate `docling-tools models download rapidocr` invocations or manual model placement.

- **`ocr_languages` field is EasyOCR-only:** The language selector in the Docling Webapp UI applies only to `EasyOcrOptions.lang`. When using Tesseract or RapidOCR, this field is silently ignored. A UI hint ("OCR language applies to EasyOCR only") is recommended to prevent user confusion.

- **Auto engine selection is opaque:** `OcrAutoOptions` picks "best available" at runtime, but does not expose which engine was selected. Users cannot confirm which engine ran. The conversion result contains no engine identification metadata.

- **Auto does NOT try all engines:** Users may expect "Auto" to try multiple engines and return the best result. It does not — it selects exactly one engine based on availability. Once selected, it runs that engine only.

- **Accuracy data confidence is MEDIUM:** Speed and accuracy numbers in this document are derived from community benchmarks (Modal.com, Medium articles, PyPI readme files) rather than measurements made against this project's specific document types and workload. Project-specific benchmarking is recommended if engine selection is critical.

- **RapidOCR requires Python < 3.13:** `rapidocr-onnxruntime` 1.4.4 does not support Python 3.13 (free-threaded builds). The current Dockerfile uses Python 3.12, so this is not a current concern. Verify if the base image is upgraded.

---

## Data Sources

### Primary (HIGH confidence)
- [Docling Pipeline Options Reference](https://docling-project.github.io/docling/reference/pipeline_options/) — `OcrAutoOptions`, `EasyOcrOptions`, `RapidOcrOptions`, `TesseractOcrOptions` class fields and defaults
- [Docling Installation Docs](https://docling-project.github.io/docling/getting_started/installation/) — pip extras for each engine, system dependencies for Tesseract
- [Docling source: pipeline_options.py](https://github.com/docling-project/docling/blob/main/docling/datamodel/pipeline_options.py) — exact class definitions verified
- Project source files: `backend/adapter.py`, `backend/main.py`, `frontend/src/types/job.ts`, `frontend/src/components/OptionsPanel.tsx`

### Secondary (MEDIUM confidence)
- [DEV.to: Using Docling's OCR features with RapidOCR](https://dev.to/aairom/using-doclings-ocr-features-with-rapidocr-29hd) — RapidOCR usage patterns verified against official docs
- [docling-serve GitHub issue #360](https://github.com/docling-project/docling-serve/issues/360) — confirms `rapidocr-onnxruntime` is the correct package name
- [rapidocr-onnxruntime PyPI](https://pypi.org/project/rapidocr-onnxruntime/) — version 1.4.4, Python < 3.13 constraint confirmed

### Tertiary (LOW confidence)
- [DeepWiki: Docling OCR Models](https://deepwiki.com/docling-project/docling/4.1-ocr-models) — engine list overview
- Community benchmarks (Modal.com, Medium articles) — accuracy and speed numbers are indicative only

---

*Written: 2026-03-03*
*Based on Docling research — valid until ~2026-04-03 (verify if docling version is upgraded)*
