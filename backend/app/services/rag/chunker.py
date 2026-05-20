import hashlib
import re
from typing import List


# Patterns for Chinese section headings, ordered by priority (most specific first).
# Each tuple is (compiled_regex, grouping priority).
SECTION_PATTERNS: List[re.Pattern] = [
    re.compile(r"^[（(]\s*([一二三四五六七八九十]+)\s*[）)]\s*(.*)"),   # （一） / (一)
    re.compile(r"^([一二三四五六七八九十]+)[、，,]\s*(.*)"),              # 一、 / 一,
    re.compile(r"^[（(]\s*(\d+)\s*[）)]\s*(.*)"),                         # (1) / （1）
    re.compile(r"^(\d+)[.、，,]\s*(.*)"),                                   # 1. / 1、
]

_MAX_SECTION_TITLE_LEN = 100  # Section titles are short; content lines are much longer.


class Chunker:
    """
    Splits documents by Chinese section headings and then subdivides sections
    into overlapping chunks of 800-1200 characters with 100-char overlap.
    """

    def __init__(
        self,
        min_chars: int = 800,
        max_chars: int = 1200,
        overlap: int = 100,
    ):
        self.min_chars = min_chars
        self.max_chars = max_chars
        self.overlap = overlap

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk(self, text: str) -> List[dict]:
        """
        Split *text* into chunks, each annotated with its section title.

        Returns a list of dicts with keys:
            content, section_title, chunk_index, content_hash
        """
        sections = self._partition_by_headings(text)
        chunks: List[dict] = []
        chunk_index = 0

        for section_title, section_body in sections:
            for chunk_content in self._split_section(section_body):
                content_hash = hashlib.sha256(
                    chunk_content.encode("utf-8")
                ).hexdigest()
                chunks.append(
                    {
                        "content": chunk_content,
                        "section_title": section_title,
                        "chunk_index": chunk_index,
                        "content_hash": content_hash,
                    }
                )
                chunk_index += 1

        return chunks

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _partition_by_headings(self, text: str) -> List[tuple]:
        """
        Walk through lines, detect section headings, and group content
        under the most recent heading.
        """
        lines = text.split("\n")
        sections: List[tuple] = []   # list of (section_title, section_body)
        current_title = ""
        current_body: List[str] = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            matched_title = self._match_heading(stripped)
            if matched_title is not None:
                # Flush previous section
                body_text = "\n".join(current_body).strip()
                if body_text:
                    sections.append((current_title, body_text))
                current_title = matched_title
                current_body = []
            else:
                current_body.append(stripped)

        # Flush the final section
        body_text = "\n".join(current_body).strip()
        if body_text:
            sections.append((current_title, body_text))

        return sections

    @staticmethod
    def _match_heading(line: str) -> str | None:
        """Return the normalized heading text if *line* looks like a section heading."""
        if len(line) > _MAX_SECTION_TITLE_LEN:
            return None

        for pattern in SECTION_PATTERNS:
            m = pattern.match(line)
            if m:
                return line  # keep the original line as-is for readability
        return None

    def _split_section(self, text: str) -> List[str]:
        """
        Split a section body into fixed-size overlapping chunks.
        Attempts to break at natural boundaries (double-newline, newline,
        Chinese period, semicolon, comma).
        """
        text = text.strip()
        if not text:
            return []

        if len(text) <= self.max_chars:
            return [text]

        chunks: List[str] = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + self.max_chars, text_len)

            if end < text_len:
                # Try to find a natural break point within the allowed range
                end = self._find_break_point(text, start, end)

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # Advance with overlap; clamp to text_len to avoid infinite loop
            start = max(start, end - self.overlap)
            if start >= text_len - self.min_chars // 2:
                # Remaining text is short enough — stop splitting
                break

        return chunks

    def _find_break_point(self, text: str, start: int, end: int) -> int:
        """Find a natural break position between *start* + min_chars and *end*."""
        search_start = start + self.min_chars
        if search_start >= end:
            return end

        for separator in ("\n\n", "\n", "。", "；", "，", "、", ". ", " "):
            pos = text.rfind(separator, search_start, end)
            if pos > search_start:
                return pos + len(separator)

        return end
