from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import init_db
from .routers import auth, bids, knowledge, payment

import logging
import secrets

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate critical settings
    if not settings.SECRET_KEY:
        if settings.DEBUG:
            settings.SECRET_KEY = secrets.token_urlsafe(32)
            logger.warning("SECRET_KEY not set — generated random key for development")
        else:
            raise RuntimeError("SECRET_KEY must be set in production")
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# Parse CORS origins from comma-separated config
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bids.router)
app.include_router(knowledge.router)
app.include_router(payment.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
