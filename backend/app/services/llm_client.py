"""
Shared LLM client wrapper around the OpenAI SDK, pointed at DeepSeek.

Provides:
- `chat()`: single-turn chat with auto-retry and exponential backoff
- Token usage logging
- Configurable model, temperature, max_tokens, and timeout

Usage:
    from app.services.llm_client import get_llm_client
    client = get_llm_client()
    response = await client.chat(messages=[{"role": "user", "content": "Hello"}])
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMResponse:
    """Wrapper for LLM chat response with .content accessor."""
    __slots__ = ("content", "usage", "model", "elapsed")

    def __init__(self, content: str, usage, model: str, elapsed: float):
        self.content = content
        self.usage = usage
        self.model = model
        self.elapsed = elapsed


# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------
MAX_RETRIES: int = 3
BASE_DELAY_SECONDS: float = 1.0
MAX_DELAY_SECONDS: float = 30.0
DEFAULT_TIMEOUT_SECONDS: float = 120.0
DEFAULT_TEMPERATURE: float = 0.3
DEFAULT_MAX_TOKENS: int = 8000


class LLMClient:
    """
    Wrapper around OpenAI-compatible SDK, configured for DeepSeek.

    Handles retries with exponential backoff, timeouts, and token-usage logging.
    """

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._api_key = api_key if api_key is not None else settings.DEEPSEEK_API_KEY
        self._base_url = base_url if base_url is not None else settings.DEEPSEEK_BASE_URL
        self._default_model = default_model if default_model is not None else settings.DEEPSEEK_V4_MODEL
        self._timeout = timeout

        self._client = AsyncOpenAI(
            api_key=self._api_key,
            base_url=self._base_url,
            timeout=self._timeout,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        response_format: Optional[dict] = None,
    ) -> "LLMResponse":
        """
        Send a chat completion request and return an LLMResponse.

        Automatically retries on transient failures with exponential backoff.

        Args:
            messages: List of message dicts with "role" and "content".
            model: Override the default model.
            temperature: Sampling temperature (0.0–2.0).
            max_tokens: Maximum tokens in the response.
            response_format: Optional OpenAI-style response_format dict.

        Returns:
            LLMResponse with .content (str), .usage, and .model attributes.

        Raises:
            RuntimeError: After all retries are exhausted.
        """
        resolved_model = model or self._default_model
        last_exception: Optional[Exception] = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                return await self._call(
                    messages=messages,
                    model=resolved_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format,
                )
            except Exception as exc:
                last_exception = exc
                if attempt < MAX_RETRIES and self._is_retryable(exc):
                    delay = min(BASE_DELAY_SECONDS * (2 ** (attempt - 1)), MAX_DELAY_SECONDS)
                    logger.warning(
                        "LLM call attempt %d/%d failed (%s). Retrying in %.1fs...",
                        attempt,
                        MAX_RETRIES,
                        exc,
                        delay,
                    )
                    await asyncio.sleep(delay)
                else:
                    break

        raise RuntimeError(
            f"LLM call failed after {attempt}/{MAX_RETRIES} attempts. "
            f"Last error: {last_exception}"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _call(
        self,
        *,
        messages: list[dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        response_format: Optional[dict] = None,
    ) -> "LLMResponse":
        started_at = time.monotonic()
        kwargs = dict(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if response_format is not None:
            kwargs["response_format"] = response_format

        response = await self._client.chat.completions.create(**kwargs)
        elapsed = time.monotonic() - started_at

        usage = response.usage
        if usage is not None:
            logger.info(
                "LLM usage — model=%s  prompt_tokens=%d  completion_tokens=%d  "
                "total_tokens=%d  elapsed=%.2fs",
                model,
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
                elapsed,
            )
        else:
            logger.info("LLM call completed — model=%s  elapsed=%.2fs  (no usage info)", model, elapsed)

        content = response.choices[0].message.content
        if content is None:
            raise RuntimeError("LLM returned empty content")
        return LLMResponse(content=content, usage=usage, model=model, elapsed=elapsed)

    @staticmethod
    def _is_retryable(exc: Exception) -> bool:
        """
        Determine whether an exception is transient and worth retrying.

        Handles both the error types raised by the ``openai`` SDK and
        low-level network exceptions.
        """
        import httpx

        # httpx / network-level
        if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError)):
            return True
        if isinstance(exc, (ConnectionError, TimeoutError, asyncio.TimeoutError)):
            return True

        # openai SDK structured errors
        exc_str = str(exc).lower()
        retryable_keywords = ("rate", "timeout", "server error", "overloaded", "capacity", "503", "502", "429")
        for keyword in retryable_keywords:
            if keyword in exc_str:
                return True

        # Check for OpenAI error attributes
        if hasattr(exc, "status_code"):
            status = getattr(exc, "status_code")
            if status is not None and status >= 500:
                return True
            if status == 429:
                return True

        return False


# ---------------------------------------------------------------------------
# Singleton / helper
# ---------------------------------------------------------------------------

_llm_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """Return a shared LLMClient instance (lazy singleton)."""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
