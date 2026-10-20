from collections.abc import AsyncGenerator
from urllib.parse import urlparse, parse_qs
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings
from app.core.logging import logger

connect_args = {}
engine_kwargs = {
    "echo": settings.DB_ECHO,
    "future": True,
}

raw_url = settings.async_database_url

# Handle PostgreSQL specific connection args (e.g., Neon Postgres sslmode=require)
if "postgresql" in raw_url:
    # If using pooled connection string on Neon
    parsed = urlparse(raw_url)
    qs = parse_qs(parsed.query)
    if "sslmode" in qs and qs["sslmode"][0] == "require":
        connect_args["ssl"] = "require"

    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    engine_kwargs["connect_args"] = connect_args
elif "sqlite" in raw_url:
    # SQLite async does not support pool_size / max_overflow
    pass

engine = create_async_engine(
    raw_url,
    **engine_kwargs,
)

_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class SessionFactoryProxy:
    def __init__(self, factory):
        self._factory = factory

    def __call__(self, *args, **kwargs):
        return self._factory(*args, **kwargs)

    def set_factory(self, factory):
        self._factory = factory


async_session_factory = SessionFactoryProxy(_session_factory)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
