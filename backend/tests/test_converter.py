"""Tests for ConversionOptions and engine routing logic.

Unit tests only — no actual Docling model loading.
"""

import pytest
from backend.converter import ConversionOptions, resolve_engine


class TestConversionOptionsDefaults:
    def test_default_engine(self):
        opts = ConversionOptions()
        assert opts.engine == "auto"

    def test_default_table_detection(self):
        opts = ConversionOptions()
        assert opts.table_detection is True

    def test_default_page_range(self):
        opts = ConversionOptions()
        assert opts.page_from is None
        assert opts.page_to is None


class TestResolveEngine:
    def test_pdf_explicit_vlm(self):
        assert resolve_engine(".pdf", "vlm") == "vlm"

    def test_pdf_explicit_standard(self):
        assert resolve_engine(".pdf", "standard") == "standard"

    def test_docx_always_standard(self):
        assert resolve_engine(".docx", "vlm") == "standard"

    def test_pptx_always_standard(self):
        assert resolve_engine(".pptx", "standard") == "standard"

    def test_xlsx_always_standard(self):
        assert resolve_engine(".xlsx", "vlm") == "standard"

    def test_html_always_standard(self):
        assert resolve_engine(".html", "vlm") == "standard"

    def test_md_always_standard(self):
        assert resolve_engine(".md", "vlm") == "standard"

    def test_auto_without_file_defaults_to_standard(self):
        assert resolve_engine(".pdf", "auto") == "standard"

    def test_docx_auto_always_standard(self):
        assert resolve_engine(".docx", "auto") == "standard"
