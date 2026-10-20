"""
app/api/routes/alerts.py
────────────────────────
GET   /alerts                  — paginated, filterable alert list
GET   /alerts/{id}             — single alert + flow + latest aiReport
PATCH /alerts/{id}             — update status
POST  /alerts/{id}/analyze     — run LangGraph triage, return aiReport
"""
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.triage import triage_graph
from app.api.deps import get_db
from app.models.ai_report import AiReport
from app.models.alert import Alert
from app.models.flow import Flow
from app.schemas.agent import TriageReportResponse
from app.schemas.alert import AlertPatch, AlertResponse
from app.schemas.common import Paginated

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _load_stmt():
    return select(Alert).options(
        selectinload(Alert.flow),
        selectinload(Alert.ai_reports),
    )


@router.get("", response_model=Paginated[AlertResponse])
async def list_alerts(
    status: Optional[str] = Query(None),
    attack_type: Optional[str] = Query(None, alias="type"),
    severity: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Free-text search on src_ip or attack_type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
):
    """Paginated, filterable list of security alerts including flow and AI report data."""
    base = select(Alert)

    if status and status.lower() not in ("all", ""):
        base = base.where(Alert.status == status.lower())
    if attack_type and attack_type.lower() not in ("all", ""):
        base = base.where(Alert.attack_type.ilike(f"%{attack_type.strip()}%"))
    if severity and severity.lower() not in ("all", ""):
        base = base.where(Alert.severity == severity.lower())
    if q:
        term = f"%{q.strip()}%"
        base = base.join(Flow, Alert.flow_id == Flow.id, isouter=True).where(
            (Alert.attack_type.ilike(term)) | (Flow.src_ip.ilike(term))
        )

    # Count total
    count_res = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_res.scalar() or 0

    # Fetch page
    offset = (page - 1) * page_size
    stmt = (
        base.options(selectinload(Alert.flow), selectinload(Alert.ai_reports))
        .order_by(Alert.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    res = await db.execute(stmt)
    alerts = res.scalars().all()

    return Paginated[AlertResponse](
        items=[AlertResponse.model_validate(a) for a in alerts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetches a specific security alert with its flow and latest AI triage report."""
    stmt = _load_stmt().where(Alert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertResponse.model_validate(alert)


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: uuid.UUID,
    payload: AlertPatch,
    db: AsyncSession = Depends(get_db),
):
    """Updates the lifecycle status of an alert (open → investigating → resolved)."""
    stmt = _load_stmt().where(Alert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = payload.status
    await db.commit()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.post("/{alert_id}/analyze", response_model=TriageReportResponse)
async def analyze_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers the LangGraph SecOps triage workflow for an alert:
    classify → enrich (Neon telemetry) → explain (LLM / fallback) →
    mitigate (IPTables/Snort) → score_severity → persist to ai_reports.
    """
    stmt = select(Alert).options(selectinload(Alert.flow)).where(Alert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    flow = alert.flow
    features = flow.features if flow else {}

    initial_state = {
        "alert_id": str(alert.id),
        "flow_id": str(flow.id) if flow else "",
        "attack_type": alert.attack_type,
        "severity": alert.severity,
        "src_ip": flow.src_ip if flow else "unknown",
        "dst_ip": flow.dst_ip if flow else "unknown",
        "src_port": flow.src_port if flow else 0,
        "dst_port": flow.dst_port if flow else 80,
        "protocol": flow.protocol if flow else "TCP",
        "features": features,
        "flow_duration": float(features.get("Flow Duration", 20000.0)),
        "flow_pkts_per_sec": float(features.get("Flow Packets/s", 1000.0)),
        "flow_iat_mean": float(features.get("Flow IAT Mean", 100.0)),
    }

    result_state = await triage_graph.ainvoke(initial_state)

    if result_state.get("error"):
        raise HTTPException(status_code=500, detail=result_state["error"])

    report_id_str = result_state.get("ai_report_id")
    if not report_id_str:
        raise HTTPException(status_code=500, detail="Failed to persist triage report.")

    report = await db.get(AiReport, uuid.UUID(report_id_str))
    if not report:
        raise HTTPException(status_code=500, detail="Persisted report could not be loaded.")

    mp = report.mitigation or {}
    return TriageReportResponse(
        id=report.id,
        alert_id=report.alert_id,
        attack_taxonomy=mp.get("attack_taxonomy", "Anomalous Network Activity"),
        root_cause_analysis=report.explanation,
        salient_features=mp.get("salient_features", []),
        impact_assessment=mp.get("impact_assessment", "Potential resource degradation."),
        mitigations=mp.get("mitigations", []),
        severity_score=report.severity_score,
        provider=report.provider,
        model=report.model,
        created_at=report.created_at,
    )
