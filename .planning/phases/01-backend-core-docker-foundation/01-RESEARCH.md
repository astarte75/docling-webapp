# Phase 1: Backend Core + Docker Foundation - Research

**Researched:** 2026-03-02
**Domain:** Docling + FastAPI + Docker — synchronous PDF-to-Markdown conversion API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **File format scope:** Accept only PDF in Phase 1. Validate via Content-Type header + file extension before saving to disk. Reject non-PDF with HTTP 415 `{"error": "Unsupported file type. Only PDF accepted."}`. `ALLOWED_EXTENSIONS = {".pdf"}` as hardcoded constant.
- **Temporary file handling:** Save uploaded PDF to `/tmp/<uuid>.pdf`, convert with Docling, return Markdown, delete temp file immediately after conversion (success or failure). No persistent upload directory.
- **API response shape (success):** HTTP 200 OK, Content-Type: application/json, Body: `{"markdown": "<converted content>"}`.
- **Upload size limit:** Reject files over 50MB with HTTP 413 `{"error": "File exceeds 50MB limit"}`. Configurable via env var `MAX_UPLOAD_SIZE_MB` (default: `"50"`). Applied before saving file to disk.
- **DoclingAdapter lifecycle:** Instantiated once at application startup via FastAPI lifespan context manager. Stored in `app.state.converter`. Destroyed cleanly on shutdown. Never instantiated per-request.
- **Error response format:** All errors return `{"error": "<message>"}`. HTTP 413: file too large. HTTP 415: unsupported file type. HTTP 422: Docling conversion failed (includes exception message). HTTP 500: unexpected server errors.
- **Logging:** Python `logging` module on stdout. Uvicorn access log + application logs visible via `docker compose logs`. INFO for normal ops, ERROR with traceback for failures.

### Claude's Discretion
- Exact Python project structure (flat vs src layout)
- requirements.txt vs pyproject.toml
- Uvicorn worker configuration
- Exact apt packages needed for Docling native deps

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Application starts with a single `docker compose up` command | Docker Compose pattern documented; Dockerfile + compose.yml structure verified |
| INFR-02 | Docling models are pre-downloaded in the Docker image so first conversion does not hang | `docling-tools models download` during Docker build verified from official Dockerfile; `DOCLING_ARTIFACTS_PATH` env var documented |
| INFR-03 | Application is accessible via browser at a configurable localhost port (default 3000) | Port mapping via Docker Compose env var pattern documented |
| CONV-01 | User can trigger document conversion with a single action after upload | FastAPI `POST /convert` with `UploadFile` + synchronous Docling call via `asyncio.to_thread` documented |
</phase_requirements>

---

## Summary

This phase establishes the foundation of the entire project: a Dockerized FastAPI service that accepts a PDF upload and returns converted Markdown using Docling. The critical decisions are already locked — the main research value is in verifying the exact implementation details for Docker (base image, system packages, model pre-download command) and FastAPI (lifespan singleton, file upload size enforcement, async wrapping of Docling).

The official Docling Dockerfile (as of v2.76.0, released 2026-03-02) uses `python:3.11-slim-bookworm` with a minimal set of apt packages (`libgl1`, `libglib2.0-0`, `curl`, `wget`). Models are pre-downloaded at build time via `docling-tools models download`. CPU-only PyTorch is installed via `--extra-index-url https://download.pytorch.org/whl/cpu`, reducing image size from ~9.7GB to ~1.7GB. The `DocumentConverter` is synchronous and not natively async, so it must be wrapped with `asyncio.to_thread()` in FastAPI async endpoints. Thread safety with a single `asyncio.Lock` is needed since PDF backends serialize internally but the lock prevents races in the singleton.

