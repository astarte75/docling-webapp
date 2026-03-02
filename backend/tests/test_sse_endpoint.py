"""Tests for GET /jobs/{job_id}/stream SSE endpoint in main.py."""
import asyncio
import json
import os
import sys
import types
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from job_store import Job


# ---------------------------------------------------------------------------
# Stub heavy/missing dependencies before importing main
# ---------------------------------------------------------------------------

# Stub docling (not installed locally — only in Docker)
_docling_stub = types.ModuleType("docling")
_docling_document_converter = types.ModuleType("docling.document_converter")
_docling_document_converter.DocumentConverter = MagicMock()
sys.modules.setdefault("docling", _docling_stub)
sys.modules.setdefault("docling.document_converter", _docling_document_converter)

# Stub adapter module
_adapter_stub = types.ModuleType("adapter")
_adapter_stub.DoclingAdapter = MagicMock()
sys.modules["adapter"] = _adapter_stub

# Stub fastapi.sse if not available (FastAPI < 0.135 environments like local dev)
_NATIVE_SSE_AVAILABLE = False
try:
    from fastapi.sse import EventSourceResponse, ServerSentEvent  # noqa: F401
    _NATIVE_SSE_AVAILABLE = True
except ImportError:
    # Use sse_starlette as compatibility shim for local environments
    from sse_starlette.sse import EventSourceResponse, ServerSentEvent  # noqa: F401
    _sse_module = types.ModuleType("fastapi.sse")
    _sse_module.EventSourceResponse = EventSourceResponse
    _sse_module.ServerSentEvent = ServerSentEvent
    sys.modules["fastapi.sse"] = _sse_module

import main  # noqa: E402  (must come after stubs)
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _inject_state(jobs: dict | None = None) -> None:
    """Inject a clean fake state into app without triggering real lifespan."""
    main.app.state.jobs = jobs if jobs is not None else {}
    main.app.state.dispatch_queue = asyncio.Queue()
    main.app.state._worker = None
    main.app.state.converter = None


# ---------------------------------------------------------------------------
# Tests — structural / source inspection (run everywhere)
# ---------------------------------------------------------------------------

def test_stream_route_is_registered():
    """GET /jobs/{job_id}/stream must be registered as an app route."""
    routes = {r.path for r in main.app.routes}
    assert "/jobs/{job_id}/stream" in routes, (
        f"SSE route not found. Registered routes: {sorted(routes)}"
    )


def test_stream_imports_present():
    """main.py must import EventSourceResponse, ServerSentEvent, and use json.dumps."""
    import inspect
    src = inspect.getsource(main)
    assert "EventSourceResponse" in src, "Missing EventSourceResponse import"
    assert "ServerSentEvent" in src, "Missing ServerSentEvent import"
    assert "json.dumps" in src, "Must use json.dumps for event data serialization"


def test_stream_terminal_break_logic():
    """Generator must break on completed or failed events."""
    import inspect
    src = inspect.getsource(main)
    assert "completed" in src, "Missing 'completed' terminal type check"
    assert "failed" in src, "Missing 'failed' terminal type check"
    assert "break" in src, "Missing break statement for terminal event"


# ---------------------------------------------------------------------------
# Tests — HTTP behaviour
# Require FastAPI >= 0.135 (native SSE support) to work correctly.
# In Docker these always run; locally they are skipped on older FastAPI.
# ---------------------------------------------------------------------------

_requires_native_sse = pytest.mark.skipif(
    not _NATIVE_SSE_AVAILABLE,
    reason="FastAPI native SSE (fastapi.sse) requires >= 0.135 — skipped in local env",
)


@_requires_native_sse
def test_stream_unknown_job_returns_404():
    """GET /jobs/{unknown_id}/stream returns 404 with {"error": "Job not found"}."""
    with TestClient(main.app, raise_server_exceptions=True) as client:
        _inject_state(jobs={})
        response = client.get("/jobs/nonexistent-id/stream")
    assert response.status_code == 404
    assert response.json() == {"error": "Job not found"}


@_requires_native_sse
def test_stream_completed_job_delivers_events_and_closes():
    """SSE stream yields started + completed events and the connection closes."""
    job_id = "stream-test-job"
    job = Job(job_id=job_id, tmp_path=f"/tmp/{job_id}.pdf")

    # Pre-populate events synchronously
    loop = asyncio.new_event_loop()
    loop.run_until_complete(job.events.put({"type": "started", "message": "Conversion started"}))
    loop.run_until_complete(job.events.put({"type": "completed", "markdown": "# Hello"}))
    loop.close()

    with TestClient(main.app, raise_server_exceptions=True) as client:
        _inject_state(jobs={job_id: job})
        response = client.get(
            f"/jobs/{job_id}/stream",
            headers={"Accept": "text/event-stream"},
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    data_lines = [
        line for line in response.text.splitlines()
        if line.startswith("data:")
    ]
    assert len(data_lines) == 2, f"Expected 2 data lines, got: {data_lines}"

    first = json.loads(data_lines[0].removeprefix("data:").strip())
    second = json.loads(data_lines[1].removeprefix("data:").strip())

    assert first["type"] == "started"
    assert second["type"] == "completed"
    assert second["markdown"] == "# Hello"


@_requires_native_sse
def test_stream_failed_job_delivers_events_and_closes():
    """SSE stream yields started + failed events and the connection closes."""
    job_id = "fail-test-job"
    job = Job(job_id=job_id, tmp_path=f"/tmp/{job_id}.pdf")

    loop = asyncio.new_event_loop()
    loop.run_until_complete(job.events.put({"type": "started", "message": "Conversion started"}))
    loop.run_until_complete(job.events.put({"type": "failed", "message": "PDF is corrupt"}))
    loop.close()

    with TestClient(main.app, raise_server_exceptions=True) as client:
        _inject_state(jobs={job_id: job})
        response = client.get(
            f"/jobs/{job_id}/stream",
            headers={"Accept": "text/event-stream"},
        )

    assert response.status_code == 200

    data_lines = [
        line for line in response.text.splitlines()
        if line.startswith("data:")
    ]
    assert len(data_lines) == 2, f"Expected 2 data lines, got: {data_lines}"

    last = json.loads(data_lines[-1].removeprefix("data:").strip())
    assert last["type"] == "failed"
    assert last["message"] == "PDF is corrupt"
