"""
Celery application configuration for AI Bid Assistant.

Worker startup:
    celery -A app.services.tasks.celery_app worker --loglevel=info --concurrency=4
"""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "bid_assistant",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="Asia/Shanghai",
    enable_utc=True,

    # Task time limits (seconds)
    task_soft_time_limit=900,   # 15 minutes soft
    task_time_limit=1200,       # 20 minutes hard

    # Worker
    worker_concurrency=4,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,

    # Result backend
    result_expires=3600,        # 1 hour TTL for results
    result_extended=True,

    # Retry / error handling
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,

    # Auto-discover tasks
    imports=["app.services.tasks.generation_task"],
)
