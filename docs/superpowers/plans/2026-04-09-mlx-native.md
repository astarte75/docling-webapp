# MLX Native Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Docker-based architecture with a macOS-native setup leveraging Apple Silicon MLX for PDF conversion via GraniteDocling VLM pipeline, while reusing the existing React frontend.

**Architecture:** FastAPI serves both the API (`/api/*`) and the built frontend (static files). PDF files route through VlmConverter (GraniteDocling + MLX), non-PDF files through StandardConverter (Docling default parser). Model loaded eagerly at startup. Dependencies managed by uv.

**Tech Stack:** Python 3.12, FastAPI, Docling VLM pipeline, MLX, uv, React + Vite + shadcn/ui (existing frontend)

**Spec:** `docs/superpowers/specs/2026-04-09-mlx-native-design.md`

---

## Task 0: Create branch and pyproject.toml

**Files:**
- Create: `pyproject.toml`

- [ ] **Step 1: Create the `mlx-native` branch**

```bash
git checkout -b mlx-native
```

- [ ] **Step 2: Create `pyproject.toml`**

Create `pyproject.toml` in the project root:

```toml
[project]
name = "docling-webapp"
version = "0.1.0"
description = "Document conversion webapp powered by Docling + MLX on Apple Silicon"
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
dev-dependencies = [
    "pytest",
    "pytest-asyncio",
    "httpx",
]
```

- [ ] **Step 3: Run `uv sync` to create venv and lock file**

```bash
uv sync
```

Expected: creates `.venv/`, `uv.lock`. This will take a few minutes (downloads PyTorch, MLX, Docling models).

- [ ] **Step 4: Add `.venv/` to `.gitignore` if not already present**

Check `.gitignore` — if `.venv/` is not listed, add it.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml uv.lock .gitignore
git commit -m "chore: add pyproject.toml with uv and MLX dependencies"
```

---

## Task 1: Rewrite `backend/config.py`

**Files:**
- Modify: `backend/config.py`

- [ ] **Step 1: Rewrite config.py**

Replace the entire contents of `backend/config.py` with:

```python
import os

PORT = int(os.getenv("PORT", "9000"))

MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "1"))

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".md"}
```

- [ ] **Step 2: Commit**

```bash
git add backend/config.py
git commit -m "refactor(config): add PORT=9000, reduce MAX_CONCURRENT_JOBS to 1 for MLX"
```

---

## Task 2: Create `backend/converter.py`

**Files:**
- Create: `backend/converter.py`
- Create: `backend/tests/test_converter.py`

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_converter.py`:

```python
"""Tests for ConversionOptions and engine routing logic.

Unit tests only — no actual Docling model loading.
"""

import pytest
from converter import ConversionOptions, resolve_engine


class TestConversionOptionsDefaults:
    def test_default_engine(self):
        opts = ConversionOptions()
        assert opts.engine == "vlm"

    def test_default_table_detection(self):
        opts = ConversionOptions()
        assert opts.table_detection is True

    def test_default_page_range(self):
        opts = ConversionOptions()
        assert opts.page_from is None
        assert opts.page_to is None


class TestResolveEngine:
    def test_pdf_defaults_to_vlm(self):
        assert resolve_engine(".pdf", "vlm") == "vlm"

    def test_pdf_explicit_standard(self):
        assert resolve_engine(".pdf", "standard") == "standard"

    def test_docx_always_standard(self):
        assert resolve_engine(".docx", "vlm") == "standard"

    def test_pptx_always_standard(self):
        assert resolve_engine(".pptx", "standard") == "standard"

    def test_xlsx_always_standard(self):
        assert resolve_engine(".xlsx", "vlm") == "standard"

    def test_html_always_standard(self):
        assert resolve_engine(".html", "vlm") == "standard"

    def test_md_always_standard(self):
        assert resolve_engine(".md", "vlm") == "standard"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_converter.py -v
```

Expected: `ModuleNotFoundError: No module named 'converter'`

- [ ] **Step 3: Write `backend/converter.py`**

