"""
Table extraction from PDF documents using PyMuPDF.

Detects tables on each page, handles merged cells heuristically,
and optionally uses LLM to repair tables that span multiple pages
or contain complex merged-cell layouts.

Exports:
    extract_tables(file_path: str) -> list[dict]
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import fitz  # PyMuPDF

from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Minimum number of text blocks on a page to be considered a possible table
MIN_BLOCKS_FOR_TABLE = 5

# Maximum gap (in points) between consecutive lines to consider them
# part of the same table
MAX_LINE_GAP = 12.0

# Table repair prompt template
TABLE_REPAIR_PROMPT = """你是一个表格数据处理专家。以下是PDF中提取的原始表格数据，可能包含合并单元格导致的重复或错位问题，以及跨页表格拆分问题。

请将以下原始表格数据处理为规范的JSON表格格式。

## 要求
1. 识别表头行
2. 处理合并单元格（将重复的空值或占位符合并为合理的数据）
3. 如果有多张表格，请分别标注

## 原始表格数据
{raw_table_data}

## 输出格式
[
  {{
    "table_index": 0,
    "headers": ["列1", "列2", "列3"],
    "caption": "表格标题（如果有的话）",
    "rows": [
      ["数据1", "数据2", "数据3"],
      ["数据4", "数据5", "数据6"]
    ]
  }}
]

请直接输出JSON，不需要额外的解释。"""

# Maximum characters to send to LLM for table repair
MAX_TABLE_TEXT_LENGTH = 30_000


# ---------------------------------------------------------------------------
# Table extraction from a single page
# ---------------------------------------------------------------------------


def _extract_tables_from_page(page: fitz.Page, page_number: int) -> list[dict[str, Any]]:
    """
    Extract tables from a single PDF page using PyMuPDF's table detection.

    PyMuPDF's ``find_tables()`` uses a heuristic line-detection algorithm.
    Results may be imperfect for tables with merged cells or no visible borders.

    Returns a list of table dicts with keys:
        page, table_index, bbox, headers, rows, raw_cells
    """
    tables: list[dict[str, Any]] = []

    try:
        detected = page.find_tables()
    except Exception:
        logger.warning("find_tables() failed on page %d; falling back to text blocks.", page_number)
        return _extract_tables_from_text_blocks(page, page_number)

    if detected is None or len(detected.tables) == 0:
        return []

    for idx, table in enumerate(detected.tables):
        rows: list[list[str]] = []
        raw_cells: list[list[str]] = []

        for row in table.extract():
            cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
            raw_cells.append(cleaned_row)
            # Filter out fully empty rows
            if any(cleaned_row):
                rows.append(cleaned_row)

        if not rows:
            continue

        # Separate header (first non-empty row) from body
        headers = rows[0] if rows else []
        body = rows[1:] if len(rows) > 1 else []

        tables.append(
            {
                "page": page_number,
                "table_index": idx,
                "bbox": list(table.bbox) if table.bbox else [],
                "headers": headers,
                "rows": body,
                "raw_cells": raw_cells,
            }
        )

    return tables


def _extract_tables_from_text_blocks(page: fitz.Page, page_number: int) -> list[dict[str, Any]]:
    """
    Fallback: attempt to reconstruct table structure from text blocks
    when PyMuPDF's native table detection fails.

    Groups text blocks by their vertical position to form rows.
    """
    blocks = page.get_text("blocks")
    if len(blocks) < MIN_BLOCKS_FOR_TABLE:
        return []

    # Sort blocks by y-coordinate, then x-coordinate (top-to-bottom, left-to-right)
    blocks_sorted = sorted(blocks, key=lambda b: (round(b[1], 1), b[0]))

    # Group blocks into rows based on y-coordinate proximity
    rows: list[list[str]] = []
    current_row: list[str] = []
    current_y = -1.0

    for block in blocks_sorted:
        x0, y0, x1, y1, text, *_ = block
        text = text.strip()
        if not text:
            continue

        if current_y < 0:
            current_y = y0

        if abs(y0 - current_y) > MAX_LINE_GAP:
            if current_row:
                rows.append(current_row)
            current_row = [text]
            current_y = y0
        else:
            current_row.append(text)

    if current_row:
        rows.append(current_row)

    if len(rows) < 2:
        return []

    return [
        {
            "page": page_number,
            "table_index": 0,
            "bbox": list(page.rect),
            "headers": rows[0],
            "rows": rows[1:],
            "raw_cells": rows,
        }
    ]


# ---------------------------------------------------------------------------
# Cross-page table merging
# ---------------------------------------------------------------------------


def _merge_across_pages(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Detect and merge tables that span consecutive pages.

    A heuristic: if the last row of one page's table and the first row
    of the next page's table share similar column counts, and the
    subsequent page's headers look like continuation data (not new
    headers), merge them.
    """
    if len(tables) <= 1:
        return tables

    merged: list[dict[str, Any]] = []
    skip_indices: set[int] = set()

    for i, current in enumerate(tables):
        if i in skip_indices:
            continue
        if i + 1 >= len(tables):
            merged.append(current)
            break

        next_table = tables[i + 1]
        curr_page = current["page"]
        next_page = next_table["page"]

        # Only consider consecutive pages
        if next_page != curr_page + 1:
            merged.append(current)
            continue

        # Check if next table is likely a continuation
        curr_cols = len(current["headers"]) if current["headers"] else 0
        next_cols = len(next_table["headers"]) if next_table["headers"] else 0

        # If column counts match and next page has no distinct headers,
        # treat as continuation
        if curr_cols == next_cols and curr_cols > 0:
            # Check if next page's first row looks like a header
            next_headers_set = set(h.lower().strip() for h in next_table["headers"] if h)
            curr_headers_set = set(h.lower().strip() for h in current["headers"] if h)
            overlap = len(next_headers_set & curr_headers_set) if next_headers_set else 0

            # Low header overlap suggests it's a continuation (not a repeated header)
            if overlap < len(next_headers_set) * 0.5:
                merged_table = dict(current)
                merged_table["rows"] = current["rows"] + next_table["rows"]
                merged_table["raw_cells"] = current.get("raw_cells", []) + next_table.get("raw_cells", [])
                merged_table["page"] = f"{curr_page}-{next_page}"
                merged.append(merged_table)
                skip_indices.add(i + 1)
                continue

        merged.append(current)

    return merged


