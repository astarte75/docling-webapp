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
