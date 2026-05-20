"""
Exports Router

Endpoint:
  GET /api/v1/bids/{bid_id}/export  -- Generate and download a Word (.docx) bid document.

This router reads the bid metadata, outline (with generated content), and any
technical requirements from the database, then delegates to the docx_engine
to produce a fully-formatted Word document.
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models.bid import Bid
from app.models.export import Export
from app.models.outline import Outline
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.docx_engine.engine import generate_docx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/exports", tags=["exports"])


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{bid_id}/docx")
async def export_bid_docx(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """Generate the bid document as a Word (.docx) file and stream it to the client.

    Reads the bid metadata and outline (including AI-generated section
    content) from the database, builds a fully-formatted Word document
    conforming to the TEMPLATES.md specification, saves it temporarily,
    and returns it as a downloadable file attachment.

    A record of the export is persisted in the exports table.
    """
    # ---- 1. Authorise and load bid + outline ----
    async with async_session() as session:
        bid_result = await session.execute(
            select(Bid).where(Bid.id == bid_id, Bid.user_id == current_user.id)
        )
        bid = bid_result.scalar_one_or_none()

        if not bid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bid not found",
            )

        if bid.status not in ("done", "parsed", "generated"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bid is not ready for export (current status: {bid.status})",
            )

        # Load outline with generated content
        outline_result = await session.execute(
            select(Outline).where(Outline.bid_id == bid_id)
        )
        outline = outline_result.scalar_one_or_none()

    # ---- 2. Prepare data structures for the engine ----
    bid_info = _build_bid_info(bid)

    outline_data = _build_outline_data(outline, bid)

    # ---- 3. Generate the .docx file ----
    export_dir = Path(settings.UPLOAD_DIR) / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{uuid.uuid4()}.docx"
    output_path = str(export_dir / file_name)

    try:
        generate_docx(outline_data, bid_info, output_path)
    except Exception as exc:
        logger.exception("DOCX generation failed for bid_id=%s: %s", bid_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document generation failed: {exc}",
        )

    # ---- 4. Persist export record ----
    file_size = os.path.getsize(output_path)

    async with async_session() as session:
        export_record = Export(
            id=str(uuid.uuid4()),
            bid_id=bid_id,
            file_path=output_path,
            file_size=file_size,
        )
        session.add(export_record)
        await session.commit()

    # ---- 5. Return file response ----
    original_name = Path(bid.filename).stem if bid.filename else "bid_document"
    download_name = f"{original_name}_投标文件.docx"

    logger.info("Export complete: bid_id=%s, size=%d bytes, path=%s",
                bid_id, file_size, output_path)

    return FileResponse(
        path=output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=download_name,
        headers={
            "Content-Disposition": f'attachment; filename="{download_name.encode("utf-8").decode("latin-1")}"'
        },
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_bid_info(bid: Bid) -> dict:
    """Extract bid_info dict from a Bid ORM model."""
    parsed = bid.parsed_data or {}
    return {
        'company_name': parsed.get('company_name', ''),
        'project_name': parsed.get('project_name', bid.filename or ''),
        'bid_date': parsed.get('bid_date', datetime.now(timezone.utc).strftime('%Y年%m月%d日')),
        'contact': parsed.get('contact', ''),
    }


def _build_outline_data(outline: Outline | None, bid: Bid) -> dict:
    """Build outline_data dict from Outline ORM model and Bid.

    The outline's `sections` field (JSONB) is a list of section dicts.
    If tech_requirements exist in parsed_data, they are included for the
    技术参数响应表.
    """
    sections = []
    tech_requirements = None

    if outline and outline.sections:
        sections = outline.sections

    # Look for tech requirements in bid parsed_data
    parsed = bid.parsed_data or {}
    tech_reqs = parsed.get('tech_requirements')
    if tech_reqs and isinstance(tech_reqs, list):
        tech_requirements = tech_reqs

    return {
        'sections': sections,
        'tech_requirements': tech_requirements,
    }