**Primary recommendation:** Use `python:3.12-slim-bookworm` (matching the STATE.md decision to use Python 3.12), install CPU-only PyTorch, pre-download models with `docling-tools models download`, and wrap the singleton `DocumentConverter` in `asyncio.to_thread()` protected by an `asyncio.Lock`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docling | 2.76.0 (latest as of 2026-03-02) | PDF-to-Markdown conversion engine | The core product requirement — no alternative |
| fastapi | Latest stable (0.115.x) | ASGI web framework for the API | Locked decision; async-first, excellent OpenAPI support |
| uvicorn | Latest stable | ASGI server | Standard pairing with FastAPI |
| python-multipart | Latest stable | Required for FastAPI file upload handling | Mandatory — FastAPI raises error without it for UploadFile |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | Latest stable | Load env vars from `.env` file | Development convenience; Docker sets env vars natively |
| PyTorch (CPU) | As installed by docling | Deep learning backend for Docling models | CPU-only wheel reduces image size by ~82% |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| requirements.txt | pyproject.toml | pyproject.toml is more modern but adds complexity for a single-service backend — requirements.txt is simpler for Docker COPY + pip install |
| uvicorn directly | gunicorn + UvicornWorker | Gunicorn adds process management; overkill for single-container v1 |
| python:3.12-slim-bookworm | python:3.11-slim-bookworm | Official Docling Dockerfile uses 3.11, but STATE.md decision is 3.12 (avoid 3.13 experimental threading). Both work. |

**Installation (inside Docker):**
```bash
pip install --no-cache-dir docling fastapi uvicorn[standard] python-multipart \
    --extra-index-url https://download.pytorch.org/whl/cpu
```

---

## Architecture Patterns

### Recommended Project Structure

Flat layout (Claude's Discretion area) — preferred for a small single-service backend:

```
backend/
├── main.py              # FastAPI app, lifespan, routes
├── adapter.py           # DoclingAdapter class (wraps DocumentConverter)
├── config.py            # Settings from env vars (MAX_UPLOAD_SIZE_MB, etc.)
├── requirements.txt     # Python dependencies
Dockerfile
docker-compose.yml
.env.example             # Template for local dev env vars
```

No `src/` layout needed — this is a single-module service, not a library.

### Pattern 1: FastAPI Lifespan Singleton

**What:** Initialize `DocumentConverter` once at startup, store in `app.state`, access in every route via `request.app.state`.
**When to use:** Any expensive resource that must not be re-created per request (ML models, DB connections).

```python
# Source: https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
from fastapi import FastAPI
from docling.document_converter import DocumentConverter

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create the singleton converter
    import asyncio
    app.state.converter = DocumentConverter()
    app.state.lock = asyncio.Lock()
    yield
    # Shutdown: clean up
    del app.state.converter

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: Wrapping Synchronous Docling in Async FastAPI

**What:** Docling's `DocumentConverter.convert()` is synchronous and CPU-bound. It must not block the event loop.
**When to use:** Every call to `converter.convert()` from an async FastAPI route.

```python
# Source: GitHub issue #2229 docling-project/docling
import asyncio
from fastapi import FastAPI, Request, UploadFile
import tempfile, os, uuid

@app.post("/convert")
async def convert(request: Request, file: UploadFile):
    file_path = f"/tmp/{uuid.uuid4()}.pdf"
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        async with request.app.state.lock:
            result = await asyncio.to_thread(
                request.app.state.converter.convert, file_path
            )

        markdown = result.document.export_to_markdown()
        return {"markdown": markdown}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
```

**Note:** The `asyncio.Lock()` serializes concurrent conversions. For Phase 1 (single-user), this is acceptable. Phase 2 will revisit concurrency.

### Pattern 3: Upload Size Check Before Disk Write

**What:** Check file size in chunks before writing anything to disk, to enforce the 50MB limit.
**When to use:** The locked decision requires rejection before disk I/O.

```python
# Source: https://github.com/fastapi/fastapi/discussions/8167
from fastapi import HTTPException, status
import os

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024

async def read_with_size_limit(file: UploadFile) -> bytes:
    """Read UploadFile content, raising 413 if size exceeds MAX_UPLOAD_SIZE."""
    chunks = []
    total = 0
    while chunk := await file.read(1024 * 1024):  # 1MB chunks
        total += len(chunk)
        if total > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds 50MB limit",
            )
        chunks.append(chunk)
    return b"".join(chunks)
