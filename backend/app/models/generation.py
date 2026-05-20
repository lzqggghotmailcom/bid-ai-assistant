import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    id: Mapped[uuid.UUID] = mapped_column(String(36), primary_key=True, default=uuid.uuid4)
    bid_id: Mapped[uuid.UUID] = mapped_column(String(36), ForeignKey("bids.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    sections_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sections_done: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    token_usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
