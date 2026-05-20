import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class ComplianceReport(Base):
    __tablename__ = "compliance_reports"

    id: Mapped[uuid.UUID] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bid_id: Mapped[uuid.UUID] = mapped_column(String(36), ForeignKey("bids.id"), unique=True, nullable=False)
    score_coverage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reject_clause_check: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sensitive_check: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    overall_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
