import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Outline(Base):
    __tablename__ = "outlines"

    id: Mapped[uuid.UUID] = mapped_column(String(36), primary_key=True, default=uuid.uuid4)
    bid_id: Mapped[uuid.UUID] = mapped_column(String(36), ForeignKey("bids.id"), unique=True, nullable=False)
    sections: Mapped[dict] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
