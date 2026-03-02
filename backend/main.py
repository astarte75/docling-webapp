import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from adapter import DoclingAdapter
from config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES

# Configure logging: INFO to stdout, visible via `docker compose logs`
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: create DoclingAdapter singleton at startup."""
    logger.info("Starting up: initializing DoclingAdapter...")
    app.state.converter = DoclingAdapter()
    logger.info("DoclingAdapter ready — application startup complete")
    yield
    # Shutdown cleanup
    logger.info("Shutting down")
    del app.state.converter


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
async def convert(request: Request, file: UploadFile) -> JSONResponse:
    """Convert an uploaded PDF to Markdown.

    Returns:
        200: {"markdown": "<converted content>"}
        413: {"error": "File exceeds 50MB limit"}
        415: {"error": "Unsupported file type. Only PDF accepted."}
        422: {"error": "<docling exception message>"}
        500: {"error": "Internal server error"}
    """
    # Validate file extension + Content-Type before reading content
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Only PDF accepted.",
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

    # Write to temp file, convert, clean up
    tmp_path = f"/tmp/{uuid.uuid4()}.pdf"
    logger.info("Converting file: %s (%d bytes) → %s", filename, total_bytes, tmp_path)

    try:
        with open(tmp_path, "wb") as f:
            f.write(content)

        converter: DoclingAdapter = request.app.state.converter
        markdown = await converter.convert_file(tmp_path)

        logger.info("Conversion complete: %s (%d chars output)", filename, len(markdown))
        return JSONResponse(content={"markdown": markdown})

    except HTTPException:
        raise

    except RuntimeError as exc:
        # Docling reported a non-success status
        logger.error("Docling conversion failed for %s: %s", filename, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    except Exception as exc:
        logger.exception("Unexpected error converting %s", filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )

    finally:
        # Always delete temp file — even on exception — to prevent data leakage
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            logger.info("Temp file deleted: %s", tmp_path)
