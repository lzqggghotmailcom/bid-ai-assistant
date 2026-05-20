"""
PDF parsing module for the AI Bid Assistant.

Parses bid/tender documents (PDF/Word), extracts structured information
using LLM, and handles table extraction with optional LLM-based repair.
"""

from app.services.pdf_parser.parser import parse
from app.services.pdf_parser.extractor import extract
from app.services.pdf_parser.table_extractor import extract_tables
from app.services.pdf_parser.schemas import (
    ParsedBidDocument,
    ScoreItem,
    RejectClause,
    TechRequirement,
    QualificationRequirement,
)

__all__ = [
    "parse",
    "extract",
    "extract_tables",
    "ParsedBidDocument",
    "ScoreItem",
    "RejectClause",
    "TechRequirement",
    "QualificationRequirement",
]
