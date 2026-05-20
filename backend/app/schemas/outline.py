import uuid
from datetime import datetime
from pydantic import BaseModel


class OutlineSection(BaseModel):
    section_id: str
    title: str
    score_point_ref: list[str] = []
    weight: str = "medium"
    required_attachments: list[str] = []
    content: str | None = None
    status: str = "pending"


class OutlineResponse(BaseModel):
    id: uuid.UUID
    bid_id: uuid.UUID
    sections: list[OutlineSection]
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class OutlineUpdate(BaseModel):
    sections: list[OutlineSection]
