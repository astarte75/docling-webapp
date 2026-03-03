import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from docling.datamodel.pipeline_options import (
    OcrAutoOptions,
    EasyOcrOptions,
    RapidOcrOptions,
    TesseractOcrOptions,
    PdfPipelineOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

logger = logging.getLogger(__name__)


@dataclass
class ConversionOptions:
    """Per-job conversion options passed from the API endpoint to the worker.

    ocr_mode: "auto" (default) | "on" (force full page) | "off"
    ocr_engine: "auto" (default) | "easyocr" | "rapidocr" | "tesseract"
    table_detection: whether to detect table structure (default True)
    page_from: 1-based inclusive start page (None = first)
    page_to: 1-based inclusive end page (None = last)
    ocr_languages: list of EasyOCR language codes (empty = Docling default, only used for easyocr)
    """

    ocr_mode: str = "auto"           # "auto" | "on" | "off"
    ocr_engine: str = "auto"         # "auto" | "easyocr" | "rapidocr" | "tesseract"
    table_detection: bool = True
    page_from: Optional[int] = None  # 1-based inclusive
    page_to: Optional[int] = None    # 1-based inclusive, None = last page
    ocr_languages: list[str] = field(default_factory=list)  # EasyOCR lang codes only


# Maps engine name to the corresponding Docling OcrOptions class
_OCR_ENGINE_CLASSES = {
    "auto":      OcrAutoOptions,
    "easyocr":   EasyOcrOptions,
    "rapidocr":  RapidOcrOptions,
    "tesseract": TesseractOcrOptions,
}

# Install hints shown when engine package is not available
_ENGINE_INSTALL_HINTS = {
    "rapidocr":  "pip install rapidocr-onnxruntime",
    "tesseract": "apt-get install tesseract-ocr libtesseract-dev libleptonica-dev && pip install tesserocr",
}


def build_pipeline_options(opts: ConversionOptions) -> PdfPipelineOptions:
    """Build PdfPipelineOptions from ConversionOptions.

    Maps ocr_mode → do_ocr / force_full_page_ocr.
    Maps ocr_engine → the correct OcrOptions class via _OCR_ENGINE_CLASSES.
    Maps table_detection → do_table_structure.
    Maps ocr_languages → EasyOcrOptions.lang (only when engine is easyocr and non-empty).
    """
    if opts.ocr_mode == "off":
        return PdfPipelineOptions(
            do_ocr=False,
            do_table_structure=opts.table_detection,
        )

    # "auto" or "on"
    force_full_page_ocr = opts.ocr_mode == "on"

    engine_cls = _OCR_ENGINE_CLASSES.get(opts.ocr_engine)
    if engine_cls is None:
        raise ValueError(
            f"Unknown OCR engine: '{opts.ocr_engine}'. "
            f"Valid values: {list(_OCR_ENGINE_CLASSES.keys())}"
        )

    ocr_options = engine_cls(force_full_page_ocr=force_full_page_ocr)

    # Only EasyOCR supports the lang parameter — other engines use different language formats
    if opts.ocr_engine == "easyocr" and opts.ocr_languages:
        ocr_options.lang = opts.ocr_languages

    return PdfPipelineOptions(
        do_ocr=True,
        do_table_structure=opts.table_detection,
        ocr_options=ocr_options,
    )


class DoclingAdapter:
    """Wraps DocumentConverter with async support and thread safety.

    Instantiated once at app startup via FastAPI lifespan.
    Creates a new DocumentConverter per request to support per-job pipeline options
    (Docling bundles PipelineOptions at construction time, not at convert time).
    Uses asyncio.Lock to cover both creation and conversion — prevents race conditions
    under concurrent asyncio.to_thread calls.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        logger.info("DoclingAdapter initialized (per-request DocumentConverter mode)")

    async def convert_file(self, file_path: str, opts: Optional[ConversionOptions] = None) -> str:
        """Convert a file at file_path to Markdown using per-job options.

        Creates a DocumentConverter with the job's pipeline options.
        Non-blocking (asyncio.to_thread), thread-safe (asyncio.Lock covers creation+conversion).

        Raises RuntimeError if the OCR engine package is not installed.
        Raises RuntimeError if Docling reports a non-success status.
        """
        if opts is None:
            opts = ConversionOptions()

        pipeline_options = build_pipeline_options(opts)

        try:
            converter = DocumentConverter(
                format_options={"application/pdf": PdfFormatOption(pipeline_options=pipeline_options)}
            )
        except Exception as exc:
            hint = _ENGINE_INSTALL_HINTS.get(opts.ocr_engine, "the required OCR package")
            raise RuntimeError(
                f"OCR engine '{opts.ocr_engine}' is not available. Install: {hint}"
            ) from exc

        async with self._lock:
            if opts.page_from is not None:
                page_range = (opts.page_from, opts.page_to or 99999)
                result = await asyncio.to_thread(converter.convert, file_path, page_range=page_range)
            else:
                result = await asyncio.to_thread(converter.convert, file_path)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        return result.document.export_to_markdown()
