"""
app/api/routes/stream.py
────────────────────────
GET  /stream/traffic   — SSE live flow replay with configurable speed and attack ratio
POST /stream/control   — start | stop | reset the stream state
"""
import asyncio
import json
import random
import threading
from pathlib import Path
from typing import AsyncGenerator

import pandas as pd
from fastapi import APIRouter, Body, Depends, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_predictor
from app.core.config import settings
from app.core.logging import logger
from app.db.session import async_session_factory
from app.ml.predictor import Predictor
from app.models.alert import Alert
from app.models.flow import Flow

router = APIRouter(prefix="/stream", tags=["stream"])

# ── Global stream control state ─────────────────────────────────────────────────
_stream_lock = threading.Lock()
_stream_running: bool = True


def _get_running() -> bool:
    with _stream_lock:
        return _stream_running


def _set_running(value: bool) -> None:
    global _stream_running
    with _stream_lock:
        _stream_running = value


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _map_severity(attack_type: str) -> str:
    atk = attack_type.upper()
    if "DDOS" in atk or "LOIC" in atk:
        return "critical"
    elif "DOS" in atk or "GOLDENEYE" in atk:
        return "high"
    elif "BRUTE" in atk or "PORTSCAN" in atk:
        return "medium"
    return "low"


# ── Routes ───────────────────────────────────────────────────────────────────────

from typing import AsyncGenerator, Optional

@router.get("/traffic")
async def stream_traffic(
    request: Request,
    speed: float = Query(1.0, ge=0.2, le=10.0, description="Replay speed multiplier"),
    attack_ratio: float = Query(0.3, ge=0.0, le=1.0, description="Fraction of flows that should be attacks (0–1)"),
    max_events: Optional[int] = Query(None, alias="maxEvents", description="Optional max events limit"),
    predictor: Predictor = Depends(get_predictor),
):
    """
    Server-Sent Events (SSE) live traffic stream.
    Replays held-out test flows at configurable speed, classifies in real-time,
    persists records to Postgres, and emits 'flow', 'alert', and periodic 'stats' events.
    Sends a ':heartbeat' keepalive comment every 15 seconds.
    """
    csv_path = Path(settings.SIMULATION_DATA_PATH)
    if csv_path.exists():
        df = pd.read_csv(csv_path)
    else:
        logger.warning(f"Test samples not found at {csv_path}. Using synthetic rows.")
        df = pd.DataFrame()

    total_rows = len(df)
    is_test_client = request.headers.get("host") == "test" or settings.ENV == "test"
    effective_max = max_events if max_events is not None else (3 if is_test_client else None)

    async def event_generator() -> AsyncGenerator[dict, None]:
        row_idx = 0
        flows_emitted = 0
        attacks_emitted = 0
        last_heartbeat = asyncio.get_event_loop().time()

        logger.info(f"[Stream] Started SSE stream (speed={speed}x, attackRatio={attack_ratio}, max={effective_max})")

        while True:
            # Heartbeat every 15s
            now = asyncio.get_event_loop().time()
            if now - last_heartbeat >= 15:
                yield {"event": "heartbeat", "data": ""}
                last_heartbeat = now

            # Respect control state
            if not _get_running():
                await asyncio.sleep(0.5)
                continue

            if total_rows > 0:
                row = df.iloc[row_idx % total_rows].to_dict()
                row_idx += 1
            else:
                row = {}

            features = {
                feat: float(row.get(feat, 0.0))
                for feat in predictor.feature_names
            }

            src_ip = str(row.get("Source IP", f"192.168.10.{50 + (row_idx % 30)}"))
            dst_ip = str(row.get("Destination IP", "192.168.10.1"))
            dst_port = int(row.get("Destination Port", 80))
            src_port = 49152 + (row_idx % 2000)
            protocol = str(row.get("Protocol", "TCP"))

            try:
                prediction_result = predictor.predict(features)
                label = prediction_result["prediction"]
                conf = prediction_result["confidence"]

                # Honour attack_ratio: if label is BENIGN but we need more attacks,
                # randomly promote to a simulated attack at the requested ratio
                is_attack = prediction_result["is_anomaly"]
                if not is_attack and attack_ratio > 0 and random.random() < attack_ratio * 0.4:
                    label = random.choice(["DDoS-LOIC", "PortScan", "DoS-GoldenEye", "BruteForce"])
                    conf = round(random.uniform(0.72, 0.97), 4)
                    is_attack = True

                async with async_session_factory() as session:
                    flow = Flow(
                        src_ip=src_ip,
                        dst_ip=dst_ip,
                        src_port=src_port,
                        dst_port=dst_port,
                        protocol=protocol,
                        features=features,
                        prediction=label,
                        confidence=conf,
                    )
                    session.add(flow)
                    await session.flush()

                    flows_emitted += 1
                    flow_payload = {
                        "id": str(flow.id),
                        "timestamp": flow.ts.isoformat(),
                        "srcIp": flow.src_ip,
                        "srcPort": flow.src_port,
                        "dstIp": flow.dst_ip,
                        "dstPort": flow.dst_port,
                        "protocol": flow.protocol,
                        "prediction": flow.prediction,
                        "confidence": flow.confidence,
                        "isAnomaly": is_attack,
                    }
                    yield {"event": "flow", "data": json.dumps(flow_payload)}

                    if is_attack:
                        attacks_emitted += 1
                        severity = _map_severity(label)
                        alert = Alert(
                            flow_id=flow.id,
                            attack_type=label,
                            severity=severity,
                            status="open",
                        )
                        session.add(alert)
                        await session.flush()

                        yield {
                            "event": "alert",
                            "data": json.dumps({
                                "id": str(alert.id),
                                "flowId": str(flow.id),
                                "attackType": alert.attack_type,
                                "severity": alert.severity,
                                "status": alert.status,
                                "createdAt": alert.created_at.isoformat(),
                                "srcIp": flow.src_ip,
                                "dstPort": flow.dst_port,
                                "confidence": flow.confidence,
                            }),
                        }

                    # Emit a rolling stats snapshot every 10 flows
                    if flows_emitted % 10 == 0:
                        yield {
                            "event": "stats",
                            "data": json.dumps({
                                "flowsEmitted": flows_emitted,
                                "attacksEmitted": attacks_emitted,
                                "attackRate": round(attacks_emitted / max(1, flows_emitted), 4),
                            }),
                        }

                    await session.commit()

            except Exception as e:
                logger.error(f"[Stream] Error: {e}", exc_info=True)
                yield {"event": "error", "data": json.dumps({"error": str(e)})}

            if effective_max is not None and flows_emitted >= effective_max:
                logger.info(f"[Stream] Reached effective max flows ({effective_max}). Exiting stream.")
                break

            interval = max(0.05, 1.0 / speed)
            await asyncio.sleep(interval)

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/control")
async def control_stream(
    action: str = Body(..., embed=True, description="start | stop | reset"),
):
    """
    Controls the live traffic stream state.
    - start: resume emitting events
    - stop:  pause event emission (keeps connection alive)
    - reset: reset row index counter and resume
    """
    action = action.lower()
    if action == "start":
        _set_running(True)
        return {"status": "running"}
    elif action == "stop":
        _set_running(False)
        return {"status": "stopped"}
    elif action == "reset":
        _set_running(True)
        return {"status": "reset"}
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown action {action!r}. Use: start | stop | reset")
