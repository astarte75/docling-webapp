import asyncio
import logging
from dataclasses import dataclass
from typing import Callable, Optional

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import VlmConvertOptions, VlmPipelineOptions
from docling.datamodel.vlm_engine_options import MlxVlmEngineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.vlm_pipeline import VlmPipeline

logger = logging.getLogger(__name__)

# Extensions that only support standard parsing (no VLM)
_NON_PDF_EXTENSIONS = {".docx", ".pptx", ".xlsx", ".html", ".htm", ".md"}

# Minimum average chars per page to consider a PDF as having native text.
_TEXT_THRESHOLD = 50
_SAMPLE_PAGES = 5

# Progress callback type: (message: str) -> None
ProgressCallback = Optional[Callable[[str], None]]


@dataclass
class ConversionOptions:
    """Per-job conversion options passed from the API endpoint to the worker."""
    engine: str = "auto"             # "auto" | "vlm" | "standard"
    table_detection: bool = True
    page_from: Optional[int] = None  # 1-based inclusive
    page_to: Optional[int] = None    # 1-based inclusive, None = last page


def get_pdf_page_count(file_path: str) -> int:
    """Return the total number of pages in a PDF."""
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(file_path)
    count = len(doc)
    doc.close()
    return count


def _is_scanned_pdf(file_path: str, on_progress: ProgressCallback = None) -> bool:
    """Check if a PDF is scanned (image-based) by sampling text from first pages.

    Returns True if the PDF has little or no extractable text (likely scanned).
    """
    try:
        import pypdfium2 as pdfium
        doc = pdfium.PdfDocument(file_path)
        total_pages = len(doc)
        num_sample = min(total_pages, _SAMPLE_PAGES)
        if num_sample == 0:
            doc.close()
            return True

        if on_progress:
            on_progress(f"Analyzing PDF ({total_pages} pages): sampling text...")

        total_chars = 0
        for i in range(num_sample):
            if on_progress:
                on_progress(f"Analyzing page {i + 1}/{num_sample}...")
            page = doc[i]
            textpage = page.get_textpage()
            text = textpage.get_text_bounded().strip()
            total_chars += len(text)
            textpage.close()
            page.close()
        doc.close()

        avg_chars = total_chars / num_sample
        is_scanned = avg_chars < _TEXT_THRESHOLD

        verdict = "scanned (image-based)" if is_scanned else "native text"
        engine_choice = "VLM/MLX" if is_scanned else "Standard (fast)"
        if on_progress:
            on_progress(f"PDF detected as {verdict} → using {engine_choice}")

        logger.info(
            "PDF scan check: %d/%d pages sampled, avg %.0f chars/page → %s",
            num_sample, total_pages, avg_chars, verdict,
        )
        return is_scanned
    except Exception as e:
        logger.warning("PDF scan check failed (%s), defaulting to standard", e)
        if on_progress:
            on_progress("Detection failed, using Standard pipeline")
        return False


def resolve_engine(
    extension: str,
    requested: str,
    file_path: str | None = None,
    on_progress: ProgressCallback = None,
) -> str:
    """Determine actual engine based on file extension, user request, and PDF content."""
    if extension.lower() in _NON_PDF_EXTENSIONS:
        return "standard"
    if requested == "auto" and file_path is not None:
        return "vlm" if _is_scanned_pdf(file_path, on_progress) else "standard"
    return requested if requested in ("vlm", "standard") else "standard"


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

    async def convert(
        self, file_path: str, opts: ConversionOptions, on_progress: ProgressCallback = None,
    ) -> str:
        """Convert a PDF file to Markdown using VLM/MLX pipeline."""
        total_pages = get_pdf_page_count(file_path)
        if on_progress:
            on_progress(f"Converting with VLM/MLX ({total_pages} pages)...")

        # Capture Docling per-page logs for progress
        page_counter = {"current": 0, "total": total_pages}

        class _PageProgressHandler(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                msg = record.getMessage()
                if "page" in msg.lower() and on_progress:
                    page_counter["current"] += 1
                    p = min(page_counter["current"], total_pages)
                    on_progress(f"VLM/MLX: page {p}/{total_pages}")

        handler = _PageProgressHandler()
        handler.setLevel(logging.INFO)
        docling_logger = logging.getLogger("docling")
        docling_logger.addHandler(handler)

        try:
            kwargs = {"source": file_path}
            if opts.page_from is not None:
                kwargs["page_range"] = (opts.page_from, opts.page_to or 99999)
            result = await asyncio.to_thread(self._converter.convert, **kwargs)
        finally:
            docling_logger.removeHandler(handler)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        return result.document.export_to_markdown()


class StandardConverter:
    """Fallback converter for non-PDF formats using Docling's default parsers."""

    def __init__(self) -> None:
        self._converter = DocumentConverter()
        logger.info("StandardConverter initialized")

    async def convert(
        self, file_path: str, opts: ConversionOptions, on_progress: ProgressCallback = None,
    ) -> str:
        """Convert a file to Markdown using Docling's standard pipeline."""
        total_pages = 0
        if on_progress:
            if file_path.lower().endswith(".pdf"):
                total_pages = get_pdf_page_count(file_path)
                on_progress(f"Converting with Standard pipeline ({total_pages} pages)...")
            else:
                on_progress("Converting...")

        # Capture per-page progress from Docling's pipeline profiling logs
        seen_pages: set[int] = set()

        class _PageProgressHandler(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                msg = record.getMessage()
                # Docling logs "Stage assemble: ... pages=[N]" when a page is done
                if "Stage assemble" in msg and "pages=[" in msg and on_progress and total_pages:
                    try:
                        page_num = int(msg.split("pages=[")[1].split("]")[0])
                        if page_num not in seen_pages:
                            seen_pages.add(page_num)
                            on_progress(f"Standard: page {len(seen_pages)}/{total_pages}")
                    except (IndexError, ValueError):
                        pass

        handler = _PageProgressHandler()
        handler.setLevel(logging.DEBUG)
        pipeline_logger = logging.getLogger("docling.pipeline.standard_pdf_pipeline")
        prev_level = pipeline_logger.level
        pipeline_logger.setLevel(logging.DEBUG)
        pipeline_logger.addHandler(handler)

        try:
            result = await asyncio.to_thread(self._converter.convert, source=file_path)
        finally:
            pipeline_logger.removeHandler(handler)
            pipeline_logger.setLevel(prev_level)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        return result.document.export_to_markdown()
