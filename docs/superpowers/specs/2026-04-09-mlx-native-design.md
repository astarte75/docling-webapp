# Docling Webapp — MLX Native Branch Design

## Goal

Replace the Docker-based architecture with a macOS-native setup that leverages Apple Silicon via MLX for document conversion. If successful, this branch (`mlx-native`) becomes the new `main`.

## Decisions

| Decision | Choice |
|----------|--------|
| Pipeline | VLM/MLX default + fallback standard parser for non-PDF |
| Formats | PDF via VLM/MLX, DOCX/PPTX/XLSX/HTML/MD via standard Docling parser |
| Architecture | FastAPI serves everything (API + static frontend build) |
| Dependencies | uv (pyproject.toml, lock file) |
| Model loading | Eager — loaded at app startup |
| Default port | 9000 (configurable via `PORT` env var) |
| Concurrency | MAX_CONCURRENT_JOBS=1 default (GPU-bound) |
| Code layout | Refactor in-place (keep backend/ + frontend/ structure) |

## Architecture

```
[Browser] → http://localhost:9000
    │
    ├── GET / (non-API paths)
    │   → FastAPI StaticFiles → frontend/dist/index.html
    │
    ├── POST /api/convert (multipart: file + engine + opts)
    │   → main.py → job_store enqueue → 202 {job_id}
    │
    ├── GET /api/jobs/{id}/stream (SSE)
    │   → worker picks engine by file type:
    │     PDF → VlmConverter (GraniteDocling + MLX)
    │     Other → StandardConverter (Docling default parser)
    │   → events: started → completed | failed
    │
    └── GET /api/health
        → {status: ok, vlm_loaded: bool, engine: "granite_docling-mlx"}
```

## File Structure

```
docling-webapp/  (branch: mlx-native)
│
├── pyproject.toml              # uv project, MLX dependencies
├── Makefile                    # setup, run, dev, build-frontend
├── README.md                   # updated for native setup
│
├── backend/
│   ├── main.py                 # FastAPI + static mount + lifespan (eager load)
│   ├── converter.py            # VlmConverter (MLX) + StandardConverter
│   ├── config.py               # PORT=9000, MAX_UPLOAD_SIZE_MB, MAX_CONCURRENT_JOBS=1
│   ├── job_store.py            # async worker (minor changes)
│   └── tests/
│
├── frontend/                   # React + Vite + shadcn (reused)
│   ├── src/
│   │   ├── App.tsx             # updated form fields
│   │   ├── components/
│   │   │   ├── OptionsPanel.tsx  # simplified (engine toggle only)
│   │   │   └── ...              # all others unchanged
│   │   ├── hooks/               # unchanged
│   │   └── types/
│   │       └── job.ts           # updated types
│   └── package.json
│
├── Dockerfile                  # unused in this branch, kept for git history
├── docker-compose*.yml         # idem
└── nginx.conf                  # idem
```

## Backend Details

### converter.py — Dual Engine

```python
class VlmConverter:
    """PDF → Markdown via GraniteDocling + MLX. Loaded at startup."""
    def __init__(self):
        self.converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(
                pipeline_options=VlmConvertOptions.from_preset(
                    "granite_docling",
                    engine_options=MlxVlmEngineOptions()
                )
            )}
        )

    def convert(self, path: Path, opts: ConversionOptions) -> str:
        result = self.converter.convert(str(path))
        return result.document.export_to_markdown()


class StandardConverter:
    """Fallback for non-PDF formats (DOCX, PPTX, XLSX, HTML, MD)."""
    def convert(self, path: Path, opts: ConversionOptions) -> str:
        converter = DocumentConverter()
        result = converter.convert(str(path))
        return result.document.export_to_markdown()
```

### Routing Logic

- File extension is `.pdf` → `VlmConverter`
- File extension is not `.pdf` → `StandardConverter`
- User explicitly sets `engine=standard` for a PDF → `StandardConverter` (fallback OCR)
- User sends `engine=vlm` for a non-PDF → ignored, `StandardConverter` used (VLM only works on PDF)

### main.py — Lifespan