```python
import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import VlmConvertOptions, VlmPipelineOptions
from docling.datamodel.vlm_engine_options import MlxVlmEngineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.vlm_pipeline import VlmPipeline

logger = logging.getLogger(__name__)

# Extensions that only support standard parsing (no VLM)
_NON_PDF_EXTENSIONS = {".docx", ".pptx", ".xlsx", ".html", ".htm", ".md"}


@dataclass
class ConversionOptions:
    """Per-job conversion options passed from the API endpoint to the worker."""
    engine: str = "vlm"              # "vlm" | "standard"
    table_detection: bool = True
    page_from: Optional[int] = None  # 1-based inclusive
    page_to: Optional[int] = None    # 1-based inclusive, None = last page


def resolve_engine(extension: str, requested: str) -> str:
    """Determine actual engine based on file extension and user request.

    VLM only works on PDF. Non-PDF files always use standard parser.
    """
    if extension.lower() in _NON_PDF_EXTENSIONS:
        return "standard"
    return requested


class VlmConverter:
    """PDF → Markdown via GraniteDocling + MLX. Loaded once at startup."""

    def __init__(self) -> None:
        logger.info("Loading VLM model (GraniteDocling + MLX)...")
        vlm_options = VlmConvertOptions.from_preset(
            "granite_docling",
            engine_options=MlxVlmEngineOptions(),
        )
        self._converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_cls=VlmPipeline,
                    pipeline_options=VlmPipelineOptions(vlm_options=vlm_options),
                )
            }
        )
        logger.info("VLM model loaded successfully")

    async def convert(self, file_path: str, opts: ConversionOptions) -> str:
        """Convert a PDF file to Markdown using VLM/MLX pipeline."""
        kwargs = {"source": file_path}
        if opts.page_from is not None:
            kwargs["page_range"] = (opts.page_from, opts.page_to or 99999)

        result = await asyncio.to_thread(self._converter.convert, **kwargs)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        return result.document.export_to_markdown()


class StandardConverter:
    """Fallback converter for non-PDF formats using Docling's default parsers."""

    def __init__(self) -> None:
        self._converter = DocumentConverter()
        logger.info("StandardConverter initialized")

    async def convert(self, file_path: str, opts: ConversionOptions) -> str:
        """Convert a file to Markdown using Docling's standard pipeline."""
        result = await asyncio.to_thread(self._converter.convert, source=file_path)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        return result.document.export_to_markdown()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_converter.py -v
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/converter.py backend/tests/test_converter.py
git commit -m "feat(backend): add VlmConverter and StandardConverter with MLX support"
```

---

## Task 3: Rewrite `backend/job_store.py`

**Files:**
- Modify: `backend/job_store.py`

- [ ] **Step 1: Rewrite `backend/job_store.py`**

Replace the entire contents with:

```python
import asyncio
import logging
import os
from dataclasses import dataclass, field

from converter import ConversionOptions, resolve_engine
from config import MAX_CONCURRENT_JOBS

logger = logging.getLogger(__name__)


@dataclass
class Job:
    """Represents a single conversion job."""
    job_id: str
    tmp_path: str
    extension: str                  # e.g. ".pdf", ".docx"
    options: ConversionOptions = field(default_factory=ConversionOptions)
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    status: str = "queued"


async def conversion_worker(state) -> None:
    """Background worker that processes conversion jobs from state.dispatch_queue.

    Routes PDF files to VlmConverter (MLX) and non-PDF to StandardConverter.
    Uses asyncio.Semaphore(MAX_CONCURRENT_JOBS) to limit concurrent conversions.
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

    async def process_job(job_id: str) -> None:
        job = state.jobs[job_id]
        async with semaphore:
            try:
                job.status = "converting"
                await job.events.put({"type": "started", "message": "Conversion started"})

                engine = resolve_engine(job.extension, job.options.engine)

                if engine == "vlm" and state.vlm is not None:
                    markdown = await state.vlm.convert(job.tmp_path, job.options)
                    engine_label = "vlm-mlx"
                elif engine == "vlm" and state.vlm is None:
                    raise RuntimeError("VLM engine not available — model failed to load at startup")
                else:
                    markdown = await state.standard.convert(job.tmp_path, job.options)
                    engine_label = "standard"

                job.status = "completed"
                await job.events.put({
                    "type": "completed",
                    "markdown": markdown,
                    "engine": engine_label,
                })

            except RuntimeError as exc:
                job.status = "failed"
                await job.events.put({"type": "failed", "message": str(exc)})

            except Exception:
                logger.exception("Unexpected error processing job %s", job_id)
                job.status = "failed"
                await job.events.put({"type": "failed", "message": "Internal server error"})

            finally:
                if os.path.exists(job.tmp_path):
                    os.remove(job.tmp_path)
                state.dispatch_queue.task_done()

    while True:
        job_id = await state.dispatch_queue.get()
        asyncio.create_task(process_job(job_id))
```

