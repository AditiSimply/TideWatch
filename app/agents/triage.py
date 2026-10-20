"""
app/agents/triage.py
────────────────────
LangGraph triage workflow:
  classify_alert → enrich → explain → mitigate → score_severity → persist

LLM is acquired via get_llm() which respects the active LLM_PROVIDER env var
and falls back through configured providers automatically.

For providers without native tool-calling (ollama, huggingface), the explain
node uses JSON-schema prompting + Pydantic parsing instead of function-calling.
"""
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select

from app.agents.fallbacks import get_rule_based_triage
from app.agents.llm import get_llm, get_current_provider, supports_native_tools
from app.agents.state import TriageState
from app.core.config import settings
from app.core.logging import logger
from app.db.session import async_session_factory
from app.models.ai_report import AiReport
from app.models.alert import Alert
from app.models.flow import Flow


# ── Structured output schema ────────────────────────────────────────────────────

class ExplainOutput(BaseModel):
    attack_taxonomy: str
    root_cause_analysis: str
    impact_assessment: str


# ── Nodes ───────────────────────────────────────────────────────────────────────

async def classify_alert_node(state: TriageState) -> Dict[str, Any]:
    """Initial node: validates alert data and sets initial taxonomy."""
    attack = state.get("attack_type", "UNKNOWN")
    logger.info(f"[Triage] Classifying alert {state.get('alert_id')} - Attack: {attack}")
    return {"attack_type": attack}


async def enrich_node(state: TriageState) -> Dict[str, Any]:
    """
    Enriches alert by querying Neon Postgres for:
    - Count of recent flows from the same source IP (last 15m)
    - Count of similar alerts from this source IP (last 24h)
    """
    src_ip = state.get("src_ip", "")
    enrichment: Dict[str, Any] = {
        "recent_flows_count": 1,
        "similar_alerts_24h": 0,
        "historical_attacks": [],
    }

    if not src_ip:
        return {"enrichment_data": enrichment}

    try:
        async with async_session_factory() as session:
            now = datetime.now(timezone.utc)
            fifteen_mins_ago = now - timedelta(minutes=15)
            twenty_four_hours_ago = now - timedelta(hours=24)

            flow_count_res = await session.execute(
                select(func.count(Flow.id)).where(
                    Flow.src_ip == src_ip,
                    Flow.ts >= fifteen_mins_ago,
                )
            )
            enrichment["recent_flows_count"] = flow_count_res.scalar() or 1

            alert_count_res = await session.execute(
                select(func.count(Alert.id))
                .join(Flow, Alert.flow_id == Flow.id)
                .where(
                    Flow.src_ip == src_ip,
                    Alert.created_at >= twenty_four_hours_ago,
                )
            )
            enrichment["similar_alerts_24h"] = alert_count_res.scalar() or 0

            distinct_res = await session.execute(
                select(Alert.attack_type)
                .join(Flow, Alert.flow_id == Flow.id)
                .where(Flow.src_ip == src_ip)
                .distinct()
                .limit(5)
            )
            enrichment["historical_attacks"] = [r[0] for r in distinct_res.fetchall()]

    except Exception as e:
        logger.warning(f"[Triage] Enrichment query error (using defaults): {e}")

    return {"enrichment_data": enrichment}


async def explain_node(state: TriageState) -> Dict[str, Any]:
    """
    Uses the configured LLM (or rule-based fallback) to produce a plain-English
    root cause explanation and MITRE/CWE taxonomy.

    Providers with weak tool-calling (ollama, huggingface) use JSON-schema
    prompting + Pydantic parsing for structured output.
    """
    attack_type = state.get("attack_type", "Anomaly")
    src_ip = state.get("src_ip", "0.0.0.0")
    dst_ip = state.get("dst_ip", "0.0.0.0")
    dst_port = state.get("dst_port", 80)
    protocol = state.get("protocol", "TCP")
    pkts_s = state.get("flow_pkts_per_sec", 1000.0)
    iat_mean = state.get("flow_iat_mean", 100.0)
    duration = state.get("flow_duration", 20000.0)
    enrichment = state.get("enrichment_data", {})

    fallback_data = get_rule_based_triage(
        attack_type=attack_type,
        src_ip=src_ip,
        dst_ip=dst_ip,
        dst_port=dst_port,
        protocol=protocol,
        pkts_per_sec=pkts_s,
        iat_mean=iat_mean,
        flow_duration=duration,
        enrichment=enrichment,
    )

    # Try LLM explain
    try:
        llm = get_llm()
        provider = get_current_provider()

        json_schema = ExplainOutput.model_json_schema()
        prompt = f"""You are Tidewatch SecOps Analyst. Analyze this network intrusion alert:
- Attack Type: {attack_type}
- 5-Tuple: {src_ip}:{state.get('src_port')} -> {dst_ip}:{dst_port} ({protocol})
- Flow Duration: {duration} microseconds
- Packets/sec: {pkts_s}
- Mean IAT: {iat_mean} microseconds
- Recent flows from IP (15m): {enrichment.get('recent_flows_count', 1)}
- Alerts from IP (24h): {enrichment.get('similar_alerts_24h', 0)}

Respond ONLY with a valid JSON object matching this schema:
{json.dumps(json_schema, indent=2)}"""

        response = await llm.ainvoke([
            SystemMessage(content="You are an expert NIDS security analyst. Always output strictly valid JSON with no markdown."),
            HumanMessage(content=prompt),
        ])

        content = response.content.strip()
        # Strip markdown fencing if model emits it
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        parsed = ExplainOutput.model_validate_json(content)
        logger.info(f"[Triage] LLM explain succeeded via provider={provider}")

        return {
            "attack_taxonomy": parsed.attack_taxonomy,
            "root_cause_analysis": parsed.root_cause_analysis,
            "impact_assessment": parsed.impact_assessment,
            "salient_features": fallback_data["salient_features"],
            "llm_provider": provider,
        }

    except Exception as e:
        logger.warning(f"[Triage] LLM explain node failed: {e}. Using rule-based fallback.")
        return {
            "attack_taxonomy": fallback_data["attack_taxonomy"],
            "root_cause_analysis": fallback_data["root_cause_analysis"],
            "impact_assessment": fallback_data["impact_assessment"],
            "salient_features": fallback_data["salient_features"],
            "llm_provider": "rule_based",
        }


