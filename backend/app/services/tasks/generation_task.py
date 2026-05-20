"""
Celery tasks for async bid generation and parsing.

These tasks are consumed by the Celery worker process and operate synchronously
using a dedicated sync SQLAlchemy session factory.
"""

import asyncio
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.bid import Bid
from app.models.generation import GenerationTask

from .celery_app import celery_app

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sync session factory — Celery tasks cannot use the async session from
# app.core.database, so we create a dedicated sync engine here bound to
# DATABASE_URL_SYNC.
# ---------------------------------------------------------------------------

_sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    pool_size=settings.worker_concurrency if hasattr(settings, "worker_concurrency") else 4,
    max_overflow=2,
    pool_pre_ping=True,
)

SyncSession = sessionmaker(bind=_sync_engine, class_=Session, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    """Return current UTC datetime with timezone info."""
    return datetime.now(timezone.utc)


def _parse_uuid(value: str | uuid.UUID) -> uuid.UUID:
    """Coerce a string or UUID to a uuid.UUID instance."""
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(value)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, max_retries=1)
def generate_bid_task(self, bid_id: str, user_id: str) -> dict:
    """
    Main async generation task.

    1. Upsert GenerationTask record and set status to 'running'.
    2. Delegate to orchestrator.generate_all_sections(bid_id).
    3. Track progress via sections_done updates on the GenerationTask row.
    4. On success: set status to 'done', record completed_at.
    5. On failure: set status to 'error', store error_message.
    """
    bid_uuid = _parse_uuid(bid_id)
    user_uuid = _parse_uuid(user_id)

    with SyncSession() as db:
        task_record = _upsert_generation_task(db, bid_uuid, user_uuid)

        try:
            # --- Mark running -------------------------------------------------
            task_record.status = "running"
            task_record.started_at = _now()
            task_record.error_message = None
            db.commit()

            logger.info("Generation task started: task_id=%s bid_id=%s", task_record.id, bid_id)

            # --- Delegate to orchestrator ------------------------------------
            from app.services.orchestrator.orchestrator import BidOrchestrator
            orchestrator = BidOrchestrator()
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(orchestrator.generate_all_sections(str(bid_uuid)))
            finally:
                loop.close()

            # --- Mark done ---------------------------------------------------
            # Re-fetch in case the orchestrator updated total sections
            db.refresh(task_record)

            task_record.status = "done"
            task_record.completed_at = _now()
            task_record.sections_done = task_record.sections_total or 0
            db.commit()

            logger.info("Generation task completed: task_id=%s bid_id=%s", task_record.id, bid_id)

            return {
                "task_id": str(task_record.id),
                "status": "done",
                "sections_done": task_record.sections_done,
                "sections_total": task_record.sections_total,
            }

        except Exception as exc:
            logger.exception("Generation task failed: task_id=%s bid_id=%s", task_record.id, bid_id)

            db.rollback()

            # Re-query in a fresh session in case the failure left the
            # connection in a bad state.
            _mark_task_errored(bid_uuid, str(exc))

            # Do NOT re-raise — we have recorded the error; max_retries=1
            # provides one additional safety-net attempt if the error handler
            # itself crashes.
            return {
                "task_id": str(task_record.id),
                "status": "error",
                "error": str(exc),
            }

        finally:
            db.close()


@celery_app.task(bind=True, max_retries=1)
def parse_bid_task(self, bid_id: str, file_path: str) -> dict:
    """
    Async bid parsing task.

    1. Update Bid status to 'parsing'.
    2. Delegate to orchestrator.parse_bid_file(bid_id, file_path).
    3. On success: set status to 'parsed', then auto-trigger outline generation.
    4. On failure: set status to 'error'.
    """
    bid_uuid = _parse_uuid(bid_id)

    with SyncSession() as db:
        bid_record = db.query(Bid).filter(Bid.id == bid_uuid).first()

        if bid_record is None:
            logger.error("Bid not found: bid_id=%s", bid_id)
            return {"status": "error", "error": f"Bid {bid_id} not found"}

        try:
            # --- Mark parsing -------------------------------------------------
            bid_record.status = "parsing"
            db.commit()

            logger.info("Parse task started: bid_id=%s file=%s", bid_id, file_path)

            # --- Delegate to orchestrator ------------------------------------
            from app.services.orchestrator.orchestrator import BidOrchestrator
            orchestrator = BidOrchestrator()
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(orchestrator.parse_bid_file(str(bid_uuid), file_path))
            finally:
                loop.close()

            # --- Mark parsed -------------------------------------------------
            db.refresh(bid_record)
            bid_record.status = "parsed"
            db.commit()

            logger.info("Parse task completed: bid_id=%s", bid_id)

            # --- Auto-trigger outline generation -----------------------------
            # Chain to the next step asynchronously.  We pass the user_id
            # so the outline task knows who owns this bid.
            user_id_str = str(bid_record.user_id) if bid_record.user_id else ""
            if user_id_str:
                from app.services.orchestrator.orchestrator import BidOrchestrator
                orchestrator2 = BidOrchestrator()
                loop2 = asyncio.new_event_loop()
                try:
                    loop2.run_until_complete(orchestrator2.generate_outline(str(bid_uuid)))
                finally:
                    loop2.close()

            return {
                "bid_id": str(bid_uuid),
                "status": "parsed",
            }

        except Exception as exc:
            logger.exception("Parse task failed: bid_id=%s", bid_id)

            db.rollback()
            _mark_bid_errored(bid_uuid, str(exc))

            return {
                "bid_id": str(bid_uuid),
                "status": "error",
                "error": str(exc),
            }

        finally:
            db.close()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _upsert_generation_task(
    db: Session,
    bid_uuid: uuid.UUID,
    user_uuid: uuid.UUID,
) -> GenerationTask:
    """
    Retrieve an existing GenerationTask for *bid_uuid* or create one.
    Returns the (attached) ORM object.
    """
    task_record = (
        db.query(GenerationTask)
        .filter(GenerationTask.bid_id == bid_uuid)
        .first()
    )

    if task_record is None:
        task_record = GenerationTask(
            id=uuid.uuid4(),
            bid_id=bid_uuid,
            user_id=user_uuid,
            status="pending",
            sections_done=0,
        )
        db.add(task_record)
        db.commit()
        db.refresh(task_record)

    return task_record


def _mark_task_errored(bid_uuid: uuid.UUID, error_message: str) -> None:
    """Persist error state on the GenerationTask in a fresh session."""
    with SyncSession() as db:
        try:
            task_record = (
                db.query(GenerationTask)
                .filter(GenerationTask.bid_id == bid_uuid)
                .first()
            )
            if task_record is not None:
                task_record.status = "error"
                task_record.error_message = error_message
                task_record.completed_at = _now()
                db.commit()
        except Exception:
            logger.exception("Failed to persist error state for bid_id=%s", bid_uuid)
            db.rollback()


def _mark_bid_errored(bid_uuid: uuid.UUID, error_message: str) -> None:
    """Persist error state on the Bid in a fresh session."""
    with SyncSession() as db:
        try:
            bid_record = db.query(Bid).filter(Bid.id == bid_uuid).first()
            if bid_record is not None:
                bid_record.status = "error"
                # Store a minimal error context — we don't have an
                # error_message column on Bid, so we log it and update the
                # parsed_data JSONB as a fallback.
                bid_record.parsed_data = {"error": error_message}
                bid_record.updated_at = _now()
                db.commit()
        except Exception:
            logger.exception("Failed to persist bid error state for bid_id=%s", bid_uuid)
            db.rollback()