- [ ] **Step 2: Commit**

```bash
git add backend/job_store.py
git commit -m "refactor(job_store): route jobs to VLM or Standard converter by file extension"
```

---

## Task 4: Rewrite `backend/main.py`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Rewrite `backend/main.py`**

Replace the entire contents with:

```python
import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from typing import Optional

from converter import ConversionOptions, VlmConverter, StandardConverter
from config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES
from job_store import Job, conversion_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: load VLM model eagerly, init job queue and worker."""
    # Eager VLM model loading — may take 20-30s
    try:
        app.state.vlm = VlmConverter()
        app.state.vlm_loaded = True
    except Exception as e:
        logger.error("Failed to load VLM model: %s", e)
        logger.warning("App starting without VLM — only standard converter available")
        app.state.vlm = None
        app.state.vlm_loaded = False

    app.state.standard = StandardConverter()
    app.state.dispatch_queue = asyncio.Queue()
    app.state.jobs: dict[str, Job] = {}
    app.state._worker = asyncio.create_task(conversion_worker(app.state))

    logger.info("Application startup complete (vlm_loaded=%s)", app.state.vlm_loaded)
    yield

    if app.state._worker is not None:
        app.state._worker.cancel()
        try:
            await app.state._worker
        except asyncio.CancelledError:
            pass
    logger.info("Shutting down")


app = FastAPI(title="Docling Webapp API", lifespan=lifespan)


# --- Custom exception handlers ---

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": str(exc)},
    )


# --- API Routes (prefix /api via APIRouter) ---

api = APIRouter(prefix="/api")


@api.get("/health")
async def health(request: Request) -> dict:
    """Health check — reports VLM model status."""
    return {"status": "ok", "vlm_loaded": request.app.state.vlm_loaded}


@api.post("/convert")
async def convert(
    request: Request,
    file: UploadFile,
    engine: str = Form(default="vlm"),            # "vlm" | "standard"
    table_detection: bool = Form(default=True),
    page_from: Optional[int] = Form(default=None),
    page_to: Optional[int] = Form(default=None),
) -> JSONResponse:
    """Accept a file upload and enqueue it for async conversion.

    Returns 202 with job_id. Connect to SSE stream for progress.
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Accepted: PDF, DOCX, PPTX, XLSX, HTML, MD.",
        )

    # Read file in 1MB chunks, enforcing size limit
    chunks: list[bytes] = []
    total_bytes = 0
    while chunk := await file.read(1024 * 1024):
        total_bytes += len(chunk)
        if total_bytes > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB limit",
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # Write to temp file
    job_id = str(uuid.uuid4())
    tmp_path = f"/tmp/{job_id}{ext}"
    with open(tmp_path, "wb") as f:
        f.write(content)

    # Check VLM availability before enqueuing
    if engine == "vlm" and ext == ".pdf" and not request.app.state.vlm_loaded:
        os.remove(tmp_path)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VLM engine not available — model failed to load at startup",
        )

    options = ConversionOptions(
        engine=engine,
        table_detection=table_detection,
        page_from=page_from,
        page_to=page_to,
    )

    job = Job(job_id=job_id, tmp_path=tmp_path, extension=ext, options=options)
    request.app.state.jobs[job_id] = job
    await request.app.state.dispatch_queue.put(job_id)

    logger.info("Job %s queued (%d bytes, %s) engine=%s", job_id, total_bytes, filename, engine)
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"job_id": job_id})


async def _job_event_generator(job):
    """Async generator that yields SSE-formatted strings from a job's event queue."""
    while True:
        event_data: dict = await job.events.get()
        event_type = event_data["type"]
        yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"
        if event_type in ("completed", "failed"):
            break


@api.get("/jobs/{job_id}/stream", response_model=None)
async def stream_job(job_id: str, request: Request):
    """Stream SSE progress events for a conversion job."""
    if job_id not in request.app.state.jobs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    job = request.app.state.jobs[job_id]
    return StreamingResponse(_job_event_generator(job), media_type="text/event-stream")


# --- Include router and mount static files ---

app.include_router(api)

# Serve frontend build — must be last (catch-all)
_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="static")
else:
    logger.warning("Frontend dist not found at %s — serving API only", _frontend_dist)
```

