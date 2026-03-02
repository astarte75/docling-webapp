"""Tests for job_store.py — Job dataclass and conversion_worker coroutine."""
import asyncio
import inspect
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from job_store import Job, conversion_worker


# --- Job dataclass ---

def test_job_defaults():
    """Job has correct default values."""
    job = Job(job_id="abc123", tmp_path="/tmp/abc123.pdf")
    assert job.job_id == "abc123"
    assert job.tmp_path == "/tmp/abc123.pdf"
    assert job.status == "queued"
    assert isinstance(job.events, asyncio.Queue)


def test_job_events_are_independent():
    """Each Job gets its own Queue instance."""
    j1 = Job(job_id="a", tmp_path="/tmp/a.pdf")
    j2 = Job(job_id="b", tmp_path="/tmp/b.pdf")
    assert j1.events is not j2.events


def test_conversion_worker_is_coroutine():
    """conversion_worker must be an async coroutine function."""
    assert inspect.iscoroutinefunction(conversion_worker)


# --- conversion_worker integration tests ---

class FakeState:
    """Minimal app.state mock for testing the worker."""

    def __init__(self, converter):
        self.dispatch_queue = asyncio.Queue()
        self.jobs: dict = {}
        self.converter = converter


class SuccessConverter:
    async def convert_file(self, path: str) -> str:
        return "# Hello from Docling"


class RuntimeErrorConverter:
    async def convert_file(self, path: str) -> str:
        raise RuntimeError("PDF is corrupt")


class UnexpectedErrorConverter:
    async def convert_file(self, path: str) -> str:
        raise ValueError("unexpected boom")


@pytest.mark.asyncio
async def test_worker_success_events():
    """Worker pushes started + completed events on success."""
    # Create a real temp file so the worker can delete it
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        tmp_path = f.name

    state = FakeState(SuccessConverter())
    job = Job(job_id="j1", tmp_path=tmp_path)
    state.jobs["j1"] = job
    await state.dispatch_queue.put("j1")

    worker_task = asyncio.create_task(conversion_worker(state))
    await asyncio.wait_for(state.dispatch_queue.join(), timeout=5.0)
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    events = []
    while not job.events.empty():
        events.append(job.events.get_nowait())

    types = [e["type"] for e in events]
    assert "started" in types
    assert "completed" in types
    assert job.status == "completed"

    completed_evt = next(e for e in events if e["type"] == "completed")
    assert completed_evt["markdown"] == "# Hello from Docling"

    # Temp file must be deleted by worker
    assert not os.path.exists(tmp_path)


@pytest.mark.asyncio
async def test_worker_runtime_error_events():
    """Worker pushes started + failed events on RuntimeError."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        tmp_path = f.name

    state = FakeState(RuntimeErrorConverter())
    job = Job(job_id="j2", tmp_path=tmp_path)
    state.jobs["j2"] = job
    await state.dispatch_queue.put("j2")

    worker_task = asyncio.create_task(conversion_worker(state))
    await asyncio.wait_for(state.dispatch_queue.join(), timeout=5.0)
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    events = []
    while not job.events.empty():
        events.append(job.events.get_nowait())

    types = [e["type"] for e in events]
    assert "started" in types
    assert "failed" in types
    assert job.status == "failed"

    failed_evt = next(e for e in events if e["type"] == "failed")
    assert "PDF is corrupt" in failed_evt["message"]

    assert not os.path.exists(tmp_path)


@pytest.mark.asyncio
async def test_worker_unexpected_error_events():
    """Worker pushes failed event with generic message on unexpected exceptions."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        tmp_path = f.name

    state = FakeState(UnexpectedErrorConverter())
    job = Job(job_id="j3", tmp_path=tmp_path)
    state.jobs["j3"] = job
    await state.dispatch_queue.put("j3")

    worker_task = asyncio.create_task(conversion_worker(state))
    await asyncio.wait_for(state.dispatch_queue.join(), timeout=5.0)
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    events = []
    while not job.events.empty():
        events.append(job.events.get_nowait())

    types = [e["type"] for e in events]
    assert "failed" in types
    assert job.status == "failed"

    failed_evt = next(e for e in events if e["type"] == "failed")
    assert failed_evt["message"] == "Internal server error"

    assert not os.path.exists(tmp_path)


@pytest.mark.asyncio
async def test_worker_calls_task_done():
    """Worker calls task_done() so dispatch_queue.join() terminates."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        tmp_path = f.name

    state = FakeState(SuccessConverter())
    job = Job(job_id="j4", tmp_path=tmp_path)
    state.jobs["j4"] = job
    await state.dispatch_queue.put("j4")

    worker_task = asyncio.create_task(conversion_worker(state))
    # If task_done() is never called this will timeout and raise
    await asyncio.wait_for(state.dispatch_queue.join(), timeout=3.0)
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
