import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from docling.datamodel.pipeline_options import (
    OcrAutoOptions,
    EasyOcrOptions,
    RapidOcrOptions,
    TesseractCliOcrOptions,
    PdfPipelineOptions,
)
from docling.datamodel.document import InputFormat
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
    ocr_languages: list[str] = field(default_factory=list)  # 2-letter ISO codes (en, it, fr…)


# Maps engine name to the corresponding Docling OcrOptions class
_OCR_ENGINE_CLASSES = {
    "auto":      OcrAutoOptions,
    "easyocr":   EasyOcrOptions,
    "rapidocr":  RapidOcrOptions,
    "tesseract": TesseractCliOcrOptions,
}

# Maps 2-letter UI language codes (EasyOCR/ISO-639-1) to Tesseract ISO-639-2 codes
_EASYOCR_TO_TESSERACT_LANG = {
    "en": "eng", "it": "ita", "fr": "fra", "de": "deu", "es": "spa",
    "pt": "por", "nl": "nld", "pl": "pol", "ru": "rus", "ar": "ara",
    "hi": "hin", "tr": "tur", "ja": "jpn", "ko": "kor",
    "zh": "chi_sim",
}

# Tesseract default languages — covers the most common European languages installed in the image
_TESSERACT_DEFAULT_LANGS = ["eng", "ita", "fra", "deu", "spa"]

# Install hints shown when engine package is not available
_ENGINE_INSTALL_HINTS = {
    "rapidocr":  "pip install rapidocr-onnxruntime",
    "tesseract": "apt-get install tesseract-ocr",
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

    if opts.ocr_engine == "easyocr" and opts.ocr_languages:
        ocr_options.lang = opts.ocr_languages
    elif opts.ocr_engine == "tesseract":
        if opts.ocr_languages:
            # Map UI 2-letter codes to Tesseract 3-letter codes; skip unknown codes
            tess_langs = [_EASYOCR_TO_TESSERACT_LANG[c] for c in opts.ocr_languages if c in _EASYOCR_TO_TESSERACT_LANG]
            ocr_options.lang = tess_langs or _TESSERACT_DEFAULT_LANGS
        else:
            ocr_options.lang = _TESSERACT_DEFAULT_LANGS

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

    async def convert_file(self, file_path: str, opts: Optional[ConversionOptions] = None) -> tuple[str, str]:
        """Convert a file at file_path to Markdown using per-job options.

        Returns (markdown, ocr_engine_used) where ocr_engine_used is the engine
        actually selected by Docling (relevant when opts.ocr_engine == "auto").

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
                format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
            )
        except Exception as exc:
            hint = _ENGINE_INSTALL_HINTS.get(opts.ocr_engine, "the required OCR package")
            raise RuntimeError(
                f"OCR engine '{opts.ocr_engine}' is not available. Install: {hint}"
            ) from exc

        # Determine the actual engine used:
        # - explicit engines: verified by successful construction above (Docling raises ImportError otherwise)
        # - "auto": Docling logs "Auto OCR model selected <engine> with <backend>" at INFO level;
        #   capture it to report the real choice instead of "auto".
        confirmed_engine: list[str] = [opts.ocr_engine] if opts.ocr_engine != "auto" else []

        class _AutoEngineCapture(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                msg = record.getMessage()
                if msg.startswith("Auto OCR model selected "):
                    # Docling selected an engine via Auto — overrides the requested engine
                    # (fires even on explicit engine requests if the package is unavailable)
                    confirmed_engine.clear()
                    confirmed_engine.append(msg.split()[4])

        capture_handler = _AutoEngineCapture()
        logging.getLogger("docling.models.stages.ocr.auto_ocr_model").addHandler(capture_handler)

        try:
            async with self._lock:
                if opts.page_from is not None:
                    page_range = (opts.page_from, opts.page_to or 99999)
                    result = await asyncio.to_thread(converter.convert, file_path, page_range=page_range)
                else:
                    result = await asyncio.to_thread(converter.convert, file_path)
        finally:
            logging.getLogger("docling.models.stages.ocr.auto_ocr_model").removeHandler(capture_handler)

        if result.status.value != "success":
            raise RuntimeError(f"Docling conversion status: {result.status}")

        engine_used = confirmed_engine[0] if confirmed_engine else opts.ocr_engine
        # requested_engine is None when "auto" — no fallback concept applies
        requested_engine = opts.ocr_engine if opts.ocr_engine != "auto" else None
        return result.document.export_to_markdown(), engine_used, requested_engine
