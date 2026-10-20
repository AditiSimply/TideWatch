import asyncio
from collections.abc import AsyncGenerator
import json
from pathlib import Path
from typing import Any, Dict
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
import app.db.session as db_session
import app.agents.tools as agent_tools
import app.api.routes.stream as stream_routes
from app.db.session import get_db
from app.main import app
from app.ml.predictor import Predictor

# Test database (file-based SQLite to allow concurrent transactions without StaticPool deadlocks)
TEST_DB_PATH = Path("./test_tidewatch.db")
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH.as_posix()}"

test_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},
)

test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Patch runtime singletons to use the shared test database
db_session.engine = test_engine
if hasattr(db_session.async_session_factory, "set_factory"):
    db_session.async_session_factory.set_factory(test_session_factory)
else:
    db_session.async_session_factory = test_session_factory
agent_tools.async_session_factory = db_session.async_session_factory
stream_routes.async_session_factory = db_session.async_session_factory


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(scope="session")
def predictor() -> Predictor:
    return Predictor()


@pytest.fixture(scope="session")
def valid_features() -> Dict[str, Any]:
    features_path = Path(settings.MODEL_ARTIFACTS_DIR) / "features.json"
    with open(features_path, "r") as f:
        feature_names = json.load(f)

    # Return valid default features
    return {feat: 100.0 for feat in feature_names}
