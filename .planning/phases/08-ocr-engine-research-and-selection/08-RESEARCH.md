# Phase 8: OCR Engine Research and Selection - Research

**Researched:** 2026-03-03
**Domain:** Docling OCR engine APIs, Python OCR library ecosystem, Docker dependency management
**Confidence:** HIGH (core API verified via official docs), MEDIUM (benchmark data from community sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Engine support:**
- Support 4 engine options: **Auto** (OcrAutoOptions), **EasyOCR** (EasyOcrOptions), **RapidOCR** (RapidOcrOptions), **Tesseract** (TesseractOcrOptions)
- OcrMac excluded (macOS only, useless in Docker Linux)
- TesseractCliOcrOptions excluded (redundant with TesseractOcrOptions)
- PaddleOCR, Surya, cloud engines (AWS/Google) excluded — not natively supported by Docling

**UI placement:**
- Engine selector goes inside the existing **advanced options collapsible** in OptionsPanel.tsx
- Consistent with current pattern (table detection, language select are already there)

**Missing engine handling:**
- If a selected engine is not installed in the container: **clear error message** surfaced to the user
- Error should indicate what needs to be installed (e.g., "RapidOCR not available — install rapidocr-onnxruntime")
- No silent fallback — user must make an explicit choice

**Benchmark scope:**
- Produce a **written benchmark document** (manual comparison, not automated script)
- Document covers: accuracy on scanned PDFs, speed on CPU, Docker image size impact, language coverage, and recommendation per use case
- Document lives in `.planning/phases/08-ocr-engine-research-and-selection/` as `08-BENCHMARK.md`

### Claude's Discretion
- Exact UI label/description for each engine option in the dropdown
- Whether "Auto" is the default selected engine or EasyOCR remains default
- Dockerfile changes needed to install Tesseract and RapidOCR
- How to surface the "engine not installed" error (backend exception vs. startup check)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 8 adds OCR engine selection to the existing conversion pipeline. The backend already uses `EasyOcrOptions` hardcoded in `build_pipeline_options()` — this phase generalises that function to accept any of the 4 supported Docling OCR option classes (`OcrAutoOptions`, `EasyOcrOptions`, `RapidOcrOptions`, `TesseractOcrOptions`) based on a new `ocr_engine` field in `ConversionOptions`.

All four target engines are natively supported by Docling through classes importable from `docling.datamodel.pipeline_options`. EasyOCR is already installed (it is the current default). RapidOCR requires adding `rapidocr-onnxruntime` to `requirements.txt`. Tesseract requires adding both the `tesserocr` Python binding (pip) and `tesseract-ocr libtesseract-dev libleptonica-dev` system packages to the Dockerfile.

The frontend change is a new `Select` inside the existing advanced-options `Collapsible` in `OptionsPanel.tsx`, mirroring the pattern already used for the language select. The `ConversionOptions` type and `DEFAULT_CONVERSION_OPTIONS` constant in `frontend/src/types/job.ts` need an `ocrEngine` field. The `/convert` endpoint needs a new `ocr_engine: str = Form(default="auto")` parameter.

**Primary recommendation:** Default to `OcrAutoOptions` (engine "auto") rather than hard-coding EasyOCR, because `OcrAutoOptions` delegates selection to Docling's own engine-availability detection — making the binary robust even when optional packages are absent. Detect "engine not installed" via a try/except around `DocumentConverter` construction or the `convert()` call, then return a descriptive 422/500 with actionable install instructions.

---

## Standard Stack

### Core (already present or to be added)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `docling` | latest (pinned at build) | Document conversion + OCR orchestration | Already in requirements.txt |
| `easyocr` | bundled via docling default | Deep-learning OCR, multilingual | Default Docling OCR engine, already in image |
| `rapidocr-onnxruntime` | 1.4.4 (Jan 2025) | Lightweight ONNX-based OCR, CPU-fast | pip-installable, no system deps, Python < 3.13 |
| `tesserocr` | latest | Python C-API binding for Tesseract | Docling's recommended Tesseract integration method |

### System Dependencies (Dockerfile additions)

| Package | Manager | Required By | Notes |
|---------|---------|-------------|-------|
| `tesseract-ocr` | apt-get | TesseractOcrOptions | Binary + default model data |
| `libtesseract-dev` | apt-get | tesserocr Python binding | C header files for compilation |
| `libleptonica-dev` | apt-get | tesserocr Python binding | Image processing library |
| `tesseract-ocr-eng` | apt-get | Tesseract | English language pack (minimum viable) |

**RapidOCR has no system dependencies** — pure pip install. EasyOCR has no system deps beyond what Docling already requires.

### Docling OCR Option Classes

| Class | Import | Kind String | Default Engine? |
|-------|--------|-------------|----------------|
| `OcrAutoOptions` | `docling.datamodel.pipeline_options` | `"auto"` | Picks best installed |
| `EasyOcrOptions` | `docling.datamodel.pipeline_options` | `"easyocr"` | Was hardcoded default |
| `RapidOcrOptions` | `docling.datamodel.pipeline_options` | `"rapidocr"` | Requires extra pip |
| `TesseractOcrOptions` | `docling.datamodel.pipeline_options` | `"tesseract"` | Requires system install |

**Installation additions to `requirements.txt`:**
```
rapidocr-onnxruntime
tesserocr
```

**Dockerfile additions:**
```dockerfile
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    libleptonica-dev \
    && rm -rf /var/lib/apt/lists/*
```

---

## Architecture Patterns

### Backend: Engine Mapping in `build_pipeline_options()`

The change is entirely contained in `backend/adapter.py`. The `build_pipeline_options()` function already maps `ocr_mode` → OCR behaviour. It needs extending to also map `ocr_engine` → the correct `*OcrOptions` class.

**Recommended Project Structure (unchanged):**
```
backend/
├── adapter.py           # Add ocr_engine field + engine mapper
├── main.py              # Add ocr_engine Form param
├── requirements.txt     # Add rapidocr-onnxruntime, tesserocr
frontend/src/
├── types/job.ts         # Add OcrEngine union type + ocrEngine field
├── components/
│   └── OptionsPanel.tsx # Add engine Select in advanced section
```

### Pattern 1: Engine Factory in `build_pipeline_options()`

**What:** A dict or match/case block that maps the `ocr_engine` string to the correct Docling options class, preserving existing `ocr_mode` (force_full_page_ocr) and `ocr_languages` logic.

**When to use:** Any time `build_pipeline_options()` is called — this is the single integration point.

```python
# Source: docling-project.github.io/docling/reference/pipeline_options/
from docling.datamodel.pipeline_options import (
    OcrAutoOptions,
    EasyOcrOptions,
    RapidOcrOptions,
    TesseractOcrOptions,
    PdfPipelineOptions,
)

_ENGINE_MAP = {
    "auto":      OcrAutoOptions,
    "easyocr":   EasyOcrOptions,
    "rapidocr":  RapidOcrOptions,
    "tesseract": TesseractOcrOptions,
}

def _build_ocr_options(engine: str, force_full_page: bool, languages: list[str]):
    """Instantiate the correct OcrOptions class for the requested engine."""
    cls = _ENGINE_MAP.get(engine)
    if cls is None:
        raise ValueError(f"Unknown OCR engine: {engine!r}")
    opts = cls(force_full_page_ocr=force_full_page)
    if languages:
        opts.lang = languages
    return opts
```

### Pattern 2: Engine-Not-Installed Error Surfacing

**What:** When a user selects an engine whose Python package is not installed, Docling raises an `ImportError` or `RuntimeError` at `DocumentConverter` construction or at conversion time. Catch this and convert it to a user-friendly error message.

**When to use:** In `DoclingAdapter.convert_file()` — wrap the converter construction in try/except and re-raise as a structured error that the SSE `failed` event can carry to the frontend.

```python
# Pattern for adapter.py — engine missing detection
_ENGINE_INSTALL_HINTS = {
    "rapidocr":  "rapidocr-onnxruntime",
    "tesseract": "tesserocr + apt tesseract-ocr libtesseract-dev libleptonica-dev",
}

try:
    converter = DocumentConverter(
        format_options={"application/pdf": PdfFormatOption(pipeline_options=pipeline_options)}
    )
except (ImportError, Exception) as exc:
    hint = _ENGINE_INSTALL_HINTS.get(opts.ocr_engine, "the required OCR package")
    raise RuntimeError(
        f"OCR engine '{opts.ocr_engine}' is not available. "
        f"Install: {hint}"
    ) from exc
```

### Pattern 3: Frontend Engine Select

**What:** A new `Select` in the advanced-options `Collapsible` of `OptionsPanel.tsx`, using the exact same Radix `Select`/`SelectItem` pattern as the existing language select.

**When to use:** Always visible in the advanced section, above or below the language select.

```typescript
// Source: existing OptionsPanel.tsx pattern + 08-CONTEXT.md specifics
export type OcrEngine = 'auto' | 'easyocr' | 'rapidocr' | 'tesseract';

// Friendly labels (from CONTEXT.md specifics section):
const OCR_ENGINES: { value: OcrEngine; label: string }[] = [
  { value: 'auto',      label: 'Auto (best available)' },
  { value: 'easyocr',  label: 'EasyOCR' },
  { value: 'rapidocr', label: 'RapidOCR (fast)' },
  { value: 'tesseract', label: 'Tesseract' },
];
```

### Anti-Patterns to Avoid

- **Silent engine fallback:** If a user picks "tesseract" and it is not installed, do NOT silently fall back to EasyOCR. Return a clear error. (Locked decision from CONTEXT.md.)
- **Using `TesseractCliOcrOptions`:** Excluded per CONTEXT.md — redundant with `TesseractOcrOptions`.
- **Passing `lang` to all engines blindly:** The `ocr_languages` field is EasyOCR-specific in the current UI. For Tesseract and RapidOCR, the language parameter format differs. Consider only passing languages when `engine == "easyocr"` unless the user explicitly selects a Tesseract language code.
- **Hardcoding model paths for RapidOCR:** The DEV.to tutorial uses HuggingFace snapshot downloads for custom models. For this project, use `RapidOcrOptions()` with no custom model paths — Docling's default models (downloaded via `docling-tools models download`) cover the common case.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OCR engine availability detection | Custom import-check scripts | Wrap DocumentConverter in try/except | Docling raises ImportError/RuntimeError reliably |
| OCR engine selection logic | Custom engine-picker with heuristics | `OcrAutoOptions` | Docling already implements availability-based selection |
| Language pack management | Download scripts for Tesseract data | `apt-get install tesseract-ocr-XXX` in Dockerfile | Standard Debian package, reproducible |
| RapidOCR model management | HuggingFace snapshot_download in app code | Default `RapidOcrOptions()` | Docling handles model paths via `docling-tools models download` |

**Key insight:** All four engines are first-class Docling citizens. The integration point is a single line change in `build_pipeline_options()` — there is no custom engine-management code to write.

---

## Common Pitfalls

### Pitfall 1: `lang` field format differs per engine

**What goes wrong:** Setting `ocr_options.lang = ["it", "en"]` works for EasyOCR (ISO 639-1 codes). For Tesseract it expects a different format (e.g., `"ita+eng"`). For RapidOCR defaults, the `lang` field is less relevant (models are selected by path).

**Why it happens:** Each engine has its own language code convention, and the field name `lang` is shared across all `*OcrOptions` classes.

**How to avoid:** Only propagate `ocr_languages` to `lang` when `engine == "easyocr"`. For "auto", "rapidocr", and "tesseract", leave `lang` unset (use engine defaults) unless the UI later adds engine-specific language selection.

**Warning signs:** Docling raises an error about unknown language codes, or OCR silently produces garbage output.

### Pitfall 2: RapidOCR requires `rapidocr-onnxruntime`, not `rapidocr`

**What goes wrong:** There are two PyPI packages: `rapidocr` (newer umbrella) and `rapidocr-onnxruntime` (legacy, ONNX backend). Docling's integration is with `rapidocr-onnxruntime` (confirmed via docling-serve GitHub issue #360).

**Why it happens:** The RapidOCR project recently restructured its packages. The `rapidocr` meta-package may not include the ONNX backend by default.

**How to avoid:** Add `rapidocr-onnxruntime` explicitly to `requirements.txt`. Docling documentation says `pip install "docling[rapidocr]"` is equivalent to `pip install rapidocr onnxruntime`.

**Warning signs:** `ImportError: No module named 'rapidocr_onnxruntime'` at DocumentConverter construction time.

### Pitfall 3: Tesseract system packages must be installed before `tesserocr` pip install

**What goes wrong:** `pip install tesserocr` compiles a Cython extension against `libtesseract-dev`. If system packages are not installed first, pip install fails with a compilation error.

**Why it happens:** `tesserocr` is a C-API binding that links against the Tesseract shared library at build time.

**How to avoid:** In Dockerfile, `apt-get install tesseract-ocr libtesseract-dev libleptonica-dev` BEFORE the `pip install -r requirements.txt` step. Add language packs (`tesseract-ocr-eng`, etc.) as needed.

**Warning signs:** Docker build fails with `tesseract/baseapi.h: No such file or directory`.

### Pitfall 4: `OcrAutoOptions` may pick an engine not matching user expectation

**What goes wrong:** `OcrAutoOptions` automatically selects the best available engine. If only EasyOCR is installed, it picks EasyOCR even when the user chose "Auto". This is correct but might confuse users expecting "Auto" to mean "try all engines".

**Why it happens:** "Auto" is Docling's availability-based selection, not a multi-engine fallback chain.

**How to avoid:** Document "Auto" in the UI as "Automatico (miglior motore disponibile)" to set correct expectations. This is acceptable per CONTEXT.md.

**Warning signs:** None — this is expected behaviour, but worth documenting for the benchmark.

### Pitfall 5: Docker image size increase from Tesseract language packs

**What goes wrong:** Installing `tesseract-ocr` base + language packs adds 100-400MB to the Docker image per language. Installing all 100+ language packs is impractical.

**Why it happens:** Each `tesseract-ocr-XXX` package contains trained neural network data.

**How to avoid:** Install only `tesseract-ocr-eng` (English) by default. Document in the benchmark that Tesseract multilingual support requires Dockerfile customization.

**Warning signs:** Docker image grows unexpectedly large after adding Tesseract support.

### Pitfall 6: `ocr_engine` Form field must match backend validation

**What goes wrong:** Frontend sends `ocr_engine = "rapidocr"` but backend `ConversionOptions` has no validation on the engine string. An invalid engine silently maps to nothing (or raises a KeyError in the engine factory dict).

**Why it happens:** FastAPI `Form` parameters accept any string without enum validation unless explicitly constrained.

**How to avoid:** Either use `Literal["auto", "easyocr", "rapidocr", "tesseract"]` type annotation, or add explicit validation in `build_pipeline_options()` before the engine dict lookup. Return a clear 422 for unknown engine values.

---

## Code Examples

### Backend: Extended `ConversionOptions` dataclass

```python
# backend/adapter.py — add ocr_engine field
@dataclass
class ConversionOptions:
    ocr_mode: str = "auto"           # "auto" | "on" | "off"
    ocr_engine: str = "auto"         # "auto" | "easyocr" | "rapidocr" | "tesseract"
    table_detection: bool = True
    page_from: Optional[int] = None
    page_to: Optional[int] = None
    ocr_languages: list[str] = field(default_factory=list)
```

### Backend: Extended `build_pipeline_options()`

```python
# backend/adapter.py — engine factory
from docling.datamodel.pipeline_options import (
    OcrAutoOptions, EasyOcrOptions, RapidOcrOptions, TesseractOcrOptions,
    PdfPipelineOptions,
)

_OCR_ENGINE_CLASSES = {
    "auto":      OcrAutoOptions,
    "easyocr":   EasyOcrOptions,
    "rapidocr":  RapidOcrOptions,
    "tesseract": TesseractOcrOptions,
}

_ENGINE_INSTALL_HINTS = {
    "rapidocr":  "pip install rapidocr-onnxruntime",
    "tesseract": "apt-get install tesseract-ocr libtesseract-dev libleptonica-dev && pip install tesserocr",
}

def build_pipeline_options(opts: ConversionOptions) -> PdfPipelineOptions:
    if opts.ocr_mode == "off":
        return PdfPipelineOptions(do_ocr=False, do_table_structure=opts.table_detection)

    force_full = opts.ocr_mode == "on"
    engine_cls = _OCR_ENGINE_CLASSES.get(opts.ocr_engine)
    if engine_cls is None:
        raise ValueError(f"Unknown OCR engine: {opts.ocr_engine!r}")

    ocr_options = engine_cls(force_full_page_ocr=force_full)
    # Only set languages for EasyOCR — other engines use different lang format
    if opts.ocr_languages and opts.ocr_engine == "easyocr":
        ocr_options.lang = opts.ocr_languages

    return PdfPipelineOptions(
        do_ocr=True,
        do_table_structure=opts.table_detection,
        ocr_options=ocr_options,
    )
```

### Backend: Engine-missing error in `DoclingAdapter.convert_file()`

```python
# Wrap DocumentConverter construction to catch missing engine packages
_ENGINE_INSTALL_HINTS = {
    "rapidocr":  "pip install rapidocr-onnxruntime",
    "tesseract": "apt-get install tesseract-ocr libtesseract-dev && pip install tesserocr",
}

try:
    converter = DocumentConverter(
        format_options={"application/pdf": PdfFormatOption(pipeline_options=pipeline_options)}
    )
except Exception as exc:
    hint = _ENGINE_INSTALL_HINTS.get(opts.ocr_engine, "the required OCR package")
    raise RuntimeError(
        f"OCR engine '{opts.ocr_engine}' is not available. Install: {hint}"
    ) from exc
```

### Backend: `/convert` endpoint — new Form field

```python
# backend/main.py — add ocr_engine parameter
@app.post("/convert")
async def convert(
    ...
    ocr_engine: str = Form(default="auto"),  # NEW
    ...
):
    options = ConversionOptions(
        ocr_mode=ocr_mode,
        ocr_engine=ocr_engine,  # NEW
        table_detection=table_detection,
        page_from=page_from,
        page_to=page_to,
        ocr_languages=ocr_languages.split(",") if ocr_languages else [],
    )
```

### Frontend: Type additions in `job.ts`

```typescript
// frontend/src/types/job.ts — add OcrEngine type
export type OcrEngine = 'auto' | 'easyocr' | 'rapidocr' | 'tesseract';

export interface ConversionOptions {
  ocrMode: OcrMode;
  ocrEngine: OcrEngine;       // NEW
  tableDetection: boolean;
  pageFrom: number | null;
  pageTo: number | null;
  ocrLanguages: string[];
}

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  ocrMode: 'auto',
  ocrEngine: 'auto',          // NEW — default to Auto
  tableDetection: true,
  pageFrom: null,
  pageTo: null,
  ocrLanguages: [],
};

// Engine options for the UI Select
export const OCR_ENGINES: { value: OcrEngine; label: string }[] = [
  { value: 'auto',      label: 'Auto (best available)' },
  { value: 'easyocr',  label: 'EasyOCR' },
  { value: 'rapidocr', label: 'RapidOCR (fast)' },
  { value: 'tesseract', label: 'Tesseract' },
];
```

### Frontend: Engine Select in `OptionsPanel.tsx`

```tsx
// Add inside CollapsibleContent, before or after language select
import { OCR_ENGINES } from '@/types/job';
import type { OcrEngine } from '@/types/job';

{/* OCR engine select */}
<div className="flex items-center justify-between gap-3">
  <span className="text-sm text-muted-foreground shrink-0">Motore OCR</span>
  <Select
    value={value.ocrEngine}
    onValueChange={(v) => onChange({ ...value, ocrEngine: v as OcrEngine })}
  >
    <SelectTrigger className="w-48">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {OCR_ENGINES.map((engine) => (
        <SelectItem key={engine.value} value={engine.value}>
          {engine.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tesseract only (traditional OCR) | EasyOCR (deep learning, multilingual) | ~2020 | Better accuracy on complex layouts |
| EasyOCR hardcoded in Docling default | `OcrAutoOptions` for auto-selection | Docling v2+ | Runtime flexibility without code changes |
| PaddleOCR as top alternative | RapidOCR (ONNX-based, PaddlePaddle models ported) | 2023 | Lighter than PaddlePaddle, no GPU required |
| LLM-based OCR (VLMs) | Surya, Granite-Vision (Docling v2 VLM pipeline) | 2024-2025 | Higher accuracy but GPU-dependent, out of scope here |

**Deprecated/outdated:**
- `TesseractCliOcrOptions`: Excluded by user decision (redundant with `TesseractOcrOptions`)
- `OcrMacOptions`: macOS only, excluded for Docker Linux deployment
- PaddleOCR direct: Not natively in Docling; replaced by RapidOCR (which uses PaddlePaddle-trained ONNX models)

---

## OCR Engine Comparison (for 08-BENCHMARK.md guidance)

| Dimension | Auto | EasyOCR | RapidOCR | Tesseract |
|-----------|------|---------|----------|-----------|
| Accuracy (printed text) | Depends | HIGH | MEDIUM-HIGH | HIGH |
| Accuracy (handwritten) | Depends | MEDIUM | LOW | LOW |
| CPU speed (A4 page) | Depends | 13s avg | ~3-5s (ONNX) | 1-3s |
| GPU acceleration | Engine-dependent | Yes (optional) | Via ONNX GPU | No |
| Docker size impact | None | Already present | +50MB (pip only) | +200MB (system pkgs) |
| Multilingual support | Engine-dependent | 80+ languages | EN/ZH default + models | 100+ (per language pack) |
| Python install | Built-in | Built-in | pip only | pip + system deps |
| Recommendation | General use | Complex layouts | Fast CPU-only | Legacy/specific needs |

*Confidence: MEDIUM — based on community benchmarks, not project-specific measurement.*

---

## Open Questions

1. **Does `OcrAutoOptions` pick EasyOCR by default when all engines are installed?**
   - What we know: Multiple sources confirm EasyOCR is the Docling default OCR engine
   - What's unclear: The exact fallback priority order of `OcrAutoOptions` when multiple engines are installed is not documented in official docs
   - Recommendation: Default `ocrEngine` to `"auto"` for robustness; the benchmark document can verify behaviour in practice

2. **Do RapidOCR models need pre-downloading via `docling-tools`?**
   - What we know: The existing Dockerfile runs `docling-tools models download` which pre-bakes EasyOCR models. GitHub issue #2500 mentions `docling-tools models download rapidocr` exists.
   - What's unclear: Whether the RapidOCR models are included in the standard `docling-tools models download` or require a separate `docling-tools models download rapidocr` command
   - Recommendation: Test during implementation; add `docling-tools models download rapidocr` to Dockerfile if needed

3. **Language select behaviour with non-EasyOCR engines**
   - What we know: `ocr_languages` in the UI currently drives `EasyOcrOptions.lang` (ISO 639-1 codes). Tesseract uses different language codes.
   - What's unclear: Should the language select be hidden/disabled when the user picks Tesseract or RapidOCR?
   - Recommendation: Keep language select visible but only apply it when `ocrEngine == "easyocr"` (already covered in the code example above). Add a UI hint: "Lingua OCR si applica solo a EasyOCR".

---

## Sources

### Primary (HIGH confidence)
- [Docling Pipeline Options Reference](https://docling-project.github.io/docling/reference/pipeline_options/) — `OcrAutoOptions`, `EasyOcrOptions`, `RapidOcrOptions`, `TesseractOcrOptions` class fields and defaults
- [Docling Installation Docs](https://docling-project.github.io/docling/getting_started/installation/) — pip extras for each engine, system dependencies for Tesseract
- [Docling source pipeline_options.py](https://github.com/docling-project/docling/blob/main/docling/datamodel/pipeline_options.py) — exact class definitions verified
- `backend/adapter.py`, `backend/main.py`, `frontend/src/types/job.ts`, `frontend/src/components/OptionsPanel.tsx` — existing codebase read directly

### Secondary (MEDIUM confidence)
- [DEV.to: Using Docling's OCR features with RapidOCR](https://dev.to/aairom/using-doclings-ocr-features-with-rapidocr-29hd) — verified against official Docling docs for package name
- [docling-serve GitHub issue #360](https://github.com/docling-project/docling-serve/issues/360) — confirms `rapidocr-onnxruntime` is the correct package (not bare `rapidocr`)
- [rapidocr-onnxruntime PyPI](https://pypi.org/project/rapidocr-onnxruntime/) — version 1.4.4, Python < 3.13 confirmed

### Tertiary (LOW confidence)
- [DeepWiki OCR Models](https://deepwiki.com/docling-project/docling/4.1-ocr-models) — engine list, not authoritative on fallback order
- Community benchmarks (modal.com, Medium articles) — accuracy/speed numbers are indicative, not project-specific

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all four OCR classes verified in official Docling docs; package names confirmed via PyPI and GitHub issues
- Architecture: HIGH — change points identified from reading actual source files (adapter.py, main.py, OptionsPanel.tsx, job.ts)
- Pitfalls: MEDIUM — `lang` format differences and Docker size impact verified; RapidOCR model pre-download behaviour needs validation during implementation
- Benchmark data: MEDIUM — community sources, not project-specific measurements

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Docling releases frequently; verify OCR class API if docling is upgraded)