```

**Important:** Return the error as `{"error": "..."}` not the default `{"detail": "..."}` — use a custom exception handler or override the detail format.

### Pattern 4: Docker Model Pre-download

**What:** Run `docling-tools models download` during `docker build` to bake models into the image.
**When to use:** Every Docling Docker image (INFR-02 requirement).

```dockerfile
# Source: https://github.com/docling-project/docling/blob/main/Dockerfile
RUN docling-tools models download
ENV DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models
```

### Pattern 5: HTTPException Error Format Override

The locked decision requires `{"error": "..."}` not FastAPI's default `{"detail": "..."}`. Use a custom exception handler:

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )
```

### Anti-Patterns to Avoid

- **Instantiating `DocumentConverter()` per request:** Model load takes 10-30 seconds. Always use the lifespan singleton.
- **GPU PyTorch in Docker without GPU:** The default PyTorch wheel is ~8GB. Always use `--extra-index-url https://download.pytorch.org/whl/cpu` for a CPU-only container.
- **`opencv-python` instead of `opencv-python-headless`:** Causes `libGL.so.1: cannot open shared object file` in headless Docker containers. Docling installs opencv; ensure `libgl1` is installed via apt OR use `opencv-python-headless`.
- **Blocking the event loop with `converter.convert()` directly in async routes:** Use `asyncio.to_thread()` always.
- **No `finally` block for temp file cleanup:** If Docling throws, the temp file leaks. Always use try/finally.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom pypdf/pdfminer pipeline | `DocumentConverter` from docling | Layout detection, table extraction, OCR — enormous complexity |
| File upload streaming | Raw ASGI body reading | `UploadFile` from FastAPI | SpooledTemporaryFile, async interface, metadata already built in |
| JSON error responses | Custom middleware | FastAPI `HTTPException` + custom handler | Handles all error paths uniformly |
| Process management | Manual subprocess management | Uvicorn directly in Docker | Single container, single process — no supervisor needed in v1 |
| Model caching | Custom download scripts | `docling-tools models download` | Official CLI handles version-matched model downloads |

**Key insight:** Docling's value is in abstracting all the complexity of document layout analysis, OCR, and table detection. Never re-implement any part of that pipeline.

---

## Common Pitfalls

### Pitfall 1: libGL.so.1 Missing in Slim Docker Image

**What goes wrong:** Container fails to start with `ImportError: libGL.so.1: cannot open shared object file: No such file or directory`
**Why it happens:** `opencv-python` (a Docling dependency) requires OpenGL libraries that are not present in `slim` Docker images.
**How to avoid:** Add `libgl1` and `libglib2.0-0` to apt install in Dockerfile (confirmed from official Docling Dockerfile).
**Warning signs:** Error appears at import time, not during conversion — fails on startup.

```dockerfile
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
```

### Pitfall 2: Models Downloaded at Runtime (not Build Time)

**What goes wrong:** First conversion takes 5-10 minutes while models download from Hugging Face.
**Why it happens:** `DocumentConverter()` lazily downloads models on first use if not pre-baked.
**How to avoid:** Run `docling-tools models download` in Dockerfile RUN step. Set `DOCLING_ARTIFACTS_PATH` env var to point to the baked location.
**Warning signs:** First request hangs, logs show Hugging Face download progress.

### Pitfall 3: Huge Docker Image from GPU PyTorch

**What goes wrong:** Docker image is 9+ GB, slow to build and push.
**Why it happens:** Default PyTorch pip install pulls CUDA wheels (~8GB alone).
**How to avoid:** Use `--extra-index-url https://download.pytorch.org/whl/cpu` when installing docling.
**Warning signs:** `docker images` shows image > 5GB.

### Pitfall 4: FastAPI Returns `{"detail": "..."}` Not `{"error": "..."}`

