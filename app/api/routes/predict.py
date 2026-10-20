"""
app/api/routes/predict.py
─────────────────────────
POST /predict          — single flow classification
POST /predict/batch    — CSV upload, chunked parsing, bulk persist
GET  /predict/sample   — download demo sample CSV
"""
import io
from pathlib import Path
from typing import List
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_predictor
from app.core.config import settings
from app.ml.predictor import Predictor
from app.models.alert import Alert
from app.models.flow import Flow
from app.schemas.predict import (
    BatchPredictResponse,
    BatchPredictRow,
    BatchSummary,
    PredictRequest,
    PredictResponse,
)

router = APIRouter(prefix="", tags=["predict"])

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
_CHUNK_SIZE = 5_000  # rows per pandas chunk


def _map_severity(attack_type: str) -> str:
    atk = attack_type.upper()
    if "DDOS" in atk or "LOIC" in atk:
        return "critical"
    elif "DOS" in atk or "GOLDENEYE" in atk:
        return "high"
    elif "BRUTE" in atk or "PORTSCAN" in atk:
        return "medium"
    return "low"


@router.post("/predict", response_model=PredictResponse)
async def predict_flow(
    payload: PredictRequest,
    db: AsyncSession = Depends(get_db),
    predictor: Predictor = Depends(get_predictor),
):
    """
    Classifies a single network flow against the trained CICIDS2017 model.
    Validates exact feature column matching (422 if mismatched).
    Optionally persists the flow and auto-creates an alert for attacks.
    """
    result = predictor.predict(payload.features)

    flow_id = None
    alert_id = None

    if payload.persist:
        flow = Flow(
            src_ip=payload.src_ip or "192.168.10.50",
            dst_ip=payload.dst_ip or "192.168.10.1",
            src_port=payload.src_port or 54128,
            dst_port=payload.dst_port or 80,
            protocol=payload.protocol or "TCP",
            features=payload.features,
            prediction=result["prediction"],
            confidence=result["confidence"],
        )
        db.add(flow)
        await db.flush()
        flow_id = flow.id

        if result["is_anomaly"]:
            alert = Alert(
                flow_id=flow.id,
                attack_type=result["prediction"],
                severity=_map_severity(result["prediction"]),
                status="open",
            )
            db.add(alert)
            await db.flush()
            alert_id = alert.id

        await db.commit()

    return PredictResponse(
        prediction=result["prediction"],
        confidence=result["confidence"],
        is_anomaly=result["is_anomaly"],
        top_contributing_features=result["top_contributing_features"],
        probabilities=result["probabilities"],
        flow_id=flow_id,
        alert_id=alert_id,
    )


