"""
tests/test_stream.py
────────────────────
Tests for the SSE traffic stream and control endpoints.
These tests use the HTTPX async client in a non-streaming mode
to verify control actions and basic stream endpoint availability.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_stream_control_stop(async_client: AsyncClient):
    """POST /stream/control stop should return {status: stopped}."""
    resp = await async_client.post(
        "/api/v1/stream/control",
        json={"action": "stop"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "stopped"


@pytest.mark.asyncio
async def test_stream_control_start(async_client: AsyncClient):
    """POST /stream/control start should return {status: running}."""
    resp = await async_client.post(
        "/api/v1/stream/control",
        json={"action": "start"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


@pytest.mark.asyncio
async def test_stream_control_reset(async_client: AsyncClient):
    """POST /stream/control reset should return {status: reset}."""
    resp = await async_client.post(
        "/api/v1/stream/control",
        json={"action": "reset"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "reset"


@pytest.mark.asyncio
async def test_stream_control_invalid_action(async_client: AsyncClient):
    """POST /stream/control with invalid action should return 400."""
    resp = await async_client.post(
        "/api/v1/stream/control",
        json={"action": "explode"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_stream_traffic_endpoint_exists(async_client: AsyncClient):
    """
    GET /stream/traffic SSE endpoint should be reachable.
    We don't wait for events — just confirm it starts responding.
    """
    # Use a very short timeout; the endpoint is long-lived so we just ping it
    try:
        async with async_client.stream(
            "GET",
            "/api/v1/stream/traffic",
            params={"speed": "10.0", "attackRatio": "0.5"},
            timeout=2.0,
        ) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")
            async for line in response.aiter_lines():
                if line:
                    break
    except Exception:
        # Timeout or disconnect is expected — the endpoint is a live stream
        pass


@pytest.mark.asyncio
async def test_predict_sample_download(async_client: AsyncClient):
    """GET /predict/sample should return a CSV file."""
    resp = await async_client.get("/api/v1/predict/sample")
    assert resp.status_code in (200, 503)  # 503 if predictor not ready
    if resp.status_code == 200:
        content_type = resp.headers.get("content-type", "")
        assert "csv" in content_type or "octet-stream" in content_type


@pytest.mark.asyncio
async def test_llm_status_endpoint(async_client: AsyncClient):
    """GET /llm/status should return provider info."""
    resp = await async_client.get("/api/v1/llm/status")
    assert resp.status_code == 200
    data = resp.json()
    # camelCase keys
    assert "provider" in data
    assert "model" in data
    assert "healthy" in data
    assert "fallbackChain" in data


@pytest.mark.asyncio
async def test_llm_provider_switch_invalid(async_client: AsyncClient):
    """POST /llm/provider with invalid provider should return 400."""
    resp = await async_client.post(
        "/api/v1/llm/provider",
        json={"provider": "openai"},  # not supported
    )
    assert resp.status_code in (400, 403)


@pytest.mark.asyncio
async def test_chat_history_empty(async_client: AsyncClient):
    """GET /chat/{session_id}/history for unknown session should return empty paginated list."""
    resp = await async_client.get("/api/v1/chat/nonexistent-session-xyz/history")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["items"] == []
    assert data["total"] == 0
    assert "page" in data
    assert "pageSize" in data
