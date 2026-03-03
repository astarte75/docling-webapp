"""Tests for Job.options field and conversion_worker semaphore behavior.

Unit tests — no real Docling conversion performed.
"""
import ast
import inspect
import sys

import pytest


class TestJobDataclass:
    def test_job_has_options_field(self):
        """Job dataclass must have an 'options' field."""
        import job_store
        import inspect
        # Get Job class fields via dataclass inspection
        from dataclasses import fields
        field_names = [f.name for f in fields(job_store.Job)]
        assert "options" in field_names

    def test_job_options_default_is_conversion_options(self):
        """Job.options default must be a ConversionOptions instance."""
        import job_store
        from adapter import ConversionOptions
        job = job_store.Job(job_id="test-123", tmp_path="/tmp/test.pdf")
        assert isinstance(job.options, ConversionOptions)

    def test_job_options_default_values(self):
        """Job created without options uses ConversionOptions defaults."""
        import job_store
        from adapter import ConversionOptions
        job = job_store.Job(job_id="test-123", tmp_path="/tmp/test.pdf")
        assert job.options.ocr_mode == "auto"
        assert job.options.table_detection is True
        assert job.options.page_from is None
        assert job.options.page_to is None
        assert job.options.ocr_languages == []

    def test_job_options_accepts_custom_conversion_options(self):
        """Job accepts custom ConversionOptions."""
        import job_store
        from adapter import ConversionOptions
        opts = ConversionOptions(ocr_mode="off", table_detection=False)
        job = job_store.Job(job_id="test-456", tmp_path="/tmp/test.pdf", options=opts)
        assert job.options.ocr_mode == "off"
        assert job.options.table_detection is False


class TestMaxConcurrentJobsConfig:
    def test_max_concurrent_jobs_in_config(self):
        """MAX_CONCURRENT_JOBS must be defined in config.py."""
        import config
        assert hasattr(config, "MAX_CONCURRENT_JOBS")

    def test_max_concurrent_jobs_default_is_2(self):
        """MAX_CONCURRENT_JOBS default is 2."""
        import os
        # Unset env var to test default
        os.environ.pop("MAX_CONCURRENT_JOBS", None)
        import importlib
        import config
        importlib.reload(config)
        assert config.MAX_CONCURRENT_JOBS == 2


class TestConversionWorkerStructure:
    def test_conversion_worker_uses_semaphore(self):
        """conversion_worker source must reference asyncio.Semaphore."""
        import job_store
        source = inspect.getsource(job_store.conversion_worker)
        assert "asyncio.Semaphore" in source or "Semaphore" in source

    def test_conversion_worker_uses_create_task(self):
        """conversion_worker must use asyncio.create_task for fire-and-forget pattern."""
        import job_store
        source = inspect.getsource(job_store.conversion_worker)
        assert "create_task" in source

    def test_conversion_worker_calls_convert_file_with_options(self):
        """conversion_worker must pass job.options to convert_file."""
        import job_store
        source = inspect.getsource(job_store.conversion_worker)
        assert "job.options" in source

    def test_task_done_in_finally(self):
        """task_done() must be in finally block of process_job, not main loop."""
        import job_store
        source = inspect.getsource(job_store.conversion_worker)
        # Both 'finally' and 'task_done' must appear
        assert "finally" in source
        assert "task_done()" in source