async def mitigate_node(state: TriageState) -> Dict[str, Any]:
    """Generates actionable mitigation steps, IPTables and Snort rules."""
    attack_type = state.get("attack_type", "Anomaly")
    src_ip = state.get("src_ip", "0.0.0.0")
    dst_ip = state.get("dst_ip", "0.0.0.0")
    dst_port = state.get("dst_port", 80)
    protocol = state.get("protocol", "TCP")
    enrichment = state.get("enrichment_data", {})

    fallback_data = get_rule_based_triage(
        attack_type=attack_type,
        src_ip=src_ip,
        dst_ip=dst_ip,
        dst_port=dst_port,
        protocol=protocol,
        pkts_per_sec=state.get("flow_pkts_per_sec", 1000.0),
        iat_mean=state.get("flow_iat_mean", 100.0),
        flow_duration=state.get("flow_duration", 20000.0),
        enrichment=enrichment,
    )
    return {"mitigations": fallback_data["mitigations"]}


async def score_severity_node(state: TriageState) -> Dict[str, Any]:
    """Calculates quantitative severity score 0.0–10.0."""
    attack = state.get("attack_type", "").upper()
    base_score = 5.0

    if "DDOS" in attack or "LOIC" in attack:
        base_score = 9.2
    elif "DOS" in attack:
        base_score = 8.0
    elif "BRUTE" in attack:
        base_score = 7.5
    elif "PORTSCAN" in attack:
        base_score = 6.5

    recent = state.get("enrichment_data", {}).get("recent_flows_count", 1)
    if recent > 50:
        base_score = min(10.0, base_score + 0.8)

    return {"severity_score": round(base_score, 1)}


async def persist_node(state: TriageState) -> Dict[str, Any]:
    """Persists the AI triage report into the ai_reports table."""
    alert_id_str = state.get("alert_id")
    if not alert_id_str:
        return {"error": "Missing alert_id"}

    try:
        alert_uuid = uuid.UUID(alert_id_str)
        async with async_session_factory() as session:
            alert = await session.get(Alert, alert_uuid)
            if not alert:
                logger.warning(f"[Triage] Alert {alert_uuid} not found in DB.")
                return {"error": f"Alert {alert_uuid} not found"}

            mitigation_payload = {
                "attack_taxonomy": state.get("attack_taxonomy", ""),
                "impact_assessment": state.get("impact_assessment", ""),
                "salient_features": state.get("salient_features", []),
                "mitigations": state.get("mitigations", []),
            }

            provider_used = state.get("llm_provider", "rule_based")

            report = AiReport(
                alert_id=alert_uuid,
                explanation=state.get("root_cause_analysis", ""),
                mitigation=mitigation_payload,
                severity_score=state.get("severity_score", 5.0),
                provider=provider_used,
                model=settings.GROQ_MODEL if provider_used == "groq"
                      else (settings.OLLAMA_MODEL if provider_used == "ollama"
                            else settings.HF_MODEL),
            )
            session.add(report)
            await session.commit()
            await session.refresh(report)

            logger.info(f"[Triage] Persisted AI report {report.id} for alert {alert_uuid}")
            return {"ai_report_id": str(report.id)}

    except Exception as e:
        logger.error(f"[Triage] Failed to persist AI report: {e}", exc_info=True)
        return {"error": str(e)}


# ── Graph ───────────────────────────────────────────────────────────────────────

def build_triage_graph() -> StateGraph:
    workflow = StateGraph(TriageState)

    workflow.add_node("classify_alert", classify_alert_node)
    workflow.add_node("enrich", enrich_node)
    workflow.add_node("explain", explain_node)
    workflow.add_node("mitigate", mitigate_node)
    workflow.add_node("score_severity", score_severity_node)
    workflow.add_node("persist", persist_node)

    workflow.set_entry_point("classify_alert")
    workflow.add_edge("classify_alert", "enrich")
    workflow.add_edge("enrich", "explain")
    workflow.add_edge("explain", "mitigate")
    workflow.add_edge("mitigate", "score_severity")
    workflow.add_edge("score_severity", "persist")
    workflow.add_edge("persist", END)

    return workflow.compile()


triage_graph = build_triage_graph()
