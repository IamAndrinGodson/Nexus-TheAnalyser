import os
from celery import Celery
from loguru import logger

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "nexus_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task
def update_session_timeout(session_id: str, new_timeout: int):
    """Async task to persist the new timeout to Postgres without blocking the API"""
    logger.info(f"Async: Updating timeout for {session_id} to {new_timeout}s")
    # In a full implementation, this connects to Postgres and runs an UPDATE
    pass

@celery_app.task
def ingest_session_event(session_id: str, event_type: str, severity: str, metadata: dict):
    """Async task to write to TimescaleDB append-only log"""
    logger.info(f"Async: Event {event_type} for session {session_id}")
    pass
