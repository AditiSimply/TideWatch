from typing import Any, Dict, List, Optional, TypedDict
import uuid


class TriageState(TypedDict, total=False):
    alert_id: str
    flow_id: str
    attack_type: str
    severity: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    features: Dict[str, Any]
    flow_duration: float
    flow_pkts_per_sec: float
    flow_iat_mean: float

    # Enrichment
    enrichment_data: Dict[str, Any]

    # LLM & Reasoning outputs
    attack_taxonomy: str
    root_cause_analysis: str
    salient_features: List[Dict[str, Any]]
    impact_assessment: str
    mitigations: List[Dict[str, Any]]
    severity_score: float

    # Status
    ai_report_id: Optional[str]
    error: Optional[str]
