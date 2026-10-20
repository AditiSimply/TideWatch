from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid
from app.schemas.common import CamelModel
from app.schemas.flow import FlowResponse


AlertSeverity = Literal["critical", "high", "medium", "low"]
AlertStatus = Literal["open", "investigating", "resolved"]


class AlertCreate(CamelModel):
    flow_id: uuid.UUID
    attack_type: str
    severity: AlertSeverity = "medium"
    status: AlertStatus = "open"


class AlertPatch(CamelModel):
    status: AlertStatus


class AiReportSummary(CamelModel):
    id: uuid.UUID
    explanation: str
    mitigation: Dict[str, Any]
    severity_score: float
    provider: Optional[str] = None
    model: Optional[str] = None
    created_at: datetime


class AlertResponse(CamelModel):
    id: uuid.UUID
    flow_id: uuid.UUID
    attack_type: str
    severity: AlertSeverity
    status: AlertStatus
    created_at: datetime
    flow: Optional[FlowResponse] = None
    ai_reports: Optional[List[AiReportSummary]] = None


class AlertFilter(CamelModel):
    status: Optional[str] = None
    attack_type: Optional[str] = None
    severity: Optional[str] = None
    src_ip: Optional[str] = None
    q: Optional[str] = None
    page: int = 1
    page_size: int = 50
