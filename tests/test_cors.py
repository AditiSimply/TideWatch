"""
tests/test_cors.py
──────────────────
CORS preflight and cross-origin request tests.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cors_preflight_allowed_origin(async_client: AsyncClient):
    """OPTIONS preflight from a known frontend origin should return CORS headers."""
    resp = await async_client.options(
        "/api/v1/stats/overview",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    # FastAPI/Starlette returns 200 for OPTIONS when CORS is configured
    assert resp.status_code in (200, 204)
    assert "access-control-allow-origin" in resp.headers
    assert resp.headers["access-control-allow-origin"] in (
        "http://localhost:5173",
        "*",
    )


@pytest.mark.asyncio
async def test_cors_allow_credentials(async_client: AsyncClient):
    """Regular GET request should include CORS allow-credentials header."""
    resp = await async_client.get(
        "/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    # allow-credentials must be present when allow_credentials=True in middleware
    assert resp.headers.get("access-control-allow-credentials", "").lower() == "true"


@pytest.mark.asyncio
async def test_cors_preflight_unknown_origin(async_client: AsyncClient):
    """
    Preflight from an unlisted origin — CORS middleware should still respond
    but without the allow-origin echo (or it may be omitted).
    This test just ensures the server doesn't crash.
    """
    resp = await async_client.options(
        "/api/v1/stats/overview",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Server should respond (not crash); CORS header should NOT echo the evil origin
    assert resp.status_code in (200, 204, 400)
    allowed = resp.headers.get("access-control-allow-origin", "")
    assert "evil.example.com" not in allowed


@pytest.mark.asyncio
async def test_health_endpoint_returns_llm_info(async_client: AsyncClient):
    """Health endpoint should include LLM provider info."""
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "llm" in data
    assert "provider" in data["llm"]
    assert "healthy" in data["llm"]
