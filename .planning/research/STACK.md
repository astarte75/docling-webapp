# Stack Research — Docling Webapp

**Research type**: Stack dimension
**Date**: 2026-03-02
**Status**: Complete
**Scope**: FastAPI + React + Vite webapp wrapping Docling for document-to-Markdown conversion

---

## Executive Summary

The standard 2025/2026 stack for a FastAPI + React + Vite webapp wrapping a Python ML/document processing library centers on:

- **FastAPI 0.115+** with async endpoints and background task offloading
- **Celery 5.4 + Redis 7** for durable async job processing (preferred over pure asyncio for ML workloads)
- **React 19 + Vite 6 + TanStack Query v5** for frontend state management
- **Uppy** or **react-dropzone** for file upload UI
- **Server-Sent Events (SSE)** or polling for job progress tracking
- **Docker Compose v2** with multi-service orchestration (api, worker, redis, frontend)

---

## 1. Backend Framework

### FastAPI 0.115.x
**Confidence: High**

FastAPI is the clear choice for wrapping Python ML libraries in 2025/2026. It provides:
- Native async/await support with Starlette underneath
- Automatic OpenAPI docs (critical for frontend integration)
- Python type hints → validation via Pydantic v2 (significant perf improvement over v1)
- `UploadFile` for streaming file uploads without loading into memory

**Version**: `fastapi>=0.115.0`
**Pydantic**: `pydantic>=2.7.0` (v2 required — v1 compatibility layer removed in FastAPI 0.100+)
**Uvicorn**: `uvicorn[standard]>=0.30.0` (with uvloop + httptools for performance)

**Why NOT Flask/Django**: FastAPI's async model maps directly to the "submit job, poll status" pattern. Django is too heavy; Flask lacks first-class async.

### python-multipart 0.0.18+
**Confidence: High**

Required by FastAPI for `UploadFile` — handles multipart form data. Must be installed explicitly.

---

## 2. Async Job Processing

### Decision: Celery 5.4 + Redis 7 (NOT pure asyncio)
**Confidence: High**

This is the most critical architectural decision. Two options:

**Option A: Celery + Redis** (RECOMMENDED)
**Option B: FastAPI BackgroundTasks + asyncio**

#### Why Celery wins for ML workloads

Docling processing is:
- CPU-intensive (OCR, layout detection, ML inference)
- Long-running (seconds to minutes per document)
- Blocking (cannot be made truly async without a process boundary)

`FastAPI.BackgroundTasks` runs in the same event loop — a blocking Docling call will freeze the entire API server. Celery workers run in separate processes, isolating the ML workload.

Additional benefits:
- **Durability**: tasks survive API restarts (stored in Redis)
- **Retry logic**: built-in `autoretry_for`, `max_retries`
- **Concurrency control**: `--concurrency` flag prevents OOM from parallel Docling instances
- **Task result backend**: native task state (PENDING → STARTED → SUCCESS/FAILURE)
- **Monitoring**: Flower dashboard for task visibility

**Versions**:
```
celery>=5.4.0
redis>=5.0.3        # Python client
# Redis server: 7.2 (Docker image redis:7.2-alpine)
```

**What NOT to use**:
- `asyncio.create_task()` for Docling — it's not I/O-bound, it's CPU-bound
- `concurrent.futures.ThreadPoolExecutor` — GIL limits true parallelism for CPU work
- `dramatiq` — less ecosystem maturity, harder Flower-equivalent monitoring
- `RQ (Redis Queue)` — simpler but lacks Celery's retry/chord/group primitives

#### Celery Configuration for ML workloads

```python
# celery_app.py
from celery import Celery

celery_app = Celery(
    "docling_worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/1",
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,          # enables STARTED state
    task_acks_late=True,              # ack after completion, not pickup
    worker_prefetch_multiplier=1,     # one task at a time per worker
    worker_max_tasks_per_child=50,    # recycle workers to prevent ML memory leaks
)
```

The `worker_max_tasks_per_child=50` is critical — ML libraries (torch, transformers) accumulate memory; recycling workers prevents OOM crashes.

---

## 3. File Upload Handling

### Backend: FastAPI UploadFile + aiofiles
**Confidence: High**

```python
from fastapi import UploadFile, File
import aiofiles

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # Stream to disk without loading into memory
    dest = Path(f"/tmp/uploads/{uuid4()}/{file.filename}")
    dest.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 64):  # 64KB chunks
            await f.write(chunk)

    task = process_document.delay(str(dest))
    return {"task_id": task.id}
```

**aiofiles**: `aiofiles>=23.2.1` — async file I/O to avoid blocking the event loop during upload

**File size limits**: Configure in Uvicorn/nginx, not FastAPI:
```python
# In FastAPI app
app = FastAPI()
# nginx: client_max_body_size 100M
# uvicorn: no native limit — rely on nginx upstream
```

**Storage strategy**:
- Local `/tmp/uploads/{task_id}/` for development
- Mount a Docker volume for production (same volume accessible to both API and worker containers)
- S3/MinIO for production scale-out (but over-engineering for v1)

