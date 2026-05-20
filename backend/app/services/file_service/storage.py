"""
File storage service.

Supports two backends, selected automatically based on environment
configuration:

* **Local filesystem** (default): stores files under ``UPLOAD_DIR``,
  organised by user and a UUID-based unique filename.

* **OSS (S3-compatible)**: activated when ``OSS_ENDPOINT``,
  ``OSS_BUCKET``, ``OSS_ACCESS_KEY`` and ``OSS_SECRET_KEY`` are all set.
  Uses *boto3* under the hood.

All public functions are synchronous so they can be called from both
FastAPI route handlers and Celery worker tasks.
"""

from __future__ import annotations

import os
import uuid
import logging
from pathlib import Path

from fastapi import UploadFile, HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowed file extensions
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS: set[str] = {".pdf", ".doc", ".docx"}

# ---------------------------------------------------------------------------
# OSS client (lazy, created once on first use)
# ---------------------------------------------------------------------------
_oss_client = None
_oss_enabled: bool | None = None


def _oss_is_configured() -> bool:
    """Return True when all four OSS env vars are set."""
    return bool(
        settings.OSS_ENDPOINT
        and settings.OSS_BUCKET
        and settings.OSS_ACCESS_KEY
        and settings.OSS_SECRET_KEY
    )


def _get_oss_client():
    """Return a boto3 S3 client; raise if OSS is not configured."""
    global _oss_client
    if _oss_client is None:
        import boto3

        _oss_client = boto3.client(
            "s3",
            endpoint_url=settings.OSS_ENDPOINT,
            aws_access_key_id=settings.OSS_ACCESS_KEY,
            aws_secret_access_key=settings.OSS_SECRET_KEY,
        )
    return _oss_client


def _oss_upload(file_path: str, object_key: str) -> str:
    """Upload a local file to OSS. Returns the object key / path."""
    client = _get_oss_client()
    client.upload_file(file_path, settings.OSS_BUCKET, object_key)
    logger.info("OSS upload: bucket=%s key=%s", settings.OSS_BUCKET, object_key)
    return object_key


def _oss_download(object_key: str, local_path: str) -> None:
    """Download an OSS object to a local path."""
    client = _get_oss_client()
    client.download_file(settings.OSS_BUCKET, object_key, local_path)


def _oss_delete(object_key: str) -> bool:
    """Delete an OSS object; returns True on success, False if not found."""
    client = _get_oss_client()
    try:
        client.delete_object(Bucket=settings.OSS_BUCKET, Key=object_key)
        return True
    except Exception:
        logger.exception("OSS delete failed: key=%s", object_key)
        return False


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_file_extension(filename: str) -> str:
    """Raise HTTPException if the file extension is not in the whitelist."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


def _validate_file_size(file: UploadFile) -> None:
    """Raise HTTPException if the file exceeds MAX_UPLOAD_SIZE_MB."""
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Read the file content to measure size.  For small files this is fine;
    # the upload itself would already be in memory/on-disk via Starlette.
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size / 1024 / 1024:.1f} MB). Maximum is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_upload(file: UploadFile, user_id: uuid.UUID) -> str:
    """
    Persist an uploaded file and return its relative storage path.

    Parameters
    ----------
    file : UploadFile
        The incoming file from a FastAPI multipart request.
    user_id : uuid.UUID
        Owning user.

    Returns
    -------
    str
        Relative path usable with ``get_file_path()``.  Format:
        ``{user_id}/{unique_id}_{original_filename}``.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided.",
        )

    _validate_file_extension(file.filename)
    _validate_file_size(file)

    # Build a unique filename to avoid collisions.
    safe_name = _sanitise_filename(file.filename)
    unique_name = f"{uuid.uuid4()}_{safe_name}"
    relative_path = f"{user_id}/{unique_name}"

    # ---- Local save --------------------------------------------------------
    local_dir = Path(settings.UPLOAD_DIR) / str(user_id)
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / unique_name

    try:
        content = file.file.read()
        local_path.write_bytes(content)
        logger.info("Saved upload: %s (%d bytes)", local_path, len(content))
    except Exception:
        logger.exception("Failed to write upload: %s", local_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file.",
        )

    # ---- OSS mirror (if configured) ----------------------------------------
    if _oss_is_configured():
        try:
            _oss_upload(str(local_path), relative_path)
        except Exception:
            logger.exception("OSS upload failed, but local copy preserved: %s", relative_path)

    return relative_path


def get_file_path(file_path: str) -> str:
    """
    Return the absolute local filesystem path for *file_path*.

    If the file lives only in OSS it will be downloaded to a local temp
    location first (with caching).
    """
    abs_path = os.path.join(settings.UPLOAD_DIR, file_path)

    if os.path.isfile(abs_path):
        return os.path.abspath(abs_path)

    # File not on local disk — maybe it is OSS-only; try to fetch it.
    if _oss_is_configured():
        local_dir = os.path.dirname(abs_path)
        os.makedirs(local_dir, exist_ok=True)
        try:
            _oss_download(file_path, abs_path)
            logger.info("Fetched from OSS: %s", file_path)
            return os.path.abspath(abs_path)
        except Exception:
            logger.exception("OSS download failed for: %s", file_path)

    raise FileNotFoundError(f"File not found: {file_path}")


def delete_file(file_path: str) -> bool:
    """
    Delete a file from both local storage and OSS (if configured).

    Returns True if the file was deleted from at least one backend.
    """
    deleted = False

    # Local
    local_path = os.path.join(settings.UPLOAD_DIR, file_path)
    try:
        if os.path.isfile(local_path):
            os.remove(local_path)
            deleted = True
            logger.info("Deleted local file: %s", local_path)
    except OSError:
        logger.exception("Failed to delete local file: %s", local_path)

    # OSS
    if _oss_is_configured():
        if _oss_delete(file_path):
            deleted = True

    # Clean up empty user directories
    _cleanup_empty_dirs(local_path)

    return deleted


def file_exists(file_path: str) -> bool:
    """Check whether *file_path* exists locally or in OSS."""
    local_path = os.path.join(settings.UPLOAD_DIR, file_path)
    if os.path.isfile(local_path):
        return True

    if _oss_is_configured():
        client = _get_oss_client()
        try:
            client.head_object(Bucket=settings.OSS_BUCKET, Key=file_path)
            return True
        except Exception:
            pass

    return False


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _sanitise_filename(filename: str) -> str:
    """
    Replace characters that are problematic in file paths with underscores.
    Keeps Unicode letters, digits, dots, dashes, and underscores.
    """
    safe: list[str] = []
    for ch in filename:
        if ch.isalnum() or ch in (".", "-", "_"):
            safe.append(ch)
        elif ch in (" ", "\t"):
            safe.append("_")
        else:
            safe.append("_")
    return "".join(safe).strip("_") or "unnamed"


def _cleanup_empty_dirs(local_path: str) -> None:
    """Remove empty parent directories up to (but not including) UPLOAD_DIR."""
    upload_root = os.path.abspath(settings.UPLOAD_DIR)
    current = os.path.dirname(os.path.abspath(local_path))

    while current.startswith(upload_root) and current != upload_root:
        try:
            if os.path.isdir(current) and not os.listdir(current):
                os.rmdir(current)
                current = os.path.dirname(current)
            else:
                break
        except OSError:
            break