**What goes wrong:** Error responses have `detail` field instead of locked `error` field — breaks Phase 3 frontend contract.
**Why it happens:** FastAPI's default `HTTPException` serializes to `{"detail": "..."}`.
**How to avoid:** Register a custom `@app.exception_handler(HTTPException)` that wraps response in `{"error": exc.detail}`.
**Warning signs:** Testing `/convert` with a 60MB file returns `{"detail": "File exceeds 50MB limit"}` instead of `{"error": "..."}`.

### Pitfall 5: Temp File Not Deleted on Conversion Failure

**What goes wrong:** `/tmp` fills up over time; sensitive PDF data persists.
**Why it happens:** Exception thrown by Docling skips cleanup code.
**How to avoid:** Always wrap conversion in `try/finally` block; delete in `finally`.
**Warning signs:** `/tmp/*.pdf` files accumulate after failed conversions.

### Pitfall 6: `DocumentConverter` Thread Safety Under `asyncio.to_thread`

**What goes wrong:** Concurrent requests corrupt conversion state or raise cryptic errors.
**Why it happens:** PDF backends in Docling have internal locking but the singleton's shared state can race under concurrent `asyncio.to_thread` calls.
**How to avoid:** Protect all `converter.convert()` calls with a shared `asyncio.Lock()` stored in `app.state`. Confirmed risk in STATE.md project notes.
**Warning signs:** Intermittent errors under load testing with multiple concurrent requests.

### Pitfall 7: Python 3.13 Free-Threaded Build Incompatibility

**What goes wrong:** PyTorch or Docling dependencies fail to install or behave incorrectly.
**Why it happens:** Python 3.13 free-threaded builds (no-GIL) are experimental; PyTorch support is not production-ready.
**How to avoid:** Use Python 3.12 (confirmed in STATE.md decisions).
**Warning signs:** Strange import errors or pip install failures for torch.

---

## Code Examples

### Complete Dockerfile Pattern

```dockerfile
# Source: official docling Dockerfile + Shekhar Gulati CPU optimization
FROM python:3.12-slim-bookworm

# Install system dependencies required by Docling/OpenCV
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (CPU-only PyTorch for ~82% size reduction)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Pre-download Docling models during build (INFR-02)
RUN docling-tools models download

# Make model path explicit for runtime
ENV DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models
# Prevent thread congestion in container
ENV OMP_NUM_THREADS=4

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Complete docker-compose.yml Pattern

```yaml
# Source: standard Docker Compose + port-configurable convention
services:
  backend:
    build: ./backend
    ports:
      - "${PORT:-3000}:8000"
    environment:
      - MAX_UPLOAD_SIZE_MB=${MAX_UPLOAD_SIZE_MB:-50}
    restart: unless-stopped
```

**Note:** INFR-03 requires configurable localhost port (default 3000). The container always listens on 8000 internally; only the host port is configurable.

### DoclingAdapter Class Pattern

```python
# adapter.py
import asyncio
import logging
from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)

class DoclingAdapter:
    """Wraps DocumentConverter with async support and thread safety."""

    def __init__(self):
        logger.info("Initializing DocumentConverter (this may take a moment)...")
        self._converter = DocumentConverter()
        self._lock = asyncio.Lock()
        logger.info("DocumentConverter ready")

    async def convert_file(self, file_path: str) -> str:
        """Convert a PDF file to Markdown. Thread-safe, non-blocking."""
        async with self._lock:
            result = await asyncio.to_thread(self._converter.convert, file_path)
        if result.status.value != "success":
            raise RuntimeError(f"Conversion failed: {result.status}")
        return result.document.export_to_markdown()
```

### requirements.txt

```text
fastapi
uvicorn[standard]
python-multipart
docling
```

(No pinned versions — let pip resolve compatible versions. Pin only if CI/CD shows instability.)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` decorator | `lifespan` context manager | FastAPI ~0.95 (2023) | `on_event` is deprecated; lifespan is the current standard |
| `pip install torch` (CUDA default) | `pip install torch --extra-index-url https://download.pytorch.org/whl/cpu` | PyTorch ~2.0 (2023) | Reduces image from 9.7GB to 1.7GB for CPU-only use |
| Manual model download scripts | `docling-tools models download` CLI | Docling ~2.x (2024) | Official CLI handles version-matched downloads |
| `run_in_executor(None, fn)` | `asyncio.to_thread(fn)` | Python 3.9 (2020) | `to_thread` is cleaner syntax for the common case |

