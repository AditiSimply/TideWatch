from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.flow import Flow
from app.schemas.flow import FlowResponse

router = APIRouter(prefix="/flows", tags=["flows"])


@router.get("", response_model=List[FlowResponse])
async def list_flows(
    src_ip: Optional[str] = Query(None, description="Filter by source IP"),
    dst_ip: Optional[str] = Query(None, description="Filter by destination IP"),
    prediction: Optional[str] = Query(None, description="Filter by prediction classification"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves recorded network flows with optional IP, prediction, and confidence filters.
    """
    stmt = select(Flow).order_by(Flow.ts.desc()).offset(offset).limit(limit)

    if src_ip:
        stmt = stmt.where(Flow.src_ip == src_ip.strip())
    if dst_ip:
        stmt = stmt.where(Flow.dst_ip == dst_ip.strip())
    if prediction:
        stmt = stmt.where(Flow.prediction.ilike(f"%{prediction.strip()}%"))
    if min_confidence is not None:
        stmt = stmt.where(Flow.confidence >= min_confidence)

    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{flow_id}", response_model=FlowResponse)
async def get_flow(
    flow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetches a single network flow by UUID."""
    flow = await db.get(Flow, flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow
