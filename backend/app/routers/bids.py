"""
Bids Router

Endpoints for bid file management, outline generation, AI content generation,
compliance checking, and DOCX export.

All endpoints require authentication via get_current_user dependency.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models.bid import Bid
from app.models.outline import Outline
from app.models.generation import GenerationTask
from app.models.compliance import ComplianceReport
from app.models.export import Export
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.credit_check import check_can_generate, consume_project
from app.services.orchestrator.orchestrator import BidOrchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bids", tags=["bids"])


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class BidUploadResponse(BaseModel):
    bid_id: str
    filename: str
    page_count: int
    status: str
    industry: Optional[str] = None


class BidListItem(BaseModel):
    id: str
    filename: str
    status: str
    page_count: Optional[int]
    industry: Optional[str] = None
    created_at: str


class BidListResponse(BaseModel):
    items: List[BidListItem]
    total: int
    page: int
    page_size: int


class BidDetailResponse(BaseModel):
    id: str
    filename: str
    original_file_path: Optional[str]
    page_count: Optional[int]
    status: str
    industry: Optional[str] = None
    parsed_data: Optional[dict]
    outline: Optional[List[Dict[str, Any]]] = None
    generation_status: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: Optional[str]


class OutlineGenerateResponse(BaseModel):
    outline: List[Dict[str, Any]]


class OutlineSaveRequest(BaseModel):
    outline: List[Dict[str, Any]]


class OutlineSaveResponse(BaseModel):
    message: str


class GenerateRequest(BaseModel):
    outline: Optional[List[Dict[str, Any]]] = None
    settings: Optional[Dict[str, Any]] = None


class GenerateResponse(BaseModel):
    task_id: str
    status: str


class GenerationStatusResponse(BaseModel):
    task_id: str
    status: str
    sections_done: int
    sections_total: int
    error_message: Optional[str] = None


class SectionRegenerateResponse(BaseModel):
    section_id: str
    content: str


class ComplianceCheckResponse(BaseModel):
    score_coverage: Any = None
    reject_check: Any = None
    sensitive_check: Any = None
    overall_score: Optional[int] = None


# ---------------------------------------------------------------------------
# Orchestrator singleton
# ---------------------------------------------------------------------------

_orchestrator: BidOrchestrator | None = None


def get_orchestrator() -> BidOrchestrator:
    """Get or create the BidOrchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = BidOrchestrator()
    return _orchestrator


# ---------------------------------------------------------------------------
# Helper: ensure upload directory exists
# ---------------------------------------------------------------------------

