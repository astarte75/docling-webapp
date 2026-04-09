import asyncio
import logging
import os
from dataclasses import dataclass, field

from backend.converter import ConversionOptions, resolve_engine
from backend.config import MAX_CONCURRENT_JOBS

logger = logging.getLogger(__name__)


@dataclass
class Job:
    """Represents a single conversion job."""
    job_id: str
    tmp_path: str
    extension: str                  # e.g. ".pdf", ".docx"
    options: ConversionOptions = field(default_factory=ConversionOptions)
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    status: str = "queued"


async def conversion_worker(state) -> None:
    """Background worker that processes conversion jobs from state.dispatch_queue.

    Routes PDF files to VlmConverter (MLX) and non-PDF to StandardConverter.
    Emits SSE progress events during detection and conversion.
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

    async def process_job(job_id: str) -> None:
        job = state.jobs[job_id]
        # Thread-safe progress emitter: schedules SSE event on the event loop
        loop = asyncio.get_event_loop()

        def emit_progress(message: str) -> None:
            loop.call_soon_threadsafe(
                job.events.put_nowait,
                {"type": "progress", "message": message},
            )

        async with semaphore:
            try:
                job.status = "converting"
                await job.events.put({"type": "started", "message": "Conversion started"})

                engine = resolve_engine(
                    job.extension, job.options.engine, job.tmp_path,
                    on_progress=emit_progress,
                )

                if engine == "vlm" and state.vlm is not None:
                    markdown = await state.vlm.convert(
                        job.tmp_path, job.options, on_progress=emit_progress,
                    )
                    engine_label = "vlm-mlx"
                elif engine == "vlm" and state.vlm is None:
                    raise RuntimeError("VLM engine not available — model failed to load at startup")
                else:
                    markdown = await state.standard.convert(
                        job.tmp_path, job.options, on_progress=emit_progress,
                    )
                    engine_label = "standard"

                job.status = "completed"
                await job.events.put({
                    "type": "completed",
                    "markdown": markdown,
                    "engine": engine_label,
                })

            except RuntimeError as exc:
                job.status = "failed"
                await job.events.put({"type": "failed", "message": str(exc)})

            except Exception:
                logger.exception("Unexpected error processing job %s", job_id)
                job.status = "failed"
                await job.events.put({"type": "failed", "message": "Internal server error"})

            finally:
                if os.path.exists(job.tmp_path):
                    os.remove(job.tmp_path)
                state.dispatch_queue.task_done()

    while True:
        job_id = await state.dispatch_queue.get()
        asyncio.create_task(process_job(job_id))
