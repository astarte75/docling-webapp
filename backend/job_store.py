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

                markdown = await state.converter.convert_file(job.tmp_path, job.options)

                job.status = "completed"
                await job.events.put({"type": "completed", "markdown": markdown})

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
