import uuid
from datetime import datetime
from pydantic import BaseModel


class ComplianceReportResponse(BaseModel):
    id: uuid.UUID
    bid_id: uuid.UUID
    score_coverage: dict | None
    reject_clause_check: dict | None
    sensitive_check: dict | None
    overall_score: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
