import uuid
from datetime import datetime
from pydantic import BaseModel


class KnowledgeUploadResponse(BaseModel):
    doc_id: uuid.UUID
    chunks: int
    status: str


class KnowledgeDocResponse(BaseModel):
    id: uuid.UUID
    doc_type: str
    filename: str | None
    title: str | None
    doc_metadata: dict | None
    chunk_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeListResponse(BaseModel):
    items: list[KnowledgeDocResponse]
    total: int
    page: int
    page_size: int


class KnowledgeSearchRequest(BaseModel):
    query: str
    top_k: int = 5
    doc_type: str | None = None


class SearchResultItem(BaseModel):
    doc_id: uuid.UUID
    content: str
    score: float
    section_title: str | None


class KnowledgeSearchResponse(BaseModel):
    results: list[SearchResultItem]