**Deprecated/outdated:**
- `@app.on_event("startup")` / `@app.on_event("shutdown")`: Replaced by `lifespan` context manager. Still works but deprecated.
- Python 3.9 support in Docling: Dropped in v2.70.0. Use 3.10+.

---

## Open Questions

1. **Exact Tesseract/poppler requirement for basic PDF conversion**
   - What we know: Official Docling Dockerfile does NOT install `tesseract-ocr` or `poppler-utils` — only `libgl1` and `libglib2.0-0`
   - What's unclear: Whether basic PDF conversion (no OCR) needs poppler. Docling uses `pypdfium2` as its default PDF backend, which is a Python wheel (no apt dependency).
   - Recommendation: Start without `tesseract-ocr`/`poppler-utils`. Add them only if OCR failures occur. The locked decision defers OCR configuration to Phase 4.

2. **`asyncio.Lock` scope: per-adapter vs app.state**
   - What we know: The lock must serialize `converter.convert()` calls. It can live inside `DoclingAdapter` or in `app.state`.
   - What's unclear: Whether Docling v2.76.0 has improved thread safety to the point where the lock is unnecessary for Phase 1 (single-user).
   - Recommendation: Keep the lock inside `DoclingAdapter` — it's hidden from callers and correct regardless of thread safety improvements. Validate during implementation.

3. **`{"error": ...}` vs `{"detail": ...}` for FastAPI validation errors (422)**
   - What we know: Custom `HTTPException` handler covers our manual `raise HTTPException(...)` calls.
   - What's unclear: FastAPI's automatic request validation errors (422 Unprocessable Entity) use a different handler (`RequestValidationError`).
   - Recommendation: Also register `@app.exception_handler(RequestValidationError)` to return `{"error": "..."}` format consistently.

---

## Sources

### Primary (HIGH confidence)
- [Official Docling Dockerfile (main branch)](https://github.com/docling-project/docling/blob/main/Dockerfile) — base image, apt packages, model download command, env vars
- [FastAPI Lifespan Events docs](https://fastapi.tiangolo.com/advanced/events/) — `asynccontextmanager` pattern, `app.state` usage
- [FastAPI Request Files docs](https://fastapi.tiangolo.com/tutorial/request-files/) — `UploadFile`, `python-multipart` requirement, async read methods
- [Docling Installation docs](https://docling-project.github.io/docling/getting_started/installation/) — Python version requirements, Tesseract instructions
- [Docling FAQ](https://docling-project.github.io/docling/faq/) — `libGL.so.1` fix, air-gapped model usage

### Secondary (MEDIUM confidence)
- [Docling GitHub issue #2229](https://github.com/docling-project/docling/issues/2229) — `asyncio.to_thread` pattern for FastAPI integration, thread safety assessment
- [FastAPI file size discussion #8167](https://github.com/fastapi/fastapi/discussions/8167) — chunk-based size limit enforcement pattern
- [Shekhar Gulati: Reducing Docling Docker image size (2025-02-05)](https://shekhargulati.com/2025/02/05/reducing-size-of-docling-pytorch-docker-image/) — CPU PyTorch optimization, `python:3.12-slim` base

### Tertiary (LOW confidence)
- [deepwiki: Docling Docker Deployment](https://deepwiki.com/docling-project/docling/10.1-docker-deployment) — supplementary context, not authoritative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from official Docling v2.76.0 repository and FastAPI docs
- Architecture: HIGH — lifespan pattern from official FastAPI docs; Docling async wrapping from GitHub issue discussion
- Pitfalls: HIGH — libGL and model download issues verified from official Dockerfile and FAQ; thread safety from STATE.md + GitHub issues
- Docker details: HIGH — base image, apt packages, model download command from official Dockerfile (verified 2026-03-02)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (Docling is actively developed — recheck model download command if version bumps past 2.76.0)
