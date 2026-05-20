import json
import math
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import HAS_PGVECTOR
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument


async def insert_chunks(
    db: AsyncSession,
    chunks: List[dict],
    embeddings: List[List[float]],
) -> None:
    if not chunks:
        return

    chunk_objs: List[KnowledgeChunk] = []
    for chunk_dict, embedding in zip(chunks, embeddings):
        embed_value = embedding if HAS_PGVECTOR else json.dumps(embedding)
        chunk_obj = KnowledgeChunk(
            document_id=chunk_dict["document_id"],
            chunk_index=chunk_dict["chunk_index"],
            content=chunk_dict["content"],
            content_hash=chunk_dict.get("content_hash"),
            section_title=chunk_dict.get("section_title"),
            embedding=embed_value,
        )
        chunk_objs.append(chunk_obj)

    db.add_all(chunk_objs)
    await db.commit()


async def search(
    db: AsyncSession,
    query_embedding: List[float],
    user_id: UUID,
    top_k: int = 5,
    doc_type: Optional[str] = None,
) -> List[dict]:
    if HAS_PGVECTOR:
        return await _search_pgvector(db, query_embedding, user_id, top_k, doc_type)
    else:
        return await _search_sqlite(db, query_embedding, user_id, top_k, doc_type)


async def _search_pgvector(
    db: AsyncSession,
    query_embedding: List[float],
    user_id: UUID,
    top_k: int,
    doc_type: Optional[str],
) -> List[dict]:
    embedding_literal = "[" + ",".join(str(v) for v in query_embedding) + "]"

    query_sql = """
        SELECT kc.id, kc.document_id, kc.content, kc.section_title, kc.chunk_index,
               1 - (kc.embedding <=> :embedding) AS score
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kc.document_id = kd.id
        WHERE kd.user_id = CAST(:user_id AS uuid)
    """
    params: dict = {"embedding": embedding_literal, "user_id": str(user_id), "top_k": top_k}

    if doc_type is not None:
        query_sql += " AND kd.doc_type = :doc_type"
        params["doc_type"] = doc_type

    query_sql += " ORDER BY kc.embedding <=> :embedding LIMIT :top_k"
    result = await db.execute(text(query_sql), params)
    rows = result.fetchall()

    return [
        {"id": row[0], "document_id": row[1], "content": row[2],
         "section_title": row[3], "chunk_index": row[4], "score": float(row[5])}
        for row in rows
    ]


async def _search_sqlite(
    db: AsyncSession,
    query_embedding: List[float],
    user_id: UUID,
    top_k: int,
    doc_type: Optional[str],
) -> List[dict]:
    # In SQLite mode, load all chunks for the user and compute cosine in Python
    stmt = (
        select(KnowledgeChunk)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .where(KnowledgeDocument.user_id == user_id)
    )
    if doc_type is not None:
        stmt = stmt.where(KnowledgeDocument.doc_type == doc_type)

    result = await db.execute(stmt)
    chunks = result.scalars().all()

    scored = []
    for chunk in chunks:
        if chunk.embedding is None:
            continue
        try:
            emb = json.loads(chunk.embedding) if isinstance(chunk.embedding, str) else chunk.embedding
        except (json.JSONDecodeError, TypeError):
            continue
        score = _cosine_similarity(query_embedding, emb)
        scored.append((chunk, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_k]

    return [
        {"id": chunk.id, "document_id": chunk.document_id, "content": chunk.content,
         "section_title": chunk.section_title, "chunk_index": chunk.chunk_index, "score": score}
        for chunk, score in top
    ]


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