### Frontend: react-dropzone 14.x
**Confidence: High**

Two solid choices in 2025/2026:

**react-dropzone 14.x** (RECOMMENDED for simplicity)
- Headless — full UI control
- Zero dependencies beyond React
- `onDrop` callback with `File[]` objects
- Works with native `fetch` / `axios` for upload

**Uppy 4.x** (alternative for complex requirements)
- Full-featured upload widget with plugins
- Resumable uploads via tus protocol
- Overkill for single-file document conversion

**Version**: `react-dropzone@14.3.x`

---

## 4. Progress Tracking

### Decision: Polling (NOT WebSockets, NOT SSE for v1)
**Confidence: Medium-High**

Three options analyzed:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Polling** | Simple, stateless, works everywhere | Latency = poll interval | Recommended v1 |
| **SSE** | Server push, HTTP/1.1 compatible | Requires persistent connection management | Good v2 option |
| **WebSockets** | Bidirectional, real-time | Complex state management, overkill | Not needed |

Polling implementation:
```python
# FastAPI endpoint
@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.state,          # PENDING | STARTED | SUCCESS | FAILURE
        "progress": result.info if result.state == "PROGRESS" else None,
        "result": result.result if result.state == "SUCCESS" else None,
    }
```

Custom progress updates from within Celery task:
```python
@celery_app.task(bind=True)
def process_document(self, file_path: str):
    self.update_state(state="PROGRESS", meta={"step": "loading", "percent": 10})
    # ... docling processing ...
    self.update_state(state="PROGRESS", meta={"step": "converting", "percent": 60})
```

Frontend polling with TanStack Query:
```typescript
const { data } = useQuery({
  queryKey: ["task", taskId],
  queryFn: () => fetchTaskStatus(taskId),
  refetchInterval: (data) =>
    data?.status === "SUCCESS" || data?.status === "FAILURE" ? false : 2000,
  enabled: !!taskId,
});
```

---

## 5. Frontend Stack

### React 19 + Vite 6
**Confidence: High**

- **React 19**: Stable as of Dec 2024. New `use()` hook, improved Server Components (not needed here, but ecosystem is on 19)
- **Vite 6**: Build tool. Faster HMR than webpack/CRA (dead). Rollup-based production builds.

**Versions**:
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "vite": "^6.0.0",
  "@vitejs/plugin-react": "^4.3.0"
}
```

**What NOT to use**:
- Create React App — abandoned, last release 2022
- Next.js — server-side rendering adds complexity not needed for a tool UI; SSR requires a Node server in Docker
- Remix — same issue, SSR overhead

### TanStack Query v5 (React Query)
**Confidence: High**

Essential for managing async server state (task status polling, result fetching). Replaces manual `useEffect` + `useState` fetch patterns.

**Version**: `@tanstack/react-query@^5.45.0`

Key features used:
- `refetchInterval` for polling
- Automatic background refetch
- Optimistic updates for upload progress
- `useMutation` for file upload with `onProgress`

### TypeScript 5.5+
**Confidence: High**

**Version**: `typescript@^5.5.0`
Non-negotiable for a codebase with complex async state. FastAPI auto-generates OpenAPI schema → can generate TypeScript types with `openapi-typescript`.

### UI Components: shadcn/ui (NOT a component library)
**Confidence: Medium-High**

shadcn/ui is the 2024/2025 standard for React UIs:
- Copy-paste components (not a dependency — source code in your repo)
- Built on Radix UI primitives (accessible)
- Tailwind CSS based
- Full control over styling

**Alternative**: Chakra UI v3, MUI v6 — heavier, more opinionated

**Tailwind CSS**: `tailwindcss@^3.4.0` (v4 in beta as of early 2026 — use v3 for stability)

---

## 6. Docling Integration Patterns

### Docling Version and Installation
**Confidence: High**

```
docling>=2.5.0
```

Docling 2.x is the stable series as of 2025. Key considerations:

**Model downloads**: Docling downloads ML models on first run (~1-2GB). In Docker:
```dockerfile
# Pre-download models at build time to avoid runtime latency
RUN python -c "from docling.document_converter import DocumentConverter; DocumentConverter()"
```

Or mount a model cache volume:
```yaml
# docker-compose.yml
worker:
  volumes:
    - docling_models:/root/.cache/docling
```

### Docling API Pattern

```python
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.document_converter import PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions

@celery_app.task(bind=True)
def process_document(self, file_path: str) -> dict:
    self.update_state(state="PROGRESS", meta={"step": "initializing", "percent": 5})

    # Configure pipeline options
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.do_table_structure = True

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    self.update_state(state="PROGRESS", meta={"step": "converting", "percent": 30})
    result = converter.convert(file_path)

    self.update_state(state="PROGRESS", meta={"step": "exporting", "percent": 90})
    markdown = result.document.export_to_markdown()

    return {"markdown": markdown, "pages": result.document.num_pages}
```

**Critical**: `DocumentConverter` initialization loads ML models — expensive. For high throughput, initialize once per worker process:

```python
# Worker-level initialization (runs once per Celery worker process)
_converter = None

