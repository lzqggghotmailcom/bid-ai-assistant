from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .embedder import Embedder
from .vector_store import search as vector_search

# ---------------------------------------------------------------------------
# Prompt template (P3 from PROMPTS.md)
# ---------------------------------------------------------------------------
P3_PROMPT = """根据以下应标章节的标题和评分要求，构造3-5个检索查询，用于从企业知识库中检索相关的历史标书内容。

章节标题：{section_title}
评分要求：{score_criteria}
公司名称：{company_name}

输出：每行一个检索query，尽量多样化（从技术方案、项目实施、公司经验等不同角度）"""

# ---------------------------------------------------------------------------
# Reranker singleton cache
# ---------------------------------------------------------------------------
_reranker_model = None


def _get_reranker():
    """Lazy-load the BGE-Reranker v2 M3 model once."""
    global _reranker_model
    if _reranker_model is None:
        from FlagEmbedding import FlagReranker

        _reranker_model = FlagReranker(
            "BAAI/bge-reranker-v2-m3",
            use_fp16=False,
        )
    return _reranker_model


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def retrieve(
    db: AsyncSession,
    section_title: str,
    score_criteria: str,
    user_id: UUID,
    top_k: int = 5,
    llm_client: Optional[object] = None,
    company_name: str = "",
    doc_type: Optional[str] = None,
) -> List[dict]:
    """
    Advanced retrieval pipeline:

    1. Generate 3-5 search queries from section title + criteria via LLM (P3 prompt).
    2. Embed each query with BGE-M3.
    3. Vector-search each query, merge and deduplicate results.
    4. Re-rank merged candidates with BGE-Reranker v2 M3.
    5. Return the top_k final results.

    Returns a list of dicts with keys:
        id, document_id, content, section_title, chunk_index, score
        (and optionally rerank_score when re-ranking was applied).
    """
    embedder = Embedder()

    # ---- Step 1: Generate diverse search queries ----
    if llm_client is not None:
        prompt = P3_PROMPT.format(
            section_title=section_title,
            score_criteria=score_criteria,
            company_name=company_name or "我公司",
        )
        try:
            llm_response = await llm_client.chat(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=256,
            )
            llm_response = llm_response.content
        except Exception:
            llm_response = ""
        queries = _parse_queries(llm_response)
    else:
        queries = [f"{section_title} {score_criteria}"]

    if not queries:
        queries = [f"{section_title} {score_criteria}"]

    # ---- Step 2: Embed queries ----
    query_embeddings = embedder.embed(queries)

    # ---- Step 3: Search & merge ----
    # Fetch more candidates than needed; re-ranker will narrow them down.
    fetch_k = max(top_k * 4, 20)

    merged: dict[str, dict] = {}
    for q_emb in query_embeddings:
        results = await vector_search(
            db,
            q_emb,
            user_id,
            top_k=fetch_k,
            doc_type=doc_type,
        )
        for r in results:
            key = f"{r['document_id']}_{r['chunk_index']}"
            if key not in merged or r["score"] > merged[key]["score"]:
                merged[key] = r

    candidates = sorted(
        merged.values(), key=lambda x: x["score"], reverse=True
    )

    # ---- Step 4: Re-rank ----
    if len(candidates) > top_k:
        rerank_query = f"{section_title}: {score_criteria}"
        candidates = _rerank(candidates, rerank_query, top_k=min(len(candidates), top_k * 3))

    # ---- Step 5: Return top_k ----
    return candidates[:top_k]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_queries(llm_text: str) -> List[str]:
    """Extract query strings from LLM output (one per line, strip numbering)."""
    queries: List[str] = []
    for line in llm_text.strip().split("\n"):
        q = line.strip()
        if not q:
            continue
        # Remove common numbering prefixes: "1.", "1、", "1)", "- ", etc.
        q = q.lstrip("0123456789.、) -")
        q = q.strip()
        if q and len(q) >= 2:
            queries.append(q)
    return queries[:5]


def _rerank(
    results: List[dict],
    query: str,
    top_k: int = 15,
) -> List[dict]:
    """Re-rank *results* using BGE-Reranker and return the top *top_k*."""
    if not results:
        return results

    reranker = _get_reranker()
    pairs = [[query, r["content"]] for r in results]
    scores = reranker.compute_score(pairs)

    # compute_score returns a single float for one pair, list for multiple
    if isinstance(scores, float):
        scores = [scores]

    for i, score in enumerate(scores):
        results[i]["rerank_score"] = float(score)

    results.sort(key=lambda x: x.get("rerank_score", x["score"]), reverse=True)
    return results[:top_k]
