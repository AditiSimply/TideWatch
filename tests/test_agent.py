import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_triage_graph_rule_based_fallback(valid_features: dict):
    """Test that triage graph runs to completion using rule-based fallback when Groq is not configured."""
    from app.agents.triage import triage_graph

    initial_state = {
        "alert_id": "00000000-0000-0000-0000-000000000001",
        "flow_id": "00000000-0000-0000-0000-000000000002",
        "attack_type": "DDoS",
        "severity": "critical",
        "src_ip": "205.174.165.73",
        "dst_ip": "192.168.10.50",
        "src_port": 49000,
        "dst_port": 80,
        "protocol": "TCP",
        "features": valid_features,
        "flow_duration": 18200.0,
        "flow_pkts_per_sec": 34430.0,
        "flow_iat_mean": 28.4,
    }

    # Run graph with mocked persist node (alert won't exist in test DB)
    with patch("app.agents.triage.persist_node", new_callable=AsyncMock) as mock_persist:
        mock_persist.return_value = {"ai_report_id": "00000000-0000-0000-0000-000000000099"}
        result = await triage_graph.ainvoke(initial_state)

    assert "attack_taxonomy" in result
    assert "root_cause_analysis" in result
    assert "mitigations" in result
    assert "severity_score" in result
    assert isinstance(result["severity_score"], float)
    assert result["severity_score"] >= 0.0


def test_rule_based_fallback_ddos():
    """Test rule-based triage fallback generates correct DDoS heuristics."""
    from app.agents.fallbacks import get_rule_based_triage

    result = get_rule_based_triage(
        attack_type="DDoS",
        src_ip="205.174.165.73",
        dst_ip="192.168.10.50",
        dst_port=80,
        protocol="TCP",
        pkts_per_sec=34430.0,
        iat_mean=28.4,
        flow_duration=18200.0,
        enrichment={"recent_flows_count": 120, "similar_alerts_24h": 8},
    )

    assert "taxonomy" in result["attack_taxonomy"].lower() or "ddos" in result["attack_taxonomy"].lower() or "CWE" in result["attack_taxonomy"]
    assert len(result["mitigations"]) > 0
    assert result["severity_score"] >= 8.0
    # Should contain IPTables rule for DDoS
    has_iptables = any("iptables" in str(m.get("iptables_rule", "")).lower() for m in result["mitigations"])
    assert has_iptables


def test_rule_based_fallback_portscan():
    """Test rule-based triage for PortScan returns appropriate mid-severity score."""
    from app.agents.fallbacks import get_rule_based_triage

    result = get_rule_based_triage(
        attack_type="PortScan",
        src_ip="192.168.10.51",
        dst_ip="192.168.10.1",
        dst_port=445,
        protocol="TCP",
        pkts_per_sec=8500.0,
        iat_mean=150.0,
        flow_duration=200.0,
        enrichment={"recent_flows_count": 42, "similar_alerts_24h": 3},
    )

    assert result["severity_score"] < 9.0  # PortScan is medium-high, not critical
    assert len(result["salient_features"]) > 0


@pytest.mark.asyncio
async def test_chat_fallback_ddos_query():
    """Test that chat agent fallback responds to DDoS query without Groq."""
    from app.agents.chat_agent import fallback_stream_response
    from app.core.config import settings

    chunks = []
    async for chunk in fallback_stream_response("Tell me about DDoS-LOIC attack", "test-session"):
        chunks.append(chunk)

    full_response = "".join(chunks)
    assert len(full_response) > 100
    assert "DDoS" in full_response or "ddos" in full_response.lower()


@pytest.mark.asyncio
async def test_chat_fallback_summarize_query():
    """Test that chat agent fallback responds to summarize query."""
    from app.agents.chat_agent import fallback_stream_response

    chunks = []
    async for chunk in fallback_stream_response("Summarize network traffic from the last hour", "test-session"):
        chunks.append(chunk)

    full_response = "".join(chunks)
    assert len(full_response) > 50


@pytest.mark.asyncio
async def test_query_flows_tool_empty_db():
    """Test that query_flows tool returns empty list when DB is empty."""
    from app.agents.tools import query_flows_tool

    result = await query_flows_tool.ainvoke({"limit": 10})
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_summarize_window_tool_empty_db():
    """Test that summarize_window returns sensible defaults on empty DB."""
    from app.agents.tools import summarize_window_tool

    result = await summarize_window_tool.ainvoke({"minutes": 60})
    assert "total_flows" in result
    assert "attack_flows" in result
    assert "attack_rate_percent" in result


def test_attack_knowledge_tool_loic():
    """Test knowledge tool returns LOIC detail."""
    from app.agents.tools import attack_knowledge_tool

    result = attack_knowledge_tool.invoke({"attack_type": "DDoS-LOIC"})
    assert "LOIC" in result["name"] or "DDoS" in result["name"]
    assert "mitigation" in result
    assert "indicators" in result


def test_attack_knowledge_tool_portscan():
    """Test knowledge tool returns PortScan detail."""
    from app.agents.tools import attack_knowledge_tool

    result = attack_knowledge_tool.invoke({"attack_type": "PortScan"})
    assert "Scan" in result["name"] or "Port" in result["name"]
    assert "mechanism" in result