```python
@asynccontextmanager
async def lifespan(app):
    try:
        app.state.vlm = VlmConverter()
        app.state.vlm_loaded = True
    except Exception as e:
        logger.error(f"Failed to load VLM model: {e}")
        app.state.vlm = None
        app.state.vlm_loaded = False
    app.state.standard = StandardConverter()
    # ... job store init, worker start ...
    yield
```

If VLM fails to load, the app starts with only StandardConverter. Requesting `engine=vlm` returns `503 Service Unavailable`.

### config.py

```python
PORT = int(os.getenv("PORT", "9000"))
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "1"))
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".md"}
```

### Static Files Mount

```python
# API routes registered first, then catch-all static mount
app.mount("/", StaticFiles(directory="frontend/dist", html=True))
```

`html=True` enables SPA fallback (serves index.html for unknown paths).

## API Contract

### POST /api/convert

```
Content-Type: multipart/form-data

Fields:
  file              (required)  UploadFile
  engine            (optional)  "vlm" | "standard"   default: "vlm" for PDF, "standard" for others
  table_detection   (optional)  bool                  default: true
  page_from         (optional)  int                   1-based, null = first page
  page_to           (optional)  int                   1-based, null = last page

Removed fields (vs main branch):
  ocr_mode, ocr_engine, ocr_languages

Response: 202 { "job_id": "uuid" }
Errors: 415 (bad type), 413 (too large), 503 (VLM not loaded)
```

### GET /api/jobs/{job_id}/stream

```
Content-Type: text/event-stream

Events (unchanged):
  started     { type: "started" }
  completed   { type: "completed", markdown: "...", engine: "vlm-mlx" | "standard" }
  failed      { type: "failed", message: "..." }
```

### GET /api/health

```json
{ "status": "ok", "vlm_loaded": true, "engine": "granite_docling-mlx" }
```

## Frontend Changes

### OptionsPanel.tsx — Simplified

Removed: OCR Mode selector, OCR Engine selector, OCR Languages input
Added: Engine toggle ("MLX" / "Standard") — only shown for PDF files
Kept: Page range (from/to), Table detection checkbox

### types/job.ts

```typescript
// Removed: ocr_mode, ocr_engine, ocr_languages from ConversionOptions
// Added: engine: "vlm" | "standard"

interface ConversionOptions {
  engine: "vlm" | "standard";
  table_detection: boolean;
  page_from?: number;
  page_to?: number;
}
```

### App.tsx

Updated FormData construction to use new fields. Removed OCR-related state.

## Dependencies

### pyproject.toml

```toml
[project]
name = "docling-webapp"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.135.0",
    "uvicorn[standard]",
    "python-multipart",
    "docling>=2.84.0",
    "mlx-vlm",
    "tesserocr",
]

[tool.uv]
# PyTorch will come as mlx-vlm transitive dependency (macOS native, with MPS)
```

### System Dependencies (macOS)

```bash
brew install tesseract
```

### Removed Dependencies (vs main)

- `easyocr` — heavy, CUDA-oriented
- `rapidocr-onnxruntime` — ONNX not needed with MLX

## Commands

```bash
# Initial setup (once)
make setup        # brew install tesseract + uv sync + frontend build

# Run
make run          # uv run uvicorn backend.main:app --host 0.0.0.0 --port 9000

# Development (backend hot-reload)
make dev          # uv run uvicorn backend.main:app --reload --port 9000

# Frontend development (separate terminal, optional)
cd frontend && npm run dev   # Vite dev server on 5173, proxy to 9000

# Custom port
PORT=7000 make run
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| VLM model fails to load | App starts with StandardConverter only. `/health` shows `vlm_loaded: false`. VLM requests get `503`. |
| Unsupported file type | `415 Unsupported Media Type` |
| File too large | `413 Payload Too Large` |
| Conversion fails | SSE `failed` event with error message |
| Port in use | Uvicorn fails to bind, error in terminal |

## Out of Scope

- Docker support (files kept for git history, not maintained on this branch)
- Multi-user / remote deployment
- Persistent job storage (in-memory, same as main)
- EasyOCR / RapidOCR engines
