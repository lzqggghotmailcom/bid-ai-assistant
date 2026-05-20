import uuid
from datetime import datetime
from pydantic import BaseModel


class GenerationTaskResponse(BaseModel):
    id: uuid.UUID
    bid_id: uuid.UUID
    status: str
    sections_total: int | None
    sections_done: int
    error_message: str | None
    ai_model_used: str | None
    token_usage: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
