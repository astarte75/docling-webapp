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

from backend.converter import ConversionOptions, VlmConverter, StandardConverter
from backend.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES
from backend.job_store import Job, conversion_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: load VLM model eagerly, init job queue and worker."""
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


api = APIRouter(prefix="/api")


@api.get("/health")
async def health(request: Request) -> dict:
    """Health check — reports VLM model status."""
    return {"status": "ok", "vlm_loaded": request.app.state.vlm_loaded}


@api.post("/convert")
async def convert(
    request: Request,
    file: UploadFile,
    engine: str = Form(default="vlm"),
    table_detection: bool = Form(default=True),
    page_from: Optional[int] = Form(default=None),
    page_to: Optional[int] = Form(default=None),
) -> JSONResponse:
    """Accept a file upload and enqueue it for async conversion."""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Accepted: PDF, DOCX, PPTX, XLSX, HTML, MD.",
        )

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

    job_id = str(uuid.uuid4())
    tmp_path = f"/tmp/{job_id}{ext}"
    with open(tmp_path, "wb") as f:
        f.write(content)

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


app.include_router(api)

_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="static")
else:
    logger.warning("Frontend dist not found at %s — serving API only", _frontend_dist)
