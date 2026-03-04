import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Form, HTTPException, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional

from adapter import ConversionOptions, DoclingAdapter
from config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES
from job_store import Job, conversion_worker

# Configure logging: INFO to stdout, visible via `docker compose logs`
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize DoclingAdapter, job queue, and worker task."""
    logger.info("Starting up: initializing DoclingAdapter...")
    app.state.converter = DoclingAdapter()
    app.state.dispatch_queue = asyncio.Queue()
    app.state.jobs: dict[str, Job] = {}
    # Keep task reference — do not use fire-and-forget (GC would collect it)
    app.state._worker = asyncio.create_task(conversion_worker(app.state))
    logger.info("DoclingAdapter ready — application startup complete")
    yield
    # Graceful shutdown: cancel worker if it was started
    if app.state._worker is not None:
        app.state._worker.cancel()
        try:
            await app.state._worker
        except asyncio.CancelledError:
            pass
    logger.info("Shutting down")


app = FastAPI(title="Docling Webapp API", lifespan=lifespan)


# --- Custom exception handlers: always return {"error": "..."} ---
# FastAPI defaults to {"detail": "..."} — override to match locked contract

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


# --- Routes ---

@app.get("/health")
async def health() -> dict:
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.post("/convert")
async def convert(
    request: Request,
    file: UploadFile,
    ocr_mode: str = Form(default="auto"),
    ocr_engine: str = Form(default="auto"),  # "auto" | "easyocr" | "rapidocr" | "tesseract"
    table_detection: bool = Form(default=True),
    page_from: Optional[int] = Form(default=None),
    page_to: Optional[int] = Form(default=None),
    ocr_languages: Optional[str] = Form(default=None),  # comma-separated lang codes
) -> JSONResponse:
    """Accept a PDF upload and enqueue it for async conversion.

    Optional form fields for per-job conversion options:
        ocr_mode: "auto" (default) | "on" | "off"
        ocr_engine: "auto" (default) | "easyocr" | "rapidocr" | "tesseract"
        table_detection: bool (default True)
        page_from: 1-based start page (default: first page)
        page_to: 1-based end page (default: last page)
        ocr_languages: comma-separated EasyOCR language codes (e.g. "it,en")

    Returns:
        202: {"job_id": "<uuid>"} — job accepted, connect to SSE stream for progress
        413: {"error": "File exceeds 50MB limit"}
        415: {"error": "Unsupported file type. Accepted: PDF, DOCX, PPTX, XLSX, HTML, MD."}
    """
    # Validate file extension before reading content
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Accepted: PDF, DOCX, PPTX, XLSX, HTML, MD.",
        )

    # Read file in 1MB chunks, enforcing size limit BEFORE writing to disk
    chunks: list[bytes] = []
    total_bytes = 0
    while chunk := await file.read(1024 * 1024):
        total_bytes += len(chunk)
        if total_bytes > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds 50MB limit",
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # Write to temp file — worker is responsible for deletion (not this handler)
    job_id = str(uuid.uuid4())
    tmp_path = f"/tmp/{job_id}.pdf"
    with open(tmp_path, "wb") as f:
        f.write(content)

    # Build per-job conversion options from form fields
    options = ConversionOptions(
        ocr_mode=ocr_mode,
        ocr_engine=ocr_engine,
        table_detection=table_detection,
        page_from=page_from,
        page_to=page_to,
        ocr_languages=ocr_languages.split(",") if ocr_languages else [],
    )

    # Register job and enqueue
    job = Job(job_id=job_id, tmp_path=tmp_path, options=options)
    request.app.state.jobs[job_id] = job
    await request.app.state.dispatch_queue.put(job_id)

    logger.info("Job %s queued (%d bytes, %s) ocr_engine=%s", job_id, total_bytes, filename, ocr_engine)
    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"job_id": job_id})


async def _job_event_generator(job):
    """Async generator that yields SSE-formatted strings from a job's event queue.

    Reads from job.events until a terminal event (completed/failed) is received,
    then exits. The worker guarantees a terminal event is always pushed.
    """
    while True:
        event_data: dict = await job.events.get()
        event_type = event_data["type"]
        yield f"event: {event_type}\ndata: {json.dumps(event_data)}\n\n"
        if event_type in ("completed", "failed"):
            break


@app.get("/jobs/{job_id}/stream", response_model=None)
async def stream_job(job_id: str, request: Request):
    """Stream SSE progress events for a conversion job.

    Events: started -> (converting) -> completed | failed
    The terminal event (completed/failed) closes the stream.
    Returns 404 if job_id is unknown.
    """
    jobs = request.app.state.jobs
    if job_id not in jobs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    job = jobs[job_id]
    return StreamingResponse(_job_event_generator(job), media_type="text/event-stream")