def get_converter():
    global _converter
    if _converter is None:
        _converter = DocumentConverter()
    return _converter

@celery_app.task(bind=True)
def process_document(self, file_path: str) -> dict:
    converter = get_converter()
    # ...
```

### Supported Formats

Docling 2.x supports: PDF, DOCX, PPTX, XLSX, HTML, Markdown, AsciiDoc, CSV. The API should validate file types before queuing:

```python
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".md"}
```

---

## 7. Docker Compose Setup

### Service Architecture
**Confidence: High**

```
services:
├── api          (FastAPI + uvicorn)
├── worker       (Celery worker)
├── redis        (broker + result backend)
└── frontend     (Vite dev server OR nginx serving built assets)
```

**Key principle**: `api` and `worker` share the same Docker image (same codebase) — only the entrypoint differs. This avoids maintaining two separate Python environments.

### docker-compose.yml

```yaml
version: "3.9"

services:
  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      target: production
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    volumes:
      - uploads:/tmp/uploads
    ports:
      - "8000:8000"
    depends_on:
      redis:
        condition: service_healthy

  worker:
    build:
      context: ./backend
      target: production
    command: celery -A app.celery_app worker --loglevel=info --concurrency=2
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    volumes:
      - uploads:/tmp/uploads
      - docling_models:/root/.cache/docling
    depends_on:
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
    ports:
      - "5173:5173"  # Vite dev server
    # Production: nginx serving /dist instead

volumes:
  redis_data:
  uploads:
  docling_models:  # Cache ML models between restarts
```

**Why `--concurrency=2` for worker**: Docling loads large ML models per process. 2 concurrent workers × ~2GB RAM each = 4GB. Adjust based on available memory.

### Dockerfile (Backend — multi-stage)

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

# System dependencies for Docling (OCR, PDF processing)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS production
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Docling models at build time
RUN python -c "from docling.document_converter import DocumentConverter; DocumentConverter()"

COPY . .
```

**Python 3.12**: Docling supports 3.9-3.12. Use 3.12 for performance improvements (free-threaded builds coming in 3.13, but 3.12 is the stable choice for 2026).

---

## 8. API Design

### Endpoints

```
POST   /api/v1/convert          # Upload file, queue Celery task → returns task_id
GET    /api/v1/tasks/{task_id}  # Poll task status + result
DELETE /api/v1/tasks/{task_id}  # Cancel/cleanup task
GET    /api/v1/health           # Health check (used by Docker healthcheck)
```

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 9. Complete Dependency List

### Backend (requirements.txt)

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.7.0
python-multipart>=0.0.18
aiofiles>=23.2.1
celery>=5.4.0
redis>=5.0.3
docling>=2.5.0
```

### Frontend (package.json)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.45.0",
    "react-dropzone": "^14.3.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

---

## 10. What NOT to Use

| Technology | Reason to Avoid |
|------------|-----------------|
| FastAPI BackgroundTasks | Runs in API process — blocks event loop for CPU-bound ML work |
| asyncio for Docling | Docling is not async-friendly; no benefit, adds complexity |
| WebSockets for progress | Overkill; polling is sufficient for document conversion timescales |
| Next.js / Remix | SSR adds Docker complexity (Node server) with no benefit for a tool UI |
| PostgreSQL (for task state) | Redis is sufficient as task backend; SQL adds operational overhead |
| MinIO/S3 (v1) | Local volume sharing between containers is simpler for v1 |
| Uppy | Feature-rich but heavy for single-file conversion flow |
| RQ (Redis Queue) | Simpler API but less mature retry/monitoring ecosystem vs Celery |
| Tailwind v4 | Beta as of early 2026 — breaking changes risk |
| Python 3.13 | Free-threaded build is experimental; stick to 3.12 |

---

## 11. Confidence Summary

| Decision | Confidence | Notes |
|----------|------------|-------|
| FastAPI 0.115+ | High | Industry standard, no alternatives |
| Celery 5.4 + Redis | High | CPU-bound ML work requires process isolation |
| React 19 + Vite 6 | High | Current stable versions |
| TanStack Query v5 | High | De facto standard for server state |
| react-dropzone 14 | High | Most widely used, well-maintained |
| Polling for progress | Medium-High | Simple and sufficient; SSE is a good v2 upgrade |
| shadcn/ui + Tailwind 3 | Medium-High | Very popular; v4 Tailwind risk justifies pinning v3 |
| Docker Compose v2 | High | Standard for multi-service local dev |
| python-3.12 slim | High | Stable, performant, Docling compatible |
| Docling model pre-download | High | Essential for reasonable container startup time |

---

## Sources

Research based on:
- FastAPI official documentation (fastapi.tiangolo.com) — 0.115.x
- Celery documentation (docs.celeryq.dev) — 5.4.x
- Docling GitHub (github.com/DS4SD/docling) — 2.x series
- TanStack Query documentation — v5
- React release notes — v19 (December 2024)
- Vite changelog — v6 (November 2024)
- react-dropzone README — 14.x
