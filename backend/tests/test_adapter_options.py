"""Tests for ConversionOptions dataclass and build_pipeline_options function.

These tests verify that ConversionOptions maps correctly to PdfPipelineOptions
without actually running Docling (unit tests, no I/O).
"""
import pytest

from adapter import ConversionOptions, build_pipeline_options


class TestConversionOptionsDefaults:
    def test_default_ocr_mode(self):
        opts = ConversionOptions()
        assert opts.ocr_mode == "auto"

    def test_default_table_detection(self):
        opts = ConversionOptions()
        assert opts.table_detection is True

    def test_default_page_from(self):
        opts = ConversionOptions()
        assert opts.page_from is None

    def test_default_page_to(self):
        opts = ConversionOptions()
        assert opts.page_to is None

    def test_default_ocr_languages(self):
        opts = ConversionOptions()
        assert opts.ocr_languages == []


class TestBuildPipelineOptions:
    def test_ocr_mode_off_disables_ocr(self):
        opts = ConversionOptions(ocr_mode="off")
        pipeline = build_pipeline_options(opts)
        assert pipeline.do_ocr is False

    def test_ocr_mode_off_table_detection_true(self):
        opts = ConversionOptions(ocr_mode="off", table_detection=True)
        pipeline = build_pipeline_options(opts)
        assert pipeline.do_table_structure is True

    def test_ocr_mode_off_table_detection_false(self):
        opts = ConversionOptions(ocr_mode="off", table_detection=False)
        pipeline = build_pipeline_options(opts)
        assert pipeline.do_table_structure is False

    def test_ocr_mode_auto_enables_ocr(self):
        opts = ConversionOptions(ocr_mode="auto")
        pipeline = build_pipeline_options(opts)
        assert pipeline.do_ocr is True

    def test_ocr_mode_auto_not_force_full_page(self):
        opts = ConversionOptions(ocr_mode="auto")
        pipeline = build_pipeline_options(opts)
        # EasyOcrOptions should have force_full_page_ocr=False
        assert pipeline.ocr_options.force_full_page_ocr is False

    def test_ocr_mode_on_enables_ocr(self):
        opts = ConversionOptions(ocr_mode="on")
        pipeline = build_pipeline_options(opts)
        assert pipeline.do_ocr is True

    def test_ocr_mode_on_force_full_page(self):
        opts = ConversionOptions(ocr_mode="on")
        pipeline = build_pipeline_options(opts)
        assert pipeline.ocr_options.force_full_page_ocr is True

    def test_table_detection_false_propagates(self):
        opts = ConversionOptions(table_detection=False)
        pipeline = build_pipeline_options(opts)
        assert pipeline.do_table_structure is False

    def test_ocr_languages_set(self):
        opts = ConversionOptions(ocr_languages=["it", "en"])
        pipeline = build_pipeline_options(opts)
        assert pipeline.ocr_options.lang == ["it", "en"]

    def test_ocr_languages_empty_uses_default(self):
        opts = ConversionOptions(ocr_languages=[])
        pipeline = build_pipeline_options(opts)
        # When no languages specified, we don't set lang (uses Docling default)
        # The lang attribute should NOT be ["it", "en"] — just the default
        assert isinstance(pipeline.ocr_options.lang, list)


class TestDoclingAdapterSignature:
    """Verify convert_file accepts an optional opts parameter."""

    def test_convert_file_accepts_opts_param(self):
        import inspect
        from adapter import DoclingAdapter
        sig = inspect.signature(DoclingAdapter.convert_file)
        assert "opts" in sig.parameters

    def test_opts_has_default_none(self):
        import inspect
        from adapter import DoclingAdapter
        sig = inspect.signature(DoclingAdapter.convert_file)
        assert sig.parameters["opts"].default is None
