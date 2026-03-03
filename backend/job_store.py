import asyncio
import logging
import os
from dataclasses import dataclass, field

from adapter import ConversionOptions
from config import MAX_CONCURRENT_JOBS

logger = logging.getLogger(__name__)


@dataclass
class Job:
    """Represents a single conversion job in the system.

    options: per-job conversion settings (OCR mode, table detection, page range, languages)
    events: queue of SSE event dicts pushed by the worker, consumed by the stream endpoint
    status: queued → converting → completed | failed
    """

    job_id: str
    tmp_path: str
    options: ConversionOptions = field(default_factory=ConversionOptions)
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    status: str = "queued"


async def conversion_worker(state) -> None:
    """Background worker that processes conversion jobs from state.dispatch_queue.

    Uses asyncio.Semaphore(MAX_CONCURRENT_JOBS) to limit concurrent Docling calls.
    Spawns each job as a fire-and-forget asyncio.create_task — the semaphore inside
    process_job ensures at most MAX_CONCURRENT_JOBS conversions run simultaneously.

    The main loop is non-blocking: it reads job IDs and immediately spawns tasks.
    task_done() is called in process_job's finally block to maintain queue invariant.
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

    async def process_job(job_id: str) -> None:
        job = state.jobs[job_id]
        async with semaphore:
            try:
                job.status = "converting"
                await job.events.put({"type": "started", "message": "Conversion started"})

                markdown, ocr_engine_used, ocr_engine_requested = await state.converter.convert_file(job.tmp_path, job.options)

                job.status = "completed"
                event: dict = {"type": "completed", "markdown": markdown, "ocr_engine": ocr_engine_used}
                if ocr_engine_requested and ocr_engine_requested != ocr_engine_used:
                    event["ocr_engine_requested"] = ocr_engine_requested
                await job.events.put(event)

            except RuntimeError as exc:
                job.status = "failed"
                await job.events.put({"type": "failed", "message": str(exc), "ocr_engine": job.options.ocr_engine})

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