@router.post("/predict/batch", response_model=BatchPredictResponse)
async def predict_batch_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    predictor: Predictor = Depends(get_predictor),
):
    """
    Evaluates a batch of network flows uploaded as a CICIDS2017-formatted CSV.
    Streams parsing in 5k-row chunks, supports up to 50 MB uploads.
    Returns {items: [...], summary: {...}}.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    # Read with size guard
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 50 MB upload limit.")

    try:
        df_full = pd.read_csv(io.BytesIO(content))
        df_full.columns = df_full.columns.str.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {e}")

    if df_full.empty:
        raise HTTPException(status_code=400, detail="Uploaded CSV is empty.")

    rows_result: List[BatchPredictRow] = []
    attacks_count = 0
    benign_count = 0
    flows_to_insert: List[Flow] = []
    alerts_to_insert: List[Alert] = []

    # Process in chunks to avoid OOM on large files
    for chunk_start in range(0, len(df_full), _CHUNK_SIZE):
        df = df_full.iloc[chunk_start: chunk_start + _CHUNK_SIZE].copy()
        predictions = predictor.predict_dataframe(df)

        src_ips = df["Source IP"] if "Source IP" in df.columns else ["192.168.10.50"] * len(df)
        dst_ips = df["Destination IP"] if "Destination IP" in df.columns else ["192.168.10.1"] * len(df)
        protocols = df["Protocol"] if "Protocol" in df.columns else ["TCP"] * len(df)

        for idx, pred_item in enumerate(predictions):
            global_idx = chunk_start + idx
            row_features = df.iloc[idx][predictor.feature_names].to_dict()
            src_ip = str(src_ips.iloc[idx]) if hasattr(src_ips, "iloc") else "192.168.10.50"
            dst_ip = str(dst_ips.iloc[idx]) if hasattr(dst_ips, "iloc") else "192.168.10.1"
            dst_port = int(df.iloc[idx].get("Destination Port", 80))
            src_port = 49152 + (global_idx % 1000)
            proto = str(protocols.iloc[idx]) if hasattr(protocols, "iloc") else "TCP"

            pred_label = pred_item["prediction"]
            conf = pred_item["confidence"]
            is_anomaly = pred_item["is_anomaly"]

            flow_uuid = uuid.uuid4()
            flow = Flow(
                id=flow_uuid,
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                protocol=proto,
                features=row_features,
                prediction=pred_label,
                confidence=conf,
            )
            flows_to_insert.append(flow)

            alert = None
            if is_anomaly:
                attacks_count += 1
                alert_uuid = uuid.uuid4()
                alert = Alert(
                    id=alert_uuid,
                    flow_id=flow_uuid,
                    attack_type=pred_label,
                    severity=_map_severity(pred_label),
                    status="open",
                )
                alerts_to_insert.append(alert)
            else:
                benign_count += 1

            rows_result.append(
                BatchPredictRow(
                    row_id=global_idx + 1,
                    flow_id=flow_uuid,
                    src_ip=src_ip,
                    dst_ip=dst_ip,
                    src_port=src_port,
                    dst_port=dst_port,
                    protocol=proto,
                    prediction=pred_label,
                    confidence=conf,
                    is_anomaly=is_anomaly,
                    alert_id=alert.id if alert else None,
                )
            )

    db.add_all(flows_to_insert)
    if alerts_to_insert:
        db.add_all(alerts_to_insert)
    await db.commit()

    total = len(rows_result)
    summary_obj = BatchSummary(
        total_rows=total,
        attacks_count=attacks_count,
        benign_count=benign_count,
        attack_ratio=round(attacks_count / max(1, total), 4),
        total=total,
        attacks=attacks_count,
        benign=benign_count,
    )
    return BatchPredictResponse(
        items=rows_result,
        results=rows_result,
        total_rows=total,
        attacks_count=attacks_count,
        benign_count=benign_count,
        summary=summary_obj,
    )


@router.get("/predict/sample")
async def download_sample_csv():
    """
    Downloads the pre-built demo sample CSV (CICIDS2017-formatted) for use
    as a drag-and-drop test file on the frontend Analyze page.
    """
    sample_path = Path(settings.SIMULATION_DATA_PATH)
    if sample_path.exists():
        return FileResponse(
            path=str(sample_path),
            media_type="text/csv",
            filename="tidewatch_sample_flows.csv",
        )

    # Generate a minimal in-memory sample if the file isn't present yet
    from app.api.deps import get_predictor as _get_predictor
    from app.ml.predictor import get_predictor as _pred_singleton
    predictor = _pred_singleton()
    if not predictor or not predictor.feature_names:
        raise HTTPException(status_code=503, detail="ML predictor not ready yet.")

    import random
    rows = []
    for i in range(50):
        row = {feat: round(random.uniform(0, 1000), 2) for feat in predictor.feature_names}
        row["Source IP"] = f"192.168.{random.randint(1,20)}.{random.randint(1,254)}"
        row["Destination IP"] = "192.168.10.1"
        row["Protocol"] = random.choice(["TCP", "UDP"])
        row["Destination Port"] = random.choice([80, 443, 22, 3389])
        rows.append(row)

    df = pd.DataFrame(rows)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tidewatch_sample_flows.csv"},
    )