def _ensure_upload_dir() -> Path:
    """Ensure the upload directory exists and return its path."""
    upload_dir = Path(getattr(settings, "UPLOAD_DIR", "uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


# ---------------------------------------------------------------------------
# 1. Upload Bid File
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=BidUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_bid(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    industry: Optional[str] = Form(None, description="Industry category"),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a bidding/tender file (PDF, DOCX, TXT).

    The file is saved to disk and a Bid record is created. Parsing is
    enqueued as a background task.
    """
    # Validate file extension
    suffix = Path(file.filename or "unknown").suffix.lower()
    allowed = {".pdf", ".docx", ".doc", ".txt"}
    if suffix not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(allowed)}",
        )

    # Validate file size
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB",
        )

    # Save file
    upload_dir = _ensure_upload_dir()
    unique_name = f"{uuid.uuid4()}{suffix}"
    file_path = upload_dir / unique_name
    file_path.write_bytes(content)

    # Create Bid record
    bid_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    async with async_session() as session:
        bid = Bid(
            id=bid_id,
            user_id=current_user.id,
            filename=file.filename or "unknown",
            original_file_path=str(file_path),
            page_count=0,
            status="uploaded",
            industry=industry or None,
            created_at=now,
            updated_at=now,
        )
        session.add(bid)
        await session.commit()

    # Enqueue parsing as background task
    orchestrator = get_orchestrator()
    background_tasks.add_task(
        _run_parse_background,
        orchestrator,
        bid_id,
        str(file_path),
    )

    logger.info("Bid uploaded: id=%s, filename=%s, industry=%s", bid_id, file.filename, industry)

    return BidUploadResponse(
        bid_id=bid_id,
        filename=file.filename or "unknown",
        page_count=0,
        status="processing",
        industry=industry,
    )


async def _run_parse_background(
    orchestrator: BidOrchestrator,
    bid_id: str,
    file_path: str,
) -> None:
    """Background task wrapper for bid file parsing."""
    try:
        await orchestrator.parse_bid_file(bid_id, file_path)
    except Exception as exc:
        logger.exception("Background parse failed for bid_id=%s: %s", bid_id, exc)


# ---------------------------------------------------------------------------
# 2. List User's Bids
# ---------------------------------------------------------------------------

@router.get("", response_model=BidListResponse)
async def list_bids(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
):
    """
    List the authenticated user's bids, paginated.
    """
    async with async_session() as session:
        # Count total
        count_result = await session.execute(
            select(func.count()).select_from(Bid).where(Bid.user_id == current_user.id)
        )
        total = count_result.scalar() or 0

        # Fetch page
        offset = (page - 1) * page_size
        result = await session.execute(
            select(Bid)
            .where(Bid.user_id == current_user.id)
            .order_by(Bid.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        bids = result.scalars().all()

    items = [
        BidListItem(
            id=b.id,
            filename=b.filename,
            status=b.status,
            page_count=b.page_count,
            industry=b.industry,
            created_at=b.created_at.isoformat() if b.created_at else "",
        )
        for b in bids
    ]

    return BidListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# 3. Get Bid Detail
# ---------------------------------------------------------------------------

@router.get("/{bid_id}", response_model=BidDetailResponse)
async def get_bid(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get a single bid's detail including parsed data.
    """
    async with async_session() as session:
        result = await session.execute(
            select(Bid).where(Bid.id == bid_id, Bid.user_id == current_user.id)
        )
        bid = result.scalar_one_or_none()

    if not bid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid not found",
        )

    # Fetch outline and generation status
    outline_data = None
    generation_status_data = None

    async with async_session() as session:
        outline_result = await session.execute(
            select(Outline).where(Outline.bid_id == bid_id)
        )
        outline = outline_result.scalar_one_or_none()
        if outline:
            outline_data = outline.sections

        gen_result = await session.execute(
            select(GenerationTask)
            .where(GenerationTask.bid_id == bid_id)
            .order_by(GenerationTask.created_at.desc())
            .limit(1)
        )
        gen_task = gen_result.scalar_one_or_none()
        if gen_task:
            generation_status_data = {
                "task_id": gen_task.id,
                "status": gen_task.status,
                "sections_done": gen_task.sections_done,
                "sections_total": gen_task.sections_total,
                "error_message": gen_task.error_message,
            }

    return BidDetailResponse(
        id=bid.id,
        filename=bid.filename,
        original_file_path=bid.original_file_path,
        page_count=bid.page_count,
        status=bid.status,
        industry=bid.industry,
        parsed_data=bid.parsed_data,
        outline=outline_data,
        generation_status=generation_status_data,
        created_at=bid.created_at.isoformat() if bid.created_at else "",
        updated_at=bid.updated_at.isoformat() if bid.updated_at else None,
    )


# ---------------------------------------------------------------------------
# 4. Delete Bid
# ---------------------------------------------------------------------------

@router.delete("/{bid_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bid(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Delete a bid and all associated data (outline, generation tasks,
    compliance reports, exports, and the uploaded file).
    """
    async with async_session() as session:
        result = await session.execute(
            select(Bid).where(Bid.id == bid_id, Bid.user_id == current_user.id)
        )
        bid = result.scalar_one_or_none()

        if not bid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bid not found",
            )

        # Delete the uploaded file if it exists
        if bid.original_file_path:
            try:
                os.remove(bid.original_file_path)
            except OSError:
                logger.warning("Could not delete file: %s", bid.original_file_path)

        # Delete the bid record (cascade handles related records via FK)
        await session.delete(bid)
        await session.commit()

    logger.info("Bid deleted: id=%s", bid_id)


# ---------------------------------------------------------------------------
# 5. Generate Outline
# ---------------------------------------------------------------------------

@router.post("/{bid_id}/outline", response_model=OutlineGenerateResponse)
async def generate_outline(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a response outline based on the bid's parsed scoring criteria.
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    orchestrator = get_orchestrator()
    sections = await orchestrator.generate_outline(bid_id)

    return OutlineGenerateResponse(outline=sections)


# ---------------------------------------------------------------------------
# 6. Save User-Edited Outline
# ---------------------------------------------------------------------------

@router.put("/{bid_id}/outline", response_model=OutlineSaveResponse)
async def save_outline(
    bid_id: str,
    req: OutlineSaveRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Save a user-edited outline. Overwrites the existing outline sections.
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    async with async_session() as session:
        result = await session.execute(
            select(Outline).where(Outline.bid_id == bid_id)
        )
        outline = result.scalar_one_or_none()

        if not outline:
            outline = Outline(
                id=str(uuid.uuid4()),
                bid_id=bid_id,
                sections=req.outline,
            )
            session.add(outline)
        else:
            outline.sections = req.outline
            outline.updated_at = datetime.now(timezone.utc)

        await session.commit()

    logger.info("Outline saved for bid_id=%s (%d sections)", bid_id, len(req.outline))
    return OutlineSaveResponse(message="Outline saved successfully")


# ---------------------------------------------------------------------------
# 7. Start Full Generation
# ---------------------------------------------------------------------------

@router.post("/{bid_id}/generate", response_model=GenerateResponse)
async def start_generation(
    bid_id: str,
    background_tasks: BackgroundTasks,
    req: GenerateRequest = GenerateRequest(),
    current_user: User = Depends(get_current_user),
):
    """
    Start full document generation for all outline sections.

    If an outline is provided in the request body, it is saved first.
    Generation runs asynchronously in the background; poll /generation-status
    for progress.
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    # Project quota check: consume one project for first generation on this bid
    async with async_session() as session:
        result = await session.execute(select(Bid).where(Bid.id == bid_id))
        bid_obj = result.scalar_one()

        if not bid_obj.project_consumed:
            user_result = await session.execute(
                select(User).where(User.id == current_user.id)
            )
            user = user_result.scalar_one()
            check_can_generate(user)
            await consume_project(session, user, bid_id)
            bid_obj.project_consumed = True
            await session.commit()

    # If an outline is provided in the request, save it first
    if req.outline:
        async with async_session() as session:
            result = await session.execute(
                select(Outline).where(Outline.bid_id == bid_id)
            )
            outline = result.scalar_one_or_none()
            if not outline:
                outline = Outline(
                    id=str(uuid.uuid4()),
                    bid_id=bid_id,
                    sections=req.outline,
                )
                session.add(outline)
            else:
                outline.sections = req.outline
                outline.updated_at = datetime.now(timezone.utc)
            await session.commit()

    orchestrator = get_orchestrator()

    # Create a pending task record and return immediately
    task_id = str(uuid.uuid4())
    async with async_session() as session:
        task = GenerationTask(
            id=task_id,
            bid_id=bid_id,
            user_id=current_user.id,
            status="pending",
            sections_total=0,
            sections_done=0,
            ai_model_used=getattr(orchestrator, "_llm_model", "deepseek-v4"),
            started_at=datetime.now(timezone.utc),
        )
        session.add(task)
        await session.commit()

    # Kick off generation in the background
    background_tasks.add_task(
        _run_generation_background,
        orchestrator,
        bid_id,
    )

    logger.info("Generation started for bid_id=%s, task_id=%s", bid_id, task_id)

    return GenerateResponse(
        task_id=task_id,
        status="generating",
    )


async def _run_generation_background(
    orchestrator: BidOrchestrator,
    bid_id: str,
) -> None:
    """Background task wrapper for full section generation."""
    try:
        await orchestrator.generate_all_sections(bid_id)
    except Exception as exc:
        logger.exception("Background generation failed for bid_id=%s: %s", bid_id, exc)


# ---------------------------------------------------------------------------
# 8. Poll Generation Status
# ---------------------------------------------------------------------------

@router.get("/{bid_id}/generation-status", response_model=GenerationStatusResponse)
async def get_generation_status(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Poll the progress of a running (or completed) generation task.
    Returns the most recent GenerationTask for this bid.
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    async with async_session() as session:
        result = await session.execute(
            select(GenerationTask)
            .where(GenerationTask.bid_id == bid_id)
            .order_by(GenerationTask.created_at.desc())
            .limit(1)
        )
        task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No generation task found for this bid",
        )

    return GenerationStatusResponse(
        task_id=task.id,
        status=task.status,
        sections_done=task.sections_done or 0,
        sections_total=task.sections_total or 0,
        error_message=task.error_message,
    )


# ---------------------------------------------------------------------------
# 9. Regenerate Single Section
# ---------------------------------------------------------------------------

@router.post("/{bid_id}/sections/{section_id}/regenerate", response_model=SectionRegenerateResponse)
async def regenerate_section(
    bid_id: str,
    section_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Regenerate a single section of the bid using RAG + P4 prompt.
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    orchestrator = get_orchestrator()
    content = await orchestrator.generate_section(bid_id, section_id)

    return SectionRegenerateResponse(
        section_id=section_id,
        content=content,
    )


# ---------------------------------------------------------------------------
# 10. Compliance Check
# ---------------------------------------------------------------------------

@router.post("/{bid_id}/compliance-check", response_model=ComplianceCheckResponse)
async def run_compliance_check(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Run a compliance check comparing the generated bid against the
    original tender requirements (P5 prompt).
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    orchestrator = get_orchestrator()
    result = await orchestrator.run_compliance_check(bid_id)

    return ComplianceCheckResponse(
        score_coverage=result.get("score_coverage"),
        reject_check=result.get("reject_check"),
        sensitive_check=result.get("sensitive_check"),
        overall_score=result.get("overall_score"),
    )


# ---------------------------------------------------------------------------
# 11. Export DOCX
# ---------------------------------------------------------------------------

@router.get("/{bid_id}/export")
async def export_docx(
    bid_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Generate and download the bid document as a Word (.docx) file.
    """
    await _verify_bid_ownership(bid_id, current_user.id)

    orchestrator = get_orchestrator()
    export_result = await orchestrator.export_docx(bid_id)

    file_path = export_result.get("file_path")
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Export file was not generated",
        )

    # Determine a user-friendly download filename
    async with async_session() as session:
        result = await session.execute(
            select(Bid).where(Bid.id == bid_id)
        )
        bid = result.scalar_one_or_none()

    original_name = Path(bid.filename).stem if bid else "bid_document"
    download_name = f"{original_name}_应标文件.docx"

    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=download_name,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _verify_bid_ownership(bid_id: str, user_id: str) -> Bid:
    """
    Verify that the bid exists and belongs to the given user.
    Raises 404 if not found or not owned.
    """
    async with async_session() as session:
        result = await session.execute(
            select(Bid).where(Bid.id == bid_id, Bid.user_id == user_id)
        )
        bid = result.scalar_one_or_none()

    if not bid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid not found",
        )

    return bid
