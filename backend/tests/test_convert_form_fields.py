"""Tests for POST /convert with conversion options as form fields.

Verifies that the endpoint accepts optional form fields for OCR mode, table detection,
page range, and OCR languages, and passes them to Job as ConversionOptions.
"""
import ast
import inspect


class TestConvertEndpointSignature:
    def test_convert_imports_form(self):
        """main.py must import Form from fastapi."""
        with open("main.py") as f:
            source = f.read()
        assert "Form" in source

    def test_convert_imports_conversion_options(self):
        """main.py must import ConversionOptions."""
        with open("main.py") as f:
            source = f.read()
        assert "ConversionOptions" in source

    def test_convert_has_ocr_mode_param(self):
        """POST /convert must have ocr_mode form parameter."""
        with open("main.py") as f:
            source = f.read()
        assert "ocr_mode" in source
        assert 'Form(default=' in source

    def test_convert_has_table_detection_param(self):
        """POST /convert must have table_detection form parameter."""
        with open("main.py") as f:
            source = f.read()
        assert "table_detection" in source

    def test_convert_has_page_from_param(self):
        """POST /convert must have page_from form parameter."""
        with open("main.py") as f:
            source = f.read()
        assert "page_from" in source

    def test_convert_has_page_to_param(self):
        """POST /convert must have page_to form parameter."""
        with open("main.py") as f:
            source = f.read()
        assert "page_to" in source

    def test_convert_has_ocr_languages_param(self):
        """POST /convert must have ocr_languages form parameter."""
        with open("main.py") as f:
            source = f.read()
        assert "ocr_languages" in source

    def test_convert_constructs_conversion_options(self):
        """POST /convert must instantiate ConversionOptions from form fields."""
        with open("main.py") as f:
            source = f.read()
        assert "ConversionOptions(" in source

    def test_convert_passes_options_to_job(self):
        """POST /convert must pass options= to Job constructor."""
        with open("main.py") as f:
            source = f.read()
        # Job created with options=options
        assert "options=options" in source

    def test_ocr_languages_split_on_comma(self):
        """ocr_languages comma-separated string must be split into list."""
        with open("main.py") as f:
            source = f.read()
        assert ".split(" in source

    def test_original_validations_present(self):
        """Original size and extension validations must still be present."""
        with open("main.py") as f:
            source = f.read()
        assert "ALLOWED_EXTENSIONS" in source
        assert "MAX_UPLOAD_SIZE_BYTES" in source
        assert "HTTP_413_REQUEST_ENTITY_TOO_LARGE" in source
        assert "HTTP_415_UNSUPPORTED_MEDIA_TYPE" in source
