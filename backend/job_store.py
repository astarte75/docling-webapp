import asyncio
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Job:
    job_id: str
    tmp_path: str
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    status: str = "queued"


async def conversion_worker(state) -> None:
    """Background worker that processes jobs FIFO from state.dispatch_queue.

    Runs forever until cancelled. Always pushes a terminal event (completed or failed)
    so SSE streams never hang. Deletes the temp file in the finally block.
    """
    while True:
        job_id = await state.dispatch_queue.get()
        job: Job = state.jobs[job_id]

        try:
            job.status = "converting"
            await job.events.put({"type": "started", "message": "Conversion started"})

            markdown = await state.converter.convert_file(job.tmp_path)

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
