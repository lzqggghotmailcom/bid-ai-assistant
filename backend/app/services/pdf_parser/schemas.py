"""
Pydantic data models for the PDF parsing module.

These models represent the structured output after parsing
and analyzing a bid/tender document.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ScoreItem(BaseModel):
    """A single scoring criterion extracted from the bid document."""

    name: str = Field(..., description="Name of the scoring item, e.g. '技术方案完整性'")
    max_score: float = Field(..., description="Maximum points for this item")
    criteria: str = Field(default="", description="Detailed scoring criteria description")
    required_proof: str = Field(default="", description="Documents/evidence required to claim these points")


class RejectClause(BaseModel):
    """A clause that would cause automatic rejection (one-vote veto)."""

    clause: str = Field(..., description="The rejection clause text")
    location: str = Field(default="", description="Where in the document this clause appears, e.g. '第三章第2.1条'")


class TechRequirement(BaseModel):
    """A technical parameter requirement, often marked with ★ or '必须满足'."""

    parameter: str = Field(..., description="Name of the technical parameter, e.g. '系统并发用户数'")
    value: str = Field(default="", description="Required value, e.g. '≥5000'")
    mandatory: bool = Field(default=False, description="Whether this is a mandatory requirement")


class QualificationRequirement(BaseModel):
    """A business qualification or certificate requirement."""

    type: str = Field(default="资质", description="Category: 资质(certificate), 业绩(track record), 人员(personnel), etc.")
    name: str = Field(..., description="Name of the qualification, e.g. 'ISO9001质量管理体系认证'")
    mandatory: bool = Field(default=False, description="Whether this qualification is mandatory")


class ParsedBidDocument(BaseModel):
    """
    The complete structured result of parsing a bid/tender document.

    Contains both the raw extracted information and the AI-analyzed
    structured fields after LLM processing.
    """

    score_items: list[ScoreItem] = Field(default_factory=list)
    reject_clauses: list[RejectClause] = Field(default_factory=list)
    tech_requirements: list[TechRequirement] = Field(default_factory=list)
    qualification_requirements: list[QualificationRequirement] = Field(default_factory=list)
    full_text: str = Field(default="", description="Full plain text extracted from the document")
    page_count: int = Field(default=0, description="Number of pages in the document")
