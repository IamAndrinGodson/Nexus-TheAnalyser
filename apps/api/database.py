"""
database.py — Async SQLAlchemy engine with env-based DB switching.

- DEV mode (default): SQLite via aiosqlite
- PROD mode: PostgreSQL via asyncpg (set DATABASE_URL env var)
"""

import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# ── Determine database URL ──
DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_SQLITE = not DATABASE_URL or DATABASE_URL.startswith("sqlite")

if USE_SQLITE:
    SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///./nexus.db"
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    # Postgres / other async DB
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        import db_models  # noqa: F401 — ensure all models are registered on Base
        await conn.run_sync(Base.metadata.create_all)


def get_db_info() -> dict:
    """Return info about the current database connection."""
    return {
        "backend": "sqlite" if USE_SQLITE else "postgresql",
        "url": SQLALCHEMY_DATABASE_URL.split("@")[-1] if "@" in SQLALCHEMY_DATABASE_URL else SQLALCHEMY_DATABASE_URL,
    }