- [ ] **Step 2: Verify the app module loads without errors**

```bash
cd backend && uv run python -c "from main import app; print('OK:', app.title)"
```

Expected: `OK: Docling Webapp API` (VLM loading may print progress logs, that's fine; if MLX is not installed yet, the app will still start with `vlm_loaded=False`).

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "refactor(main): rewrite for MLX — eager VLM load, static mount, simplified API"
```

---

## Task 5: Delete `backend/adapter.py` and old tests

**Files:**
- Delete: `backend/adapter.py`
- Delete: `backend/tests/test_adapter_options.py`

- [ ] **Step 1: Remove old files**

```bash
git rm backend/adapter.py backend/tests/test_adapter_options.py
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove old adapter.py and OCR tests (replaced by converter.py)"
```

---

## Task 6: Update frontend types (`types/job.ts`)

**Files:**
- Modify: `frontend/src/types/job.ts`

- [ ] **Step 1: Rewrite `frontend/src/types/job.ts`**

Replace the entire contents with:

```typescript
// Types for the async job flow: POST /api/convert → SSE stream

/** Possible phases of the single-file conversion flow */
export type AppPhase =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File }
  | { phase: 'converting'; jobId: string; file: File }
  | { phase: 'success'; markdown: string; filename: string; engine: Engine }
  | { phase: 'error'; message: string; file: File }
  | { phase: 'batch-active'; files: BatchFile[] }
  | { phase: 'batch-complete'; files: BatchFile[] };

/** Response from POST /api/convert (202 Accepted) */
export interface ConvertResponse {
  job_id: string;
}

/** Error response format from backend (all errors) */
export interface ApiError {
  error: string;
}

/** SSE event types from GET /api/jobs/{job_id}/stream */
export type SSEEventType = 'started' | 'completed' | 'failed';

/** SSE started event payload */
export interface SSEStartedEvent {
  type: 'started';
  message: string;
}

/** SSE completed event payload */
export interface SSECompletedEvent {
  type: 'completed';
  markdown: string;
  engine: string;
}

/** SSE failed event payload */
export interface SSEFailedEvent {
  type: 'failed';
  message: string;
}

export type SSEEvent = SSEStartedEvent | SSECompletedEvent | SSEFailedEvent;

/** Conversion engine */
export type Engine = 'vlm' | 'standard';

/** Conversion options — captured at file-drop time, immutable per file */
export interface ConversionOptions {
  engine: Engine;
  tableDetection: boolean;
  pageFrom: number | null;
  pageTo: number | null;
}

/** Default options */
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  engine: 'vlm',
  tableDetection: true,
  pageFrom: null,
  pageTo: null,
};

/** Engine options for the UI */
export const ENGINES: { value: Engine; label: string }[] = [
  { value: 'vlm', label: 'MLX (GraniteDocling)' },
  { value: 'standard', label: 'Standard' },
];

