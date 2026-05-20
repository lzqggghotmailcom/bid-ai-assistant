from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import settings

# pgvector is only available with PostgreSQL
try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False
    Vector = None  # type: ignore

if settings.DATABASE_TYPE == "sqlite":
    DB_URL = settings.SQLITE_URL
    engine = create_async_engine(DB_URL, echo=settings.DEBUG)
else:
    DB_URL = settings.DATABASE_URL
    engine = create_async_engine(DB_URL, echo=settings.DEBUG, pool_size=20, max_overflow=10)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: add columns for payment/plan system (SQLite)
        if settings.DATABASE_TYPE == "sqlite":
            import logging
            _logger = logging.getLogger(__name__)
            migrations = [
                ("bids", "industry VARCHAR(50)"),
                ("bids", "free_generation_used BOOLEAN DEFAULT FALSE"),
                ("bids", "project_consumed BOOLEAN DEFAULT FALSE"),
                ("users", "credits_balance INTEGER DEFAULT 0"),
                ("users", "plan VARCHAR(20) DEFAULT 'free'"),
                ("users", "projects_remaining INTEGER DEFAULT 0"),
                ("users", "free_trial_used BOOLEAN DEFAULT FALSE"),
            ]
            for table, column_def in migrations:
                try:
                    await conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {column_def}"
                    )
                    _logger.info("Migration: added %s column to %s table", column_def.split()[0], table)
                except Exception:
                    pass  # Column already exists

