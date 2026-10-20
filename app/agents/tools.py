from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from app.db.session import async_session_factory
from app.models.alert import Alert
from app.models.flow import Flow


# --- Pydantic Tool Input Schemas (Strict Guardrails) ---

class QueryFlowsInput(BaseModel):
    src_ip: Optional[str] = Field(None, description="Filter by source IP address")
    dst_ip: Optional[str] = Field(None, description="Filter by destination IP address")
    prediction: Optional[str] = Field(None, description="Filter by attack classification, e.g. 'DDoS', 'PortScan', 'BENIGN'")
    min_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum prediction confidence (0.0 to 1.0)")
    limit: int = Field(10, ge=1, le=50, description="Maximum number of flows to return (max 50)")


class GetAlertInput(BaseModel):
    alert_id: str = Field(..., description="UUID of the alert to inspect")


class SummarizeWindowInput(BaseModel):
    minutes: int = Field(60, ge=1, le=1440, description="Time window in minutes to summarize (default 60)")


class AttackKnowledgeInput(BaseModel):
    attack_type: str = Field(..., description="Attack type name, e.g., 'DDoS', 'PortScan', 'DoS-Slowloris', 'GoldenEye', 'BruteForce'")


# --- Tools ---

@tool("query_flows", args_schema=QueryFlowsInput)
async def query_flows_tool(
    src_ip: Optional[str] = None,
    dst_ip: Optional[str] = None,
    prediction: Optional[str] = None,
    min_confidence: Optional[float] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Queries recent network flows with SQL-safe filters.
    Strictly uses parameterized ORM queries; no raw SQL execution.
    """
    async with async_session_factory() as session:
        stmt = select(Flow).order_by(Flow.ts.desc()).limit(limit)

        if src_ip:
            stmt = stmt.where(Flow.src_ip == src_ip.strip())
        if dst_ip:
            stmt = stmt.where(Flow.dst_ip == dst_ip.strip())
        if prediction:
            stmt = stmt.where(Flow.prediction.ilike(f"%{prediction.strip()}%"))
        if min_confidence is not None:
            stmt = stmt.where(Flow.confidence >= min_confidence)

        result = await session.execute(stmt)
        flows = result.scalars().all()

        return [
            {
                "id": str(f.id),
                "timestamp": f.ts.isoformat(),
                "src_ip": f.src_ip,
                "src_port": f.src_port,
                "dst_ip": f.dst_ip,
                "dst_port": f.dst_port,
                "protocol": f.protocol,
                "prediction": f.prediction,
                "confidence": round(f.confidence, 4),
            }
            for f in flows
        ]


@tool("get_alert", args_schema=GetAlertInput)
async def get_alert_tool(alert_id: str) -> Dict[str, Any]:
    """
    Fetches full incident details for a given alert ID, including 5-tuple and AI triage report.
    """
    try:
        alert_uuid = uuid.UUID(alert_id.strip())
    except ValueError:
        return {"error": f"Invalid UUID format: {alert_id}"}

    async with async_session_factory() as session:
        alert = await session.get(Alert, alert_uuid)
        if not alert:
            return {"error": f"Alert {alert_id} not found."}

        flow = await session.get(Flow, alert.flow_id)

        return {
            "alert_id": str(alert.id),
            "attack_type": alert.attack_type,
            "severity": alert.severity,
            "status": alert.status,
            "created_at": alert.created_at.isoformat(),
            "source": f"{flow.src_ip}:{flow.src_port}" if flow else "unknown",
            "destination": f"{flow.dst_ip}:{flow.dst_port}" if flow else "unknown",
            "protocol": flow.protocol if flow else "TCP",
            "flow_confidence": round(flow.confidence, 4) if flow else 0.0,
        }


@tool("summarize_window", args_schema=SummarizeWindowInput)
async def summarize_window_tool(minutes: int = 60) -> Dict[str, Any]:
    """
    Summarizes network flow volume, attack counts, and top flagged IPs over the past N minutes.
    """
    async with async_session_factory() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)

        # Total flows
        total_stmt = select(func.count(Flow.id)).where(Flow.ts >= cutoff)
        total_res = await session.execute(total_stmt)
        total_flows = total_res.scalar() or 0

        # Attack flows
        attack_stmt = select(func.count(Flow.id)).where(
            Flow.ts >= cutoff,
            Flow.prediction != "BENIGN",
        )
        attack_res = await session.execute(attack_stmt)
        attack_flows = attack_res.scalar() or 0

        # Breakdown by attack class
        class_stmt = (
            select(Flow.prediction, func.count(Flow.id))
            .where(Flow.ts >= cutoff, Flow.prediction != "BENIGN")
            .group_by(Flow.prediction)
        )
        class_res = await session.execute(class_stmt)
        attack_breakdown = {row[0]: row[1] for row in class_res.fetchall()}

        # Top offending source IPs
        ip_stmt = (
            select(Flow.src_ip, func.count(Flow.id))
            .where(Flow.ts >= cutoff, Flow.prediction != "BENIGN")
            .group_by(Flow.src_ip)
            .order_by(func.count(Flow.id).desc())
            .limit(3)
        )
        ip_res = await session.execute(ip_stmt)
        top_ips = [{"ip": row[0], "attack_count": row[1]} for row in ip_res.fetchall()]

        attack_rate = round(attack_flows / max(1, total_flows) * 100, 2)

        return {
            "window_minutes": minutes,
            "total_flows": total_flows,
            "attack_flows": attack_flows,
            "attack_rate_percent": attack_rate,
            "attack_breakdown": attack_breakdown,
            "top_adversary_ips": top_ips,
        }


@tool("attack_knowledge", args_schema=AttackKnowledgeInput)
def attack_knowledge_tool(attack_type: str) -> Dict[str, Any]:
    """
    Retrieves deep domain knowledge and mitigations for a specific network attack class.
    """
    query = attack_type.upper()
    if "DDOS" in query or "LOIC" in query:
        return {
            "name": "DDoS - LOIC (Low Orbit Ion Cannon)",
            "mechanism": "Volumetric HTTP/UDP flooding that transmits requests at sub-50µs intervals without socket teardown.",
            "indicators": ["Packets/sec > 25,000", "Flow IAT Mean < 35 µs", "Init Window Bytes: 29,200"],
            "mitigation": "Edge firewall drop (iptables -I INPUT -s <IP> -j DROP) or upstream BGP FlowSpec blackhole.",
        }
    elif "PORTSCAN" in query or "SCAN" in query:
        return {
            "name": "PortScan (Reconnaissance)",
            "mechanism": "Contiguous port probing using half-open SYN packets to identify listening daemon versions.",
            "indicators": ["Flow duration < 500 µs", "Single forward packet", "Instantaneous RST reply"],
            "mitigation": "Enforce iptables recent module rate-limiting: iptables -A INPUT -m recent --name PORTSCAN --set -j DROP",
        }
    elif "DOS" in query or "GOLDENEYE" in query or "SLOWLORIS" in query:
        return {
            "name": "Application-Layer Denial of Service",
            "mechanism": "Holding open reverse proxy worker threads using Keep-Alive and periodic partial headers.",
            "indicators": ["Long duration > 300,000 µs", "Low packet rate < 20 pkts/s", "Irregular IAT"],
            "mitigation": "Tune nginx/apache client_header_timeout to 10s and limit max simultaneous connections per IP.",
        }
    elif "BRUTE" in query:
        return {
            "name": "Authentication Brute Force",
            "mechanism": "Rapid successive credential validation attempts against SSH, FTP, or web login endpoints.",
            "indicators": ["Repetitive payloads", "Consistent packet sizes on port 21/22/80"],
            "mitigation": "Deploy fail2ban and enforce exponential authentication backoff.",
        }
    else:
        return {
            "name": attack_type,
            "mechanism": "Anomalous telemetry deviation flagged by ML decision tree split.",
            "mitigation": "Inspect associated flow 5-tuple and quarantine offending host if malicious.",
        }


ALL_CHAT_TOOLS = [
    query_flows_tool,
    get_alert_tool,
    summarize_window_tool,
    attack_knowledge_tool,
]
