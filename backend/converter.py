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
    engine: str = "auto"             # "auto" | "vlm" | "standard"
    table_detection: bool = True
    page_from: Optional[int] = None  # 1-based inclusive
    page_to: Optional[int] = None    # 1-based inclusive, None = last page


# Minimum average chars per page to consider a PDF as having native text.
# Below this threshold, pages are likely scanned images.
_TEXT_THRESHOLD = 50
_SAMPLE_PAGES = 5


def _is_scanned_pdf(file_path: str) -> bool:
    """Check if a PDF is scanned (image-based) by sampling text from first pages.

    Returns True if the PDF has little or no extractable text (likely scanned).
    """
    try:
        import pypdfium2 as pdfium
        doc = pdfium.PdfDocument(file_path)
        num_pages = min(len(doc), _SAMPLE_PAGES)
        if num_pages == 0:
            doc.close()
            return True

        total_chars = 0
        for i in range(num_pages):
            page = doc[i]
            textpage = page.get_textpage()
            text = textpage.get_text_bounded().strip()
            total_chars += len(text)
            textpage.close()
            page.close()
        doc.close()

        avg_chars = total_chars / num_pages
        is_scanned = avg_chars < _TEXT_THRESHOLD
        logger.info(
            "PDF scan check: %d sample pages, avg %.0f chars/page → %s",
            num_pages, avg_chars, "scanned" if is_scanned else "native text",
        )
        return is_scanned
    except Exception as e:
        logger.warning("PDF scan check failed (%s), defaulting to standard", e)
        return False


def resolve_engine(extension: str, requested: str, file_path: str | None = None) -> str:
    """Determine actual engine based on file extension, user request, and PDF content.

    - Non-PDF files always use standard parser.
    - "vlm" or "standard" explicit requests are honored for PDFs.
    - "auto" inspects the PDF: scanned → vlm, native text → standard.
    """
    if extension.lower() in _NON_PDF_EXTENSIONS:
        return "standard"
    if requested == "auto" and file_path is not None:
        return "vlm" if _is_scanned_pdf(file_path) else "standard"
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