/** Status of a single file in a batch conversion */
export type BatchFileStatus = 'pending' | 'converting' | 'done' | 'error' | 'cancelled';

/** A single file entry in the batch list */
export interface BatchFile {
  id: string;
  file: File;
  options: ConversionOptions;
  status: BatchFileStatus;
  jobId?: string;
  markdown?: string;
  errorMessage?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/job.ts
git commit -m "refactor(frontend): simplify types — remove OCR options, add Engine type"
```

---

## Task 7: Update `OptionsPanel.tsx`

**Files:**
- Modify: `frontend/src/components/OptionsPanel.tsx`

- [ ] **Step 1: Rewrite `frontend/src/components/OptionsPanel.tsx`**

Replace the entire contents with:

```tsx
import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';

import { ENGINES } from '@/types/job';
import type { ConversionOptions, Engine } from '@/types/job';

interface OptionsPanelProps {
  value: ConversionOptions;
  onChange: (opts: ConversionOptions) => void;
}

export function OptionsPanel({ value, onChange }: OptionsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      {/* Engine toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0">Engine</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={value.engine}
          onValueChange={(v) => {
            if (!v) return;
            onChange({ ...value, engine: v as Engine });
          }}
        >
          {ENGINES.map((e) => (
            <ToggleGroupItem key={e.value} value={e.value}>
              {e.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Collapsible advanced options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
          Advanced options
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Table detection switch */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Table detection</span>
            <Switch
              checked={value.tableDetection}
              onCheckedChange={(checked) =>
                onChange({ ...value, tableDetection: checked })
              }
            />
          </div>

          {/* Page range inputs */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">Pages: from</span>
            <input
              type="number"
              min="1"
              placeholder="1"
              value={value.pageFrom ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  pageFrom: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20 text-center rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="number"
              min="1"
              placeholder="end"
              value={value.pageTo ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  pageTo: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="w-20 text-center rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/OptionsPanel.tsx
git commit -m "refactor(OptionsPanel): simplify — engine toggle + page range + table detection"
```

---

## Task 8: Update `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update imports and remove OCR references**

In `frontend/src/App.tsx`, update the import line:

```typescript
import type { AppPhase, ConversionOptions } from '@/types/job';
import { DEFAULT_CONVERSION_OPTIONS, ENGINES } from '@/types/job';
```

Change to:

```typescript
import type { AppPhase, ConversionOptions } from '@/types/job';
import { DEFAULT_CONVERSION_OPTIONS } from '@/types/job';
```

(`ENGINES` and `OCR_ENGINES` are no longer used in App.tsx.)

- [ ] **Step 2: Update the single-file FormData construction**

Replace the FormData block in `handleFilesSelected` (inside the `if (files.length === 1)` branch). Find:

```typescript
        const formData = new FormData();
        formData.append('file', file);
        formData.append('ocr_mode', currentOptions.ocrMode);
        formData.append('ocr_engine', currentOptions.ocrEngine);
        formData.append('table_detection', String(currentOptions.tableDetection));
        if (currentOptions.pageFrom !== null) formData.append('page_from', String(currentOptions.pageFrom));
        if (currentOptions.pageTo !== null) formData.append('page_to', String(currentOptions.pageTo));
        if (currentOptions.ocrLanguages.length > 0) formData.append('ocr_languages', currentOptions.ocrLanguages.join(','));
```

Replace with:

```typescript
        const formData = new FormData();
        formData.append('file', file);
        formData.append('engine', currentOptions.engine);
        formData.append('table_detection', String(currentOptions.tableDetection));
        if (currentOptions.pageFrom !== null) formData.append('page_from', String(currentOptions.pageFrom));
        if (currentOptions.pageTo !== null) formData.append('page_to', String(currentOptions.pageTo));
```

- [ ] **Step 3: Update SSE `onCompleted` callback**

Find the `onCompleted` callback:

```typescript
    onCompleted: useCallback((markdown: string, ocrEngine: string, ocrEngineRequested?: string) => {
      setState((prev) => ({
        phase: 'success',
        markdown,
        filename: prev.phase === 'converting' ? prev.file.name : 'document',
        ocrEngine: ocrEngine as import('@/types/job').OcrEngine,
        ocrEngineRequested: ocrEngineRequested as import('@/types/job').OcrEngine | undefined,
      }));
    }, []),
```

Replace with:

```typescript
    onCompleted: useCallback((markdown: string, engine: string) => {
      setState((prev) => ({
        phase: 'success',
        markdown,
        filename: prev.phase === 'converting' ? prev.file.name : 'document',
        engine: engine as import('@/types/job').Engine,
      }));
    }, []),
```

- [ ] **Step 4: Update SSE `onFailed` callback**

Find:

```typescript
    onFailed: useCallback((message: string, ocrEngine?: string) => {
      setState((prev) => ({
        phase: 'error',
        message,
        file: prev.phase === 'converting' ? prev.file : new File([], 'unknown'),
        ocrEngine: ocrEngine as import('@/types/job').OcrEngine | undefined,
      }));
    }, []),
```

Replace with:

```typescript
    onFailed: useCallback((message: string) => {
      setState((prev) => ({
        phase: 'error',
        message,
        file: prev.phase === 'converting' ? prev.file : new File([], 'unknown'),
      }));
    }, []),
```

- [ ] **Step 5: Update success state engine badge**

Find the engine badge section in the success layout (inside `displaySuccess && state.phase === 'success'`):

```typescript
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">Conversion complete</p>
                {state.ocrEngineRequested ? (
                  <span className="inline-flex items-center rounded-full border border-yellow-500/50 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngineRequested)?.label ?? state.ocrEngineRequested} → {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                    OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine}
                  </span>
                )}
              </div>
```

Replace with:

```typescript
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">Conversion complete</p>
                <span className="inline-flex items-center rounded-full border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  {state.engine === 'vlm-mlx' ? 'MLX' : 'Standard'}
                </span>
              </div>
```

- [ ] **Step 6: Remove OCR engine badge from error state**

Find:

```typescript
              {state.ocrEngine && (
                <span className="inline-flex items-center rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  OCR: {OCR_ENGINES.find(e => e.value === state.ocrEngine)?.label ?? state.ocrEngine} — non disponibile
                </span>
              )}
```

Remove this entire block (the error message from the SSE `failed` event is sufficient).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor(App): update for MLX API — remove OCR options, use engine field"
```

---

## Task 9: Update hooks

**Files:**
- Modify: `frontend/src/hooks/useJobStream.ts`
- Modify: `frontend/src/hooks/useBatchUpload.ts`

- [ ] **Step 1: Update `useJobStream.ts`**

Replace the entire contents of `frontend/src/hooks/useJobStream.ts` with:

```typescript
import { useEffect, useRef } from 'react';

interface StreamCallbacks {
  onCompleted: (markdown: string, engine: string) => void;
  onFailed: (message: string) => void;
}

export function useJobStream(jobId: string | null, callbacks: StreamCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);

    es.addEventListener('completed', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: 'completed'; markdown: string; engine: string };
      callbacksRef.current.onCompleted(data.markdown, data.engine);
      es.close();
    });

    es.addEventListener('failed', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: 'failed'; message: string };
      callbacksRef.current.onFailed(data.message);
      es.close();
    });

    es.onerror = () => {
      callbacksRef.current.onFailed('Connection error');
      es.close();
    };

    return () => es.close();
  }, [jobId]);
}
```

- [ ] **Step 2: Update `useBatchUpload.ts` — `uploadFileWithOptions` helper**

In `frontend/src/hooks/useBatchUpload.ts`, find the `uploadFileWithOptions` function:

```typescript
async function uploadFileWithOptions(
  file: File,
  opts: ConversionOptions
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ocr_mode', opts.ocrMode);
  formData.append('ocr_engine', opts.ocrEngine);
  formData.append('table_detection', String(opts.tableDetection));
  if (opts.pageFrom !== null) formData.append('page_from', String(opts.pageFrom));
  if (opts.pageTo !== null) formData.append('page_to', String(opts.pageTo));
  if (opts.ocrLanguages.length > 0) formData.append('ocr_languages', opts.ocrLanguages.join(','));

  const res = await fetch('/api/convert', { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.error || 'Upload failed');
  }
  const data = await res.json();
  return data.job_id as string;
}
```

Replace with:

```typescript
async function uploadFileWithOptions(
  file: File,
  opts: ConversionOptions
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('engine', opts.engine);
  formData.append('table_detection', String(opts.tableDetection));
  if (opts.pageFrom !== null) formData.append('page_from', String(opts.pageFrom));
  if (opts.pageTo !== null) formData.append('page_to', String(opts.pageTo));

  const res = await fetch('/api/convert', { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.error || 'Upload failed');
  }
  const data = await res.json();
  return data.job_id as string;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useJobStream.ts frontend/src/hooks/useBatchUpload.ts
git commit -m "refactor(hooks): update SSE and upload for engine-based API"
```

---

## Task 10: Update Vite proxy and build frontend

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Update Vite proxy target port**

In `frontend/vite.config.ts`, change the proxy target from `http://localhost:3000` to `http://localhost:9000`:

Find:

```typescript
        target: 'http://localhost:3000',
```

Replace with:

```typescript
        target: 'http://localhost:9000',
```

- [ ] **Step 2: Build frontend**

```bash
cd frontend && npm install && npm run build
```

Expected: builds to `frontend/dist/` without errors.

- [ ] **Step 3: Verify TypeScript compilation has no errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "fix(vite): update proxy target to port 9000"
```

---

## Task 11: Rewrite `Makefile`

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Rewrite `Makefile`**

Replace the entire contents with:

```makefile
PORT ?= 9000

.PHONY: help setup build-frontend run dev clean

help: ## Show available targets
	@echo "Usage: make <target>"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

setup: ## Initial setup: install system deps, Python deps, and build frontend
	@echo "Installing system dependencies..."
	brew install tesseract || true
	@echo "Installing Python dependencies..."
	uv sync
	@echo "Building frontend..."
	cd frontend && npm install && npm run build
	@echo ""
	@echo "Setup complete. Run 'make run' to start the app."

build-frontend: ## Build frontend static files
	cd frontend && npm run build

run: ## Run the app (API + frontend on PORT, default 9000)
	uv run uvicorn backend.main:app --host 0.0.0.0 --port $(PORT)

dev: ## Run with hot-reload (backend only, frontend served from last build)
	uv run uvicorn backend.main:app --host 0.0.0.0 --port $(PORT) --reload

clean: ## Remove build artifacts
	rm -rf frontend/dist .venv __pycache__ backend/__pycache__
```

- [ ] **Step 2: Commit**

```bash
git add Makefile
git commit -m "refactor(Makefile): rewrite for native macOS — setup, run, dev targets"
```

---

## Task 12: End-to-end smoke test

**Files:** none (verification only)

- [ ] **Step 1: Build frontend if not already built**

```bash
cd frontend && npm run build
```

- [ ] **Step 2: Start the app**

```bash
make run
```

Expected: logs show VLM model loading (~20-30s), then "Application startup complete (vlm_loaded=True)".

- [ ] **Step 3: Test health endpoint**

```bash
curl http://localhost:9000/api/health
```

Expected: `{"status":"ok","vlm_loaded":true}`

- [ ] **Step 4: Test frontend is served**

Open `http://localhost:9000` in browser. Expected: the Docling Webapp UI loads with the engine toggle (MLX / Standard).

- [ ] **Step 5: Test PDF conversion**

Drop a PDF file into the UI. Expected: conversion completes with engine badge showing "MLX".

- [ ] **Step 6: Test non-PDF conversion**

Drop a DOCX file. Expected: conversion completes with engine badge showing "Standard".

- [ ] **Step 7: Stop the app and commit any fixes**

If any adjustments were needed during smoke testing, commit them now.

```bash
git add -A
git commit -m "fix: smoke test adjustments"
```
