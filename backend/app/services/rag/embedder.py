from typing import List

from app.core.config import settings


class Embedder:
    """
    Singleton embedder using BGE-M3 (BAAI/bge-m3) via FlagEmbedding.

    Loads the model once on first use and reuses it for all subsequent calls.
    Returns 1024-dimensional dense vectors.
    """

    _instance = None
    _model = None

    def __new__(cls) -> "Embedder":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def _load_model(cls):
        """Lazy-load the BGE-M3 model. Thread-safe in practice for single-worker ASGI."""
        if cls._model is None:
            from FlagEmbedding import BGEM3FlagModel

            cls._model = BGEM3FlagModel(
                settings.EMBEDDING_MODEL,
                use_fp16=(settings.EMBEDDING_DEVICE != "cpu"),
                device=settings.EMBEDDING_DEVICE,
            )
        return cls._model

    def embed(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of texts into 1024-dim dense vectors.

        Args:
            texts: List of input strings to embed.

        Returns:
            List of embedding vectors, each a list of 1024 floats.
        """
        if not texts:
            return []

        model = self._load_model()
        batch_size = 32
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            output = model.encode(
                batch,
                batch_size=len(batch),
                max_length=8192,
            )
            dense_vecs = output["dense_vecs"]
            all_embeddings.extend(dense_vecs.tolist())

        return all_embeddings
