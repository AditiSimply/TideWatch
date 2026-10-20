from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid
from app.schemas.common import CamelModel


class MitigationStep(CamelModel):
    step: str
    iptables_rule: Optional[str] = None
    snort_rule: Optional[str] = None
    priority: str = "immediate"


class SalientFeature(CamelModel):
    feature: str
    observed_value: Any
    benchmark: str
    contribution: str


class TriageReportResponse(CamelModel):
    id: uuid.UUID
    alert_id: uuid.UUID
    attack_taxonomy: str
    root_cause_analysis: str
    salient_features: List[SalientFeature]
    impact_assessment: str
    mitigations: List[MitigationStep]
    severity_score: float
    provider: Optional[str] = None
    model: Optional[str] = None
    created_at: datetime
