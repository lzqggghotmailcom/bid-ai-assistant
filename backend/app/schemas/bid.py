import uuid
from datetime import datetime
from pydantic import BaseModel


class BidResponse(BaseModel):
    id: uuid.UUID
    filename: str
    page_count: int | None
    status: str
    industry: str | None = None
    parsed_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BidListResponse(BaseModel):
    items: list[BidResponse]
    total: int
