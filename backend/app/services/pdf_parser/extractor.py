"""
LLM-based information extractor for parsed bid documents.

Takes the plain text extracted by ``parser.py``, sends it to DeepSeek
with the structured P1 parsing prompt (from PROMPTS.md), and returns
a fully populated ``ParsedBidDocument``.

Exports:
    extract(text: str, llm_client: LLMClient) -> ParsedBidDocument
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional, TYPE_CHECKING

from app.services.pdf_parser.schemas import (
    ParsedBidDocument,
    QualificationRequirement,
    RejectClause,
    ScoreItem,
    TechRequirement,
)

if TYPE_CHECKING:
    from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# P1 Prompt template (aligned with PROMPTS.md)
# ---------------------------------------------------------------------------

P1_EXTRACTION_PROMPT = """你是一位资深招投标专家。请仔细阅读以下招标文件内容，提取关键信息。

## 要求
1. **评分标准表**：提取所有评分项，包括：评分项名称、满分值、评分标准描述、所需证明材料
2. **废标条款**：提取所有可能导致废标的条款（一票否决项），高亮标记
3. **技术参数要求**：提取所有带"★"或明确标注"必须满足"的技术指标
4. **商务资质要求**：提取所有资质证书、业绩、人员要求

## 输出格式
{
  "score_items": [
    {
      "name": "技术方案完整性",
      "max_score": 25,
      "criteria": "技术方案应包含系统架构设计、功能模块设计...",
      "required_proof": "系统架构图、功能清单"
    }
  ],
  "reject_clauses": [
    {"clause": "投标报价超过采购预算", "location": "第三章第2.1条"}
  ],
  "tech_requirements": [
    {"parameter": "系统并发用户数", "value": "≥5000", "mandatory": true}
  ],
  "qualification_requirements": [
    {"type": "资质", "name": "ISO9001质量管理体系认证", "mandatory": true}
  ]
}

## 招标文件内容
{bid_file_content}"""

# ---------------------------------------------------------------------------
# Maximum characters to send to the LLM (model context window safety)
# ---------------------------------------------------------------------------
MAX_INPUT_CHARS: int = 120_000


# ---------------------------------------------------------------------------
# JSON repair utilities
# ---------------------------------------------------------------------------


def _repair_json(raw: str) -> str:
    """
    Attempt to repair common JSON formatting issues from LLM output.

    Handles:
    - Markdown code-fence markers (```json ... ```)
    - Trailing commas before closing brackets/braces
    - Leading/trailing whitespace
    """
    text = raw.strip()

    # Remove markdown code fences
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)

    # Remove trailing commas before ] or }
    text = re.sub(r",\s*([}\]])", r"\1", text)

    # Try to fix unquoted keys (simple heuristic)
    # This is a best-effort fix; Pydantic will catch remaining issues
    return text


def _parse_json_safe(raw: str) -> dict:
    """
    Parse JSON from LLM output with progressive repair attempts.

    Returns the parsed dict or a minimal fallback structure.
    """
    text = _repair_json(raw)

    errors: list[str] = []

    # Attempt 1: direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        errors.append(f"direct parse: {e}")

    # Attempt 2: try to extract the first JSON object
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            extracted = match.group(0)
            return json.loads(_repair_json(extracted))
    except (json.JSONDecodeError, ValueError) as e:
        errors.append(f"brace extraction: {e}")

    # Attempt 3: progressive truncation (try to find a valid prefix)
    try:
        for cut in range(len(text), 0, -500):
            truncated = text[:cut]
            # Add closing brackets if needed
            open_braces = truncated.count("{") - truncated.count("}")
            open_brackets = truncated.count("[") - truncated.count("]")
            truncated += "}" * open_braces + "]" * open_brackets
            try:
                return json.loads(truncated)
            except json.JSONDecodeError:
                continue
    except Exception as e:
        errors.append(f"progressive truncation: {e}")

    raise ValueError(
        f"Failed to parse LLM JSON output after multiple attempts. "
        f"Errors: {'; '.join(errors)}"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def extract(text: str, llm_client: "LLMClient") -> ParsedBidDocument:
    """
    Extract structured bid information from raw document text.

    Sends the text to the DeepSeek LLM with the P1 extraction prompt and
    parses the JSON response into a ``ParsedBidDocument``.

    Args:
        text: Plain text extracted from the bid document.
        llm_client: An ``LLMClient`` instance for making LLM calls.

    Returns:
        A ``ParsedBidDocument`` with all structured fields populated.
    """
    if not text or not text.strip():
        logger.warning("Empty text passed to extractor; returning empty result.")
        return ParsedBidDocument(full_text=text, page_count=0)

    # Truncate very long texts to avoid hitting context limits
    truncated_text = text[:MAX_INPUT_CHARS]
    if len(text) > MAX_INPUT_CHARS:
        logger.warning(
            "Input text truncated from %d to %d chars for LLM processing.",
            len(text),
            MAX_INPUT_CHARS,
        )

    prompt = P1_EXTRACTION_PROMPT.format(bid_file_content=truncated_text)

    messages = [
        {
            "role": "system",
            "content": "你是一位资深招投标专家，擅长从招标文件中提取结构化信息。请严格按JSON格式输出。",
        },
        {"role": "user", "content": prompt},
    ]

    logger.info("Sending extraction request to LLM (text length=%d chars).", len(truncated_text))
    raw_response = await llm_client.chat(messages=messages, temperature=0.1)

    # Parse the LLM JSON response
    data = _parse_json_safe(raw_response)

    return _build_document(data, full_text=text)


# ---------------------------------------------------------------------------
# Internal: response-to-model mapping
# ---------------------------------------------------------------------------


def _build_document(data: dict, *, full_text: str = "", page_count: int = 0) -> ParsedBidDocument:
    """
    Convert the raw LLM response dict into a ParsedBidDocument.

    Handles missing keys and data type coercion gracefully.
    """
    score_items = [
        ScoreItem(
            name=item.get("name", "未知评分项"),
            max_score=float(item.get("max_score", 0)),
            criteria=item.get("criteria", ""),
            required_proof=item.get("required_proof", ""),
        )
        for item in data.get("score_items", [])
    ]

    reject_clauses = [
        RejectClause(
            clause=item.get("clause", ""),
            location=item.get("location", ""),
        )
        for item in data.get("reject_clauses", [])
    ]

    tech_requirements = [
        TechRequirement(
            parameter=item.get("parameter", ""),
            value=item.get("value", ""),
            mandatory=bool(item.get("mandatory", False)),
        )
        for item in data.get("tech_requirements", [])
    ]

    qualification_requirements = [
        QualificationRequirement(
            type=item.get("type", "资质"),
            name=item.get("name", ""),
            mandatory=bool(item.get("mandatory", False)),
        )
        for item in data.get("qualification_requirements", [])
    ]

    return ParsedBidDocument(
        score_items=score_items,
        reject_clauses=reject_clauses,
        tech_requirements=tech_requirements,
        qualification_requirements=qualification_requirements,
        full_text=full_text,
        page_count=page_count,
    )
