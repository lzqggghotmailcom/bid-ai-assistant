import uuid
from datetime import datetime

from sqlalchemy import String, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Export(Base):
    __tablename__ = "exports"

    id: Mapped[uuid.UUID] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bid_id: Mapped[uuid.UUID] = mapped_column(String(36), ForeignKey("bids.id"), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
