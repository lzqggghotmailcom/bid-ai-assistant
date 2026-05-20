"""
Auth Router

Endpoints:
  POST /api/v1/auth/register   - Create user, return JWT
  POST /api/v1/auth/login      - Verify credentials, return JWT
  GET  /api/v1/user/profile    - Get current user profile
"""

import time
import uuid
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["auth"])
security_scheme = HTTPBearer(auto_error=False)

COOKIE_KEY = "auth_token"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

# Rate limiting (in-memory; use Redis for multi-worker deployments)
_rate_limits: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX = 10      # max requests per window


def _check_rate_limit(key: str) -> None:
    """Raise 429 if the key has exceeded the rate limit."""
    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW
    _rate_limits[key] = [t for t in _rate_limits[key] if t > window_start]
    if len(_rate_limits[key]) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请稍后再试",
        )
    _rate_limits[key].append(now)


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    company_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserProfileResponse(BaseModel):
    id: str
    email: str
    company_name: Optional[str]
    role: str
    plan: str
    projects_remaining: int
    free_trial_used: bool
    created_at: str


# ---------------------------------------------------------------------------
# JWT Dependency
# ---------------------------------------------------------------------------

def _resolve_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    auth_token: str | None = Cookie(None, alias=COOKIE_KEY),
) -> str:
    """Resolve JWT from Bearer header or httpOnly cookie."""
    token = None
    if credentials:
        token = credentials.credentials
    if not token and auth_token:
        token = auth_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


async def get_current_user(
    token: str = Depends(_resolve_token),
) -> User:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header or httpOnly cookie, then returns the
    corresponding User object.

    Raises 401 if the token is missing, invalid, or the user does not exist.
    """
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register(request: Request, req: RegisterRequest):
    """
    Register a new user account.

    Creates a new user with bcrypt-hashed password and sets an httpOnly
    cookie with the JWT.
    """
    _check_rate_limit(f"register:{request.client.host if request.client else 'unknown'}")

    async with async_session() as session:
        # Check for existing user
        result = await session.execute(
            select(User).where(User.email == req.email)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

        # Create user
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        user = User(
            id=user_id,
            email=req.email,
            password_hash=hash_password(req.password),
            company_name=req.company_name,
            role="user",
            created_at=now,
            updated_at=now,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        token = create_access_token(data={"sub": str(user.id)})

        logger.info("User registered: %s", user.email)

        response = Response(status_code=status.HTTP_201_CREATED)
        response.set_cookie(
            key=COOKIE_KEY,
            value=token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="lax",
            path="/",
        )
        return response


@router.post("/auth/login")
async def login(request: Request, req: LoginRequest):
    """
    Authenticate a user with email and password.

    Sets an httpOnly cookie with the JWT and returns the user profile.
    """
    _check_rate_limit(f"login:{request.client.host if request.client else 'unknown'}")

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.email == req.email)
        )
        user = result.scalar_one_or_none()

        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(data={"sub": str(user.id)})

        logger.info("User logged in: %s", user.email)

        response = Response()
        response.set_cookie(
            key=COOKIE_KEY,
            value=token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="lax",
            path="/",
        )
        return response


@router.post("/auth/logout")
async def logout():
    """Clear the auth cookie."""
    response = Response()
    response.delete_cookie(key=COOKIE_KEY, path="/")
    return response


@router.get("/user/profile", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """
    Get the authenticated user's profile.
    """
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        company_name=current_user.company_name,
        role=current_user.role,
        plan=current_user.plan,
        projects_remaining=current_user.projects_remaining,
        free_trial_used=current_user.free_trial_used,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_user(user: User) -> dict:
    """Serialize a User model to a dict for the auth response."""
    return {
        "id": user.id,
        "email": user.email,
        "company_name": user.company_name,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
