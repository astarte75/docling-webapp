import asyncio
import logging

from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)


class DoclingAdapter:
    """Wraps DocumentConverter with async support and thread safety.

    Instantiated once at app startup via FastAPI lifespan. Never instantiated per request.
    Uses asyncio.Lock to serialize concurrent converter.convert() calls — the Docling
    PDF backend has shared internal state that can race under concurrent asyncio.to_thread calls.
    """

    def __init__(self) -> None:
        logger.info("Initializing DocumentConverter (model load may take a moment)...")
        self._converter = DocumentConverter()
        self._lock = asyncio.Lock()
        logger.info("DocumentConverter ready")

    async def convert_file(self, file_path: str) -> str:
        """Convert a file at file_path to Markdown. Non-blocking, thread-safe.

        Raises RuntimeError if Docling reports a non-success status.
        """
        async with self._lock:
            result = await asyncio.to_thread(self._converter.convert, file_path)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        return result.document.export_to_markdown()
