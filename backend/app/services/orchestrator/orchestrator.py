"""
Bid Orchestrator

Main orchestration layer that coordinates the full bid generation pipeline:
  Parse -> Outline -> RAG Retrieve -> Generate Sections -> Compliance Check -> Export

All DB operations use async SQLAlchemy sessions.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.core.database import async_session
from app.models.bid import Bid
from app.models.outline import Outline
from app.models.generation import GenerationTask
from app.models.compliance import ComplianceReport
from app.models.export import Export
from app.services.orchestrator.prompt_manager import PromptManager
from app.services.orchestrator.prompts import PROMPT_REGISTRY

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Industry to role-context mapping
# ------------------------------------------------------------------

INDUSTRY_MAP: Dict[str, Dict[str, str]] = {
    "it": {"label": "IT/软件", "role_context": "IT项目"},
    "construction": {"label": "建筑工程", "role_context": "建筑工程项目"},
    "healthcare": {"label": "医疗/医药", "role_context": "医疗项目"},
    "consulting": {"label": "咨询服务", "role_context": "咨询服务项目"},
    "manufacturing": {"label": "制造业", "role_context": "制造项目"},
    "education": {"label": "教育/培训", "role_context": "教育培训项目"},
    "other": {"label": "其他行业", "role_context": "通用项目"},
}


def get_industry_context(industry: str | None) -> str:
    """Resolve an industry code to its role context string for prompts."""
    if not industry:
        return "通用项目"
    return INDUSTRY_MAP.get(industry, {}).get("role_context", "通用项目")


class BidOrchestrator:
    """
    Coordinates the full AI bid generation pipeline.

    The pipeline flow:
    1. Upload & Parse   ->  parse_bid_file()
    2. Generate Outline  ->  generate_outline()
    3. Generate Sections ->  generate_all_sections() (parallel)
    4. Compliance Check  ->  run_compliance_check()
    5. Export DOCX       ->  export_docx()
    """

    def __init__(
        self,
        prompt_manager: PromptManager | None = None,
        llm_client: Any = None,
        rag_service: Any = None,
        pdf_parser: Any = None,
        docx_engine: Any = None,
    ):
        """
        Initialize the orchestrator.

        Args:
            prompt_manager: PromptManager instance. Created if not provided.
            llm_client: LLM client for AI calls (from app.services.llm_client).
            rag_service: RAG service for knowledge retrieval.
            pdf_parser: PDF parsing service.
            docx_engine: DOCX generation engine.
        """
        self.prompts = prompt_manager or PromptManager()
        self.llm = llm_client
        self.rag = rag_service
        self.parser = pdf_parser
        self.docx = docx_engine
        self._llm_model = settings.DEEPSEEK_V4_MODEL

    # ------------------------------------------------------------------
    # Lazy service accessors
    # ------------------------------------------------------------------

    def _get_llm(self):
        if self.llm is None:
            from app.services.llm_client import LLMClient
            self.llm = LLMClient()
        return self.llm

    def _get_rag(self):
        return None  # RAG is called via module functions, not a class

    def _get_parser(self):
        return None  # parser is called via module functions, not a class

    def _get_docx(self):
        return None  # docx is called via module functions, not a class

    # ------------------------------------------------------------------
    # 1. Parse Bid File
    # ------------------------------------------------------------------

    async def parse_bid_file(
        self,
        bid_id: str,
        file_path: str,
    ) -> Dict[str, Any]:
        """
        Parse a bid file: extract text, then run AI parsing to extract
        structured scoring/requirements data.

        Args:
            bid_id: The bid record UUID.
            file_path: Absolute path to the uploaded bid file.

        Returns:
            The parsed_data dict with score_items, reject_clauses, etc.
        """
        logger.info("Starting parse for bid_id=%s, file=%s", bid_id, file_path)

        async with async_session() as session:
            # Mark bid as parsing
            await self._update_bid_status(session, bid_id, "parsing")

        try:
            # Step 1: Extract text from the file
            parser = self._get_parser()
            raw_text = await self._read_file_text(Path(file_path), parser)

            # Step 2: Run P1 prompt to extract structured data
            llm = self._get_llm()
            prompt = self.prompts.format_prompt(
                "P1_PARSE_BID",
                bid_file_content=raw_text,
            )

            response = await llm.chat(
                messages=[{"role": "user", "content": prompt}],
                model=self._llm_model,
                temperature=0.1,
                response_format={"type": "json_object"},
            )

            parsed_data = json.loads(response.content)

        except Exception as exc:
            logger.exception("Parse failed for bid_id=%s: %s", bid_id, exc)
            async with async_session() as session:
                await self._update_bid_status(session, bid_id, "error")
            raise

        # Store results
        async with async_session() as session:
            await self._update_bid_status(session, bid_id, "parsed")
            stmt = (
                update(Bid)
                .where(Bid.id == bid_id)
                .values(
                    parsed_data=parsed_data,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.execute(stmt)
            await session.commit()

        logger.info("Parse complete for bid_id=%s", bid_id)
        return parsed_data

    async def _read_file_text(self, file_path: Path, _parser: Any) -> str:
        """Read text from a file using the pdf_parser module."""
        from app.services.pdf_parser.parser import parse as parse_file
        loop = asyncio.get_event_loop()
        parsed = await loop.run_in_executor(None, parse_file, str(file_path))
        return parsed.full_text

    # ------------------------------------------------------------------
    # 2. Generate Outline
    # ------------------------------------------------------------------

    async def generate_outline(self, bid_id: str) -> List[Dict[str, Any]]:
        """
        Generate a bid response outline based on parsed scoring criteria.

        Reads parsed_data.score_items from the Bid record and uses P2 to
        produce a structured section outline.

        Args:
            bid_id: The bid record UUID.

        Returns:
            List of outline section dicts.
        """
        logger.info("Generating outline for bid_id=%s", bid_id)

        async with async_session() as session:
            bid = await self._get_bid(session, bid_id)
            await self._update_bid_status(session, bid_id, "outlining")

            parsed = bid.parsed_data or {}
            score_items = parsed.get("score_items", [])
            reject_items = parsed.get("reject_clauses", [])
            qual_items = parsed.get("qualification_requirements", [])

            if not score_items:
                # Fallback: when no explicit scoring criteria, build a generic
                # outline from reject clauses + qualification requirements
                score_items_json = json.dumps({
                    "_note": "本招标文件未提供明确的评分细则，以下为根据废标条款和资质要求推断的应标要点",
                    "reject_clauses": reject_items,
                    "qualification_requirements": qual_items,
                }, ensure_ascii=False, indent=2)
            else:
                score_items_json = json.dumps(score_items, ensure_ascii=False, indent=2)

        try:
            # Build company info and industry context
            user_info = await self._get_user_info(bid.user_id)
            industry_context = get_industry_context(bid.industry)

            llm = self._get_llm()
            prompt = self.prompts.format_prompt(
                "P2_GENERATE_OUTLINE",
                industry_context=industry_context,
                score_items_json=score_items_json,
                company_name=user_info.get("company_name", ""),
                core_business=user_info.get("core_business", ""),
                qualifications=user_info.get("qualifications", ""),
            )

            response = await llm.chat(
                messages=[{"role": "user", "content": prompt}],
                model=self._llm_model,
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            outline_sections = json.loads(response.content)
            if isinstance(outline_sections, dict):
                # Sometimes the LLM wraps in {"outline": [...]}
                outline_sections = outline_sections.get("outline", outline_sections)
                # If it's still a dict, try to find a list value
                if isinstance(outline_sections, dict):
                    for v in outline_sections.values():
                        if isinstance(v, list):
                            outline_sections = v
                            break

            if not isinstance(outline_sections, list):
                raise ValueError(
                    f"Expected outline to be a list, got {type(outline_sections)}"
                )

            # Assign stable section IDs
            for i, section in enumerate(outline_sections):
                if "section_id" not in section:
                    section["section_id"] = str(uuid.uuid4())[:8]
                section["status"] = "pending"
                section["content"] = ""

        except Exception as exc:
            logger.exception("Outline generation failed for bid_id=%s: %s", bid_id, exc)
            async with async_session() as session:
                await self._update_bid_status(session, bid_id, "error")
            raise

        # Upsert outline
        async with async_session() as session:
            existing = await session.execute(
                select(Outline).where(Outline.bid_id == bid_id)
            )
            outline = existing.scalar_one_or_none()

            if outline:
                outline.sections = outline_sections
                outline.updated_at = datetime.now(timezone.utc)
            else:
                outline = Outline(
                    id=str(uuid.uuid4()),
                    bid_id=bid_id,
                    sections=outline_sections,
                )
                session.add(outline)

            await self._update_bid_status(session, bid_id, "outlined")
            await session.commit()

        logger.info("Outline generated for bid_id=%s with %d sections", bid_id, len(outline_sections))
        return outline_sections

    # ------------------------------------------------------------------
    # 3. Generate Sections
    # ------------------------------------------------------------------

    async def generate_section(
        self,
        bid_id: str,
        section_id: str,
        target_length: int = 2000,
    ) -> str:
        """
        Generate content for a single outline section using RAG + P4 prompt.
        """
        logger.info("Generating section %s for bid_id=%s", section_id, bid_id)

        async with async_session() as session:
            bid = await self._get_bid(session, bid_id)
            outline = await self._get_outline(session, bid_id)
            if not outline:
                raise ValueError(f"No outline found for bid_id={bid_id}")

            section = self._find_section(outline.sections, section_id)
            if not section:
                raise ValueError(f"Section {section_id} not found in outline")

            user_info = await self._get_user_info(bid.user_id)
            industry_context = get_industry_context(bid.industry)

        # Step 1: Build RAG queries using P3
        llm = self._get_llm()
        search_query_prompt = self.prompts.format_prompt(
            "P3_CONSTRUCT_QUERY",
            section_title=section.get("title", ""),
            score_criteria=section.get("score_point_ref", ""),
            company_name=user_info.get("company_name", ""),
        )

        query_response = await llm.chat(
            messages=[{"role": "user", "content": search_query_prompt}],
            model=self._llm_model,
            temperature=0.3,
        )
        queries = [
            q.strip()
            for q in query_response.content.strip().split("\n")
            if q.strip()
        ]

        # Step 2: RAG retrieval via retriever module (graceful fallback)
        import uuid as _uuid
        criteria_text = (
            section.get("score_point_ref", "")
            if isinstance(section.get("score_point_ref"), str)
            else json.dumps(section.get("score_point_ref", []), ensure_ascii=False)
        )
        retrieved_content = "暂无相关企业素材"
        try:
            from app.services.rag.retriever import retrieve
            async with async_session() as session:
                retrieval_results = await retrieve(
                    db=session,
                    section_title=section.get("title", ""),
                    score_criteria=criteria_text,
                    user_id=_uuid.UUID(bid.user_id),
                    top_k=5,
                    llm_client=llm,
                    company_name=user_info.get("company_name", ""),
                )
                retrieved_content = "\n\n---\n\n".join(
                    r.get("content", "") if isinstance(r, dict) else str(r)
                    for r in retrieval_results
                ) or "暂无相关企业素材"
        except Exception as e:
            logger.warning("RAG retrieval failed for section %s: %s", section_id, e)

        # Step 3: Generate section content using P4
        gen_prompt = self.prompts.format_prompt(
            "P4_GENERATE_SECTION",
            industry_context=industry_context,
            section_title=section.get("title", ""),
            target_length=target_length,
            score_criteria=criteria_text,
            retrieved_content=retrieved_content,
            company_name=user_info.get("company_name", ""),
            qualifications=user_info.get("qualifications", ""),
        )

        response = await llm.chat(
            messages=[{"role": "user", "content": gen_prompt}],
            model=self._llm_model,
            temperature=0.5,
            max_tokens=min(target_length * 3, 8192),
        )

        content = response.content.strip()

        # Store the generated content back in the outline
        import copy
        async with async_session() as session:
            outline = await self._get_outline(session, bid_id)
            if outline:
                sections = copy.deepcopy(outline.sections)
                for s in sections:
                    if s.get("section_id") == section_id:
                        s["content"] = content
                        s["status"] = "done"
                        break
                outline.sections = sections
                outline.updated_at = datetime.now(timezone.utc)
                flag_modified(outline, "sections")
                await session.commit()

        logger.info("Section %s generated (%d chars)", section_id, len(content))
        return content

    async def generate_all_sections(self, bid_id: str) -> Dict[str, Any]:
        """
        Generate content for ALL outline sections in parallel using asyncio.gather.
        Creates a GenerationTask record and updates progress.

        Args:
            bid_id: The bid record UUID.

        Returns:
            Dict with task_id and status.
        """
        logger.info("Starting full generation for bid_id=%s", bid_id)

        async with async_session() as session:
            bid = await self._get_bid(session, bid_id)
            outline = await self._get_outline(session, bid_id)
            if not outline or not outline.sections:
                raise ValueError(f"No outline sections to generate for bid_id={bid_id}")

            sections = outline.sections
            sections_total = len(sections)

            # Create generation task
            task_id = str(uuid.uuid4())
            task = GenerationTask(
                id=task_id,
                bid_id=bid_id,
                user_id=bid.user_id,
                status="running",
                sections_total=sections_total,
                sections_done=0,
                ai_model_used=self._llm_model,
                started_at=datetime.now(timezone.utc),
            )
            session.add(task)
            await self._update_bid_status(session, bid_id, "generating")
            await session.commit()

        try:
            # Generate sections with limited concurrency to avoid SQLite overload
            _sem = asyncio.Semaphore(2)  # max 2 concurrent sections

            async def _gen_one(section: dict) -> dict:
                """Generate one section and update progress counter."""
                async with _sem:
                    try:
                        content = await self.generate_section(
                            bid_id=bid_id,
                            section_id=section["section_id"],
                        )
                        # Increment done counter
                        async with async_session() as session:
                            stmt = (
                                update(GenerationTask)
                                .where(GenerationTask.id == task_id)
                                .values(
                                    sections_done=GenerationTask.sections_done + 1,
                                )
                            )
                            await session.execute(stmt)
                            await session.commit()
                        return {"section_id": section["section_id"], "status": "done", "content": content}
                    except Exception as exc:
                        logger.exception("Section %s generation failed", section.get("section_id"))
                        async with async_session() as session:
                            stmt = (
                                update(GenerationTask)
                                .where(GenerationTask.id == task_id)
                                .values(
                                    sections_done=GenerationTask.sections_done + 1,
                                )
                            )
                            await session.execute(stmt)
                            await session.commit()
                        return {"section_id": section["section_id"], "status": "error", "error": str(exc)}

            results = await asyncio.gather(
                *[_gen_one(s) for s in sections],
                return_exceptions=True,
            )

            # Determine final status
            errors = [r for r in results if isinstance(r, dict) and r.get("status") == "error"]

            async with async_session() as session:
                task_status = "error" if len(errors) == len(sections) else "done"
                stmt = (
                    update(GenerationTask)
                    .where(GenerationTask.id == task_id)
                    .values(
                        status=task_status,
                        completed_at=datetime.now(timezone.utc),
                    )
                )
                await session.execute(stmt)
                await self._update_bid_status(session, bid_id, "done")
                await session.commit()

            logger.info(
                "Full generation complete for bid_id=%s: %d sections, %d errors",
                bid_id, sections_total, len(errors),
            )

            return {
                "task_id": task_id,
                "status": "done",
                "sections_total": sections_total,
                "sections_done": sections_total,
                "errors": len(errors),
            }

        except Exception as exc:
            logger.exception("Full generation failed for bid_id=%s", bid_id)
            async with async_session() as session:
                stmt = (
                    update(GenerationTask)
                    .where(GenerationTask.id == task_id)
                    .values(
                        status="error",
                        error_message=str(exc),
                        completed_at=datetime.now(timezone.utc),
                    )
                )
                await session.execute(stmt)
                await self._update_bid_status(session, bid_id, "error")
                await session.commit()
            raise

    # ------------------------------------------------------------------
    # 4. Compliance Check
    # ------------------------------------------------------------------

    async def run_compliance_check(self, bid_id: str) -> Dict[str, Any]:
        """
        Run a full compliance check comparing the generated bid against
        the original tender requirements.

        Uses P5_COMPLIANCE_CHECK to check:
        1. Score coverage (which score items are addressed/missed)
        2. Reject clause compliance
        3. Sensitive content issues

        Args:
            bid_id: The bid record UUID.

        Returns:
            Compliance report dict with score_coverage, reject_check, sensitive_check.
        """
        logger.info("Running compliance check for bid_id=%s", bid_id)

        async with async_session() as session:
            bid = await self._get_bid(session, bid_id)
            outline = await self._get_outline(session, bid_id)

            parsed_requirements = json.dumps(
                bid.parsed_data or {}, ensure_ascii=False, indent=2
            )

            # Assemble full generated content from all sections
            sections_content_parts: list[str] = []
            if outline and outline.sections:
                for s in outline.sections:
                    title = s.get("title", "")
                    content = s.get("content", "")
                    sections_content_parts.append(f"## {title}\n\n{content}")

            generated_bid_content = "\n\n".join(sections_content_parts) or "（暂无生成内容）"

        try:
            llm = self._get_llm()
            prompt = self.prompts.format_prompt(
                "P5_COMPLIANCE_CHECK",
                parsed_requirements=parsed_requirements,
                generated_bid_content=generated_bid_content,
            )

            response = await llm.chat(
                messages=[{"role": "user", "content": prompt}],
                model=self._llm_model,
                temperature=0.1,
                response_format={"type": "json_object"},
            )

            report = json.loads(response.content)

            # Calculate overall score
            score_coverage = report.get("score_coverage", {})
            covered = score_coverage.get("covered", 0)
            total = score_coverage.get("total", 100)
            coverage_pct = (covered / total * 100) if total > 0 else 0

            reject_check = report.get("reject_check", {})
            reject_ok = reject_check.get("all_passed", True)
            reject_score = 100 if reject_ok else 50

            sensitive_issues = report.get("sensitive_issues", [])
            sensitive_score = 100 if not sensitive_issues else max(0, 100 - len(sensitive_issues) * 20)

            overall_score = int(coverage_pct * 0.6 + reject_score * 0.25 + sensitive_score * 0.15)

        except Exception as exc:
            logger.exception("Compliance check failed for bid_id=%s: %s", bid_id, exc)
            raise

        # Store report
        async with async_session() as session:
            existing = await session.execute(
                select(ComplianceReport).where(ComplianceReport.bid_id == bid_id)
            )
            comp_report = existing.scalar_one_or_none()

            if comp_report:
                comp_report.score_coverage = report.get("score_coverage")
                comp_report.reject_clause_check = report.get("reject_check")
                comp_report.sensitive_check = report.get("sensitive_issues")
                comp_report.overall_score = overall_score
            else:
                comp_report = ComplianceReport(
                    id=str(uuid.uuid4()),
                    bid_id=bid_id,
                    score_coverage=report.get("score_coverage"),
                    reject_clause_check=report.get("reject_check"),
                    sensitive_check=report.get("sensitive_issues"),
                    overall_score=overall_score,
                )
                session.add(comp_report)

            await session.commit()

        logger.info("Compliance check complete for bid_id=%s, score=%d", bid_id, overall_score)
        return {
            "score_coverage": report.get("score_coverage"),
            "reject_check": report.get("reject_check"),
            "sensitive_check": report.get("sensitive_issues"),
            "overall_score": overall_score,
        }

    # ------------------------------------------------------------------
    # 5. Export DOCX
    # ------------------------------------------------------------------

    async def export_docx(self, bid_id: str) -> Dict[str, Any]:
        """
        Export the generated bid as a Word document. Delegates to the docx engine.

        Args:
            bid_id: The bid record UUID.

        Returns:
            Dict with file_path, file_size, and export_id.
        """
        logger.info("Exporting DOCX for bid_id=%s", bid_id)

        async with async_session() as session:
            bid = await self._get_bid(session, bid_id)
            outline = await self._get_outline(session, bid_id)
            if not outline or not outline.sections:
                raise ValueError(f"No generated content to export for bid_id={bid_id}")

            user_info = await self._get_user_info(bid.user_id)

        # Delegate to docx engine
        from app.services.docx_engine.engine import generate_docx
        import os

        export_dir = Path(settings.UPLOAD_DIR) / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{uuid.uuid4()}.docx"
        output_path = str(export_dir / file_name)

        bid_info = {
            "company_name": user_info.get("company_name", ""),
            "project_name": bid.filename or "",
            "bid_date": datetime.now(timezone.utc).strftime("%Y年%m月%d日"),
        }

        outline_data = {
            "sections": outline.sections,
            "tech_requirements": (bid.parsed_data or {}).get("tech_requirements"),
        }

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, generate_docx, outline_data, bid_info, output_path)

        file_path = output_path
        file_size = os.path.getsize(file_path)

        # Store export record
        export_id = str(uuid.uuid4())
        async with async_session() as session:
            export_record = Export(
                id=export_id,
                bid_id=bid_id,
                file_path=file_path,
                file_size=file_size,
            )
            session.add(export_record)
            await session.commit()

        logger.info("DOCX exported for bid_id=%s: %s (%d bytes)", bid_id, file_path, file_size)
        return {
            "export_id": export_id,
            "file_path": file_path,
            "file_size": file_size,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_bid(self, session: AsyncSession, bid_id: str) -> Bid:
        """Fetch a Bid by ID, raising if not found."""
        result = await session.execute(select(Bid).where(Bid.id == bid_id))
        bid = result.scalar_one_or_none()
        if not bid:
            raise ValueError(f"Bid not found: {bid_id}")
        return bid

    async def _get_outline(self, session: AsyncSession, bid_id: str) -> Outline | None:
        """Fetch the Outline for a bid, or None."""
        result = await session.execute(
            select(Outline).where(Outline.bid_id == bid_id)
        )
        return result.scalar_one_or_none()

    def _find_section(
        self, sections: List[Dict[str, Any]], section_id: str
    ) -> Dict[str, Any] | None:
        """Find a section dict by section_id."""
        for s in sections:
            if s.get("section_id") == section_id:
                return s
        return None

    async def _update_bid_status(
        self, session: AsyncSession, bid_id: str, status: str
    ) -> None:
        """Update the status field on a Bid record."""
        stmt = (
            update(Bid)
            .where(Bid.id == bid_id)
            .values(status=status, updated_at=datetime.now(timezone.utc))
        )
        await session.execute(stmt)
        await session.commit()

    async def _get_user_info(self, user_id: str) -> Dict[str, str]:
        """Fetch basic user info for prompt population."""
        async with async_session() as session:
            from app.models.user import User
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user:
                return {}
            return {
                "company_name": user.company_name or "",
                "core_business": getattr(user, "core_business", "") or "",
                "qualifications": getattr(user, "qualifications", "") or "",
            }

    # ------------------------------------------------------------------
    # Convenience: run entire pipeline
    # ------------------------------------------------------------------

    async def run_full_pipeline(
        self,
        bid_id: str,
        file_path: str,
    ) -> Dict[str, Any]:
        """
        Run the complete pipeline from parse to export.

        This is a convenience method that chains all steps:
        parse -> outline -> generate -> compliance -> export
        """
        logger.info("Starting full pipeline for bid_id=%s", bid_id)

        # Step 1: Parse
        await self.parse_bid_file(bid_id, file_path)

        # Step 2: Outline
        await self.generate_outline(bid_id)

        # Step 3: Generate all sections
        gen_result = await self.generate_all_sections(bid_id)

        # Step 4: Compliance check
        compliance_result = await self.run_compliance_check(bid_id)

        # Step 5: Export
        export_result = await self.export_docx(bid_id)

        logger.info("Full pipeline complete for bid_id=%s", bid_id)

        return {
            "bid_id": bid_id,
            "generation": gen_result,
            "compliance": compliance_result,
            "export": export_result,
        }