# ---------------------------------------------------------------------------
# LLM-based table repair
# ---------------------------------------------------------------------------


async def _repair_tables_with_llm(
    tables: list[dict[str, Any]],
    llm_client: LLMClient,
    pages: list[int],
) -> list[dict[str, Any]]:
    """
    Send extracted table data to the LLM for cleaning:
    - Merge-cell normalization
    - Table identification and labeling
    - Cross-page deduplication
    """
    # Serialize raw cells into a text representation for the LLM
    parts: list[str] = []
    for t in tables:
        parts.append(f"--- 第{t['page']}页 表格{t.get('table_index', 0)} ---")
        raw = t.get("raw_cells", [])
        for row in raw:
            parts.append(" | ".join(str(c) for c in row))
        parts.append("")

    raw_text = "\n".join(parts)

    if len(raw_text) > MAX_TABLE_TEXT_LENGTH:
        logger.warning("Table text too long (%d chars); truncating for LLM repair.", len(raw_text))
        raw_text = raw_text[:MAX_TABLE_TEXT_LENGTH]

    prompt = TABLE_REPAIR_PROMPT.format(raw_table_data=raw_text)

    messages = [
        {"role": "system", "content": "你是一个表格数据处理专家，请严格按JSON格式输出。"},
        {"role": "user", "content": prompt},
    ]

    logger.info("Sending table repair request to LLM (%d chars).", len(raw_text))

    try:
        response_text = await llm_client.chat(messages=messages, temperature=0.1)
    except Exception:
        logger.exception("LLM table repair call failed; returning raw tables.")
        return tables

    # Parse the repaired JSON
    import json
    import re

    response_text = response_text.strip()
    response_text = re.sub(r"^```(?:json)?\s*\n?", "", response_text)
    response_text = re.sub(r"\n?```\s*$", "", response_text)
    response_text = re.sub(r",\s*([}\]])", r"\1", response_text)

    try:
        repaired = json.loads(response_text)
        if isinstance(repaired, list):
            return repaired
        logger.warning("LLM returned unexpected structure; keeping raw tables.")
    except json.JSONDecodeError:
        logger.exception("Failed to parse LLM-repaired table JSON; keeping raw tables.")

    return tables


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def extract_tables(
    file_path: str,
    *,
    llm_client: Optional[LLMClient] = None,
    use_llm_repair: bool = True,
    pages: Optional[list[int]] = None,
) -> list[dict[str, Any]]:
    """
    Extract tables from a PDF document.

    Uses PyMuPDF's built-in table detection with a text-block fallback.
    Optionally repairs merged cells and cross-page tables via LLM.

    Args:
        file_path: Path to the PDF file.
        llm_client: Optional LLMClient for table repair. If not provided
                     and ``use_llm_repair`` is True, a default client is created.
        use_llm_repair: Whether to send extracted tables to the LLM for
                         merge-cell / cross-page normalization.
        pages: Specific page numbers (1-indexed) to extract tables from.
               If None, all pages are processed.

    Returns:
        A list of table dicts. When LLM repair is used, each dict contains:
            table_index, headers, caption, rows.
        Without LLM repair, each dict additionally contains:
            page, bbox, raw_cells.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Table extraction only supports PDF files. Got: {path.suffix}")

    doc = fitz.open(str(path))
    all_tables: list[dict[str, Any]] = []

    try:
        target_pages = pages if pages else list(range(1, len(doc) + 1))

        for page_num in target_pages:
            if page_num < 1 or page_num > len(doc):
                logger.warning("Page %d out of range (1-%d); skipped.", page_num, len(doc))
                continue

            page = doc.load_page(page_num - 1)  # 0-indexed
            page_tables = _extract_tables_from_page(page, page_num)
            all_tables.extend(page_tables)

        logger.info("Extracted %d raw table(s) from %d page(s).", len(all_tables), len(target_pages))

        # Merge cross-page tables
        all_tables = _merge_across_pages(all_tables)

        # LLM repair
        if use_llm_repair and all_tables:
            if llm_client is None:
                from app.services.llm_client import get_llm_client
                llm_client = get_llm_client()
            all_tables = await _repair_tables_with_llm(all_tables, llm_client, target_pages)

    finally:
        doc.close()

    return all_tables
