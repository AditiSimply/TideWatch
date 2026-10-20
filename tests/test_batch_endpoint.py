import io
import json
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import AsyncClient


def build_csv_content(feature_names: list, n_rows: int = 5) -> str:
    """Generates a valid CICIDS2017 CSV with minimal feature values."""
    header = ",".join(feature_names + ["Source IP", "Destination IP", "Protocol"])
    rows = []
    for i in range(n_rows):
        vals = ["100.0"] * len(feature_names)
        vals += [f"192.168.10.{i + 1}", "192.168.10.1", "TCP"]
        rows.append(",".join(vals))
    return "\n".join([header] + rows)


@pytest.mark.asyncio
async def test_batch_predict_valid_csv(async_client: AsyncClient, valid_features: dict):
    feature_names = list(valid_features.keys())
    csv_content = build_csv_content(feature_names, n_rows=5)

    files = {"file": ("test_flows.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    resp = await async_client.post("/api/v1/predict/batch", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 5
    assert data["attacks_count"] + data["benign_count"] == 5
    assert len(data["results"]) == 5
    for row in data["results"]:
        assert "prediction" in row
        assert "confidence" in row
        assert 0.0 <= row["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_batch_predict_rejects_non_csv(async_client: AsyncClient):
    files = {"file": ("report.pdf", b"not-a-csv-file", "application/pdf")}
    resp = await async_client.post("/api/v1/predict/batch", files=files)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_predict_single_flow(async_client: AsyncClient, valid_features: dict):
    payload = {
        "features": valid_features,
        "src_ip": "205.174.165.73",
        "dst_ip": "192.168.10.50",
        "src_port": 49128,
        "dst_port": 80,
        "protocol": "TCP",
        "persist": True,
    }
    resp = await async_client.post("/api/v1/predict", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "prediction" in data
    assert "confidence" in data
    assert "is_anomaly" in data
    assert "flow_id" in data


@pytest.mark.asyncio
async def test_predict_single_flow_missing_feature(async_client: AsyncClient, valid_features: dict):
    bad_features = valid_features.copy()
    first_key = list(valid_features.keys())[0]
    del bad_features[first_key]

    payload = {"features": bad_features, "persist": False}
    resp = await async_client.post("/api/v1/predict", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_health_endpoint(async_client: AsyncClient):
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "database" in data
    assert "ml_engine" in data
