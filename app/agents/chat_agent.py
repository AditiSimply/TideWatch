"""
app/agents/chat_agent.py
────────────────────────
ReAct-style streaming chat agent for Tidewatch Copilot.

LLM is acquired via get_llm() — provider is switched at runtime via LLM_PROVIDER.

For providers that support native tool-calling (groq), tools are bound normally.
For weak tool-calling providers (ollama, huggingface), structured JSON prompting
is used instead to extract tool intent, then tools are invoked manually.
"""
import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any, Dict, List
import uuid

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from sqlalchemy import select

from app.agents.llm import get_llm, supports_native_tools, get_current_provider
from app.agents.tools import (
    ALL_CHAT_TOOLS,
    attack_knowledge_tool,
    get_alert_tool,
    query_flows_tool,
    summarize_window_tool,
)
from app.core.logging import logger
from app.db.session import async_session_factory
from app.models.chat import ChatMessage

SYSTEM_PROMPT = """You are Tidewatch Copilot, an expert AI SecOps and ML Intrusion Detection Analyst.
You assist security engineers in investigating network flows, explaining ML tree-split decisions,
and generating mitigation rules (IPTables, Snort/Suricata, BGP FlowSpec).

You have access to 4 safe tools:
1. `query_flows`: filter and query recent network flows safely (no raw SQL).
2. `get_alert`: look up details and 5-tuple for a specific alert ID.
3. `summarize_window`: get aggregate flow counts, attack ratios, and top IPs over past N minutes.
4. `attack_knowledge`: technical knowledge on DDoS, PortScan, Slowloris, GoldenEye, Botnets.

Always provide concise, structured answers with markdown headers, code blocks for commands,
and reference specific IP addresses and metrics.
"""

TOOL_SELECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "tool": {
            "type": "string",
            "enum": ["query_flows", "get_alert", "summarize_window", "attack_knowledge", "none"],
        },
        "args": {"type": "object"},
    },
    "required": ["tool", "args"],
}


async def get_chat_history(session_id: str, limit: int = 10) -> List[Any]:
    """Loads recent chat history from Neon Postgres for the session."""
    messages = []
    try:
        async with async_session_factory() as session:
            stmt = (
                select(ChatMessage)
                .where(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.desc())
                .limit(limit)
            )
            res = await session.execute(stmt)
            db_messages = list(reversed(res.scalars().all()))

            for m in db_messages:
                if m.role == "user":
                    messages.append(HumanMessage(content=m.content))
                elif m.role == "assistant":
                    messages.append(AIMessage(content=m.content))
    except Exception as e:
        logger.warning(f"Could not load chat history for session {session_id}: {e}")

    return messages


async def persist_chat_message(session_id: str, role: str, content: str) -> None:
    """Persists message to chat_messages table."""
    try:
        async with async_session_factory() as session:
            msg = ChatMessage(
                session_id=session_id,
                role=role,
                content=content,
            )
            session.add(msg)
            await session.commit()
    except Exception as e:
        logger.warning(f"Could not persist chat message: {e}")


async def fallback_stream_response(
    query: str,
    session_id: str,
) -> AsyncGenerator[str, None]:
    """
    Rule-based fallback generator when all LLM providers are unavailable.
    Directly invokes safe ORM tools to provide real data in markdown.
    """
    q = query.lower()

    if "summarize" in q or "hour" in q or "trend" in q:
        summary = await summarize_window_tool.ainvoke({"minutes": 60})
        total = summary.get("total_flows", 0)
        attacks = summary.get("attack_flows", 0)
        rate = summary.get("attack_rate_percent", 0.0)
        breakdown = summary.get("attack_breakdown", {})
        top_ips = summary.get("top_adversary_ips", [])

        full_text = f"""### SecOps Hourly Network Telemetry Summary

- **Total Ingress Flows**: {total:,}
- **Anomalous Threats Flagged**: {attacks:,} ({rate}% attack ratio)
- **Time Window**: Last 60 minutes

#### Attack Vector Breakdown:
"""
        for atk, cnt in breakdown.items():
            full_text += f"- **{atk}**: {cnt} flows\n"
        if not breakdown:
            full_text += "- No attacks detected in this window.\n"

        if top_ips:
            full_text += "\n#### Top Offending Source Hosts:\n"
            for item in top_ips:
                full_text += f"- `{item['ip']}`: {item['attack_count']} malicious flows\n"

        full_text += """
#### Recommended Actions:
1. Verify ingress rate-limiting for active adversary IPs.
2. Ensure internal subnets are monitored for lateral port scanning.
"""
    elif "portscan" in q or "scan" in q or "recon" in q:
        info = attack_knowledge_tool.invoke({"attack_type": "PortScan"})
        full_text = f"""### PortScan Telemetry & Heuristics

**Mechanism**: {info['mechanism']}

**Key Discriminative Features**:
- *Flow Duration*: Under 500 µs (immediate teardown)
- *Total Fwd Packets*: 1 single SYN packet
- *Flags*: SYN=1, RST=1 (received upon closed port probe)

#### Mitigation Command:
```bash
# Quarantine offending IP using iptables recent module
sudo iptables -A INPUT -m recent --name PORTSCAN --set -j DROP
```
"""
    elif "ddos" in q or "loic" in q or "flood" in q:
        info = attack_knowledge_tool.invoke({"attack_type": "DDoS"})
        full_text = f"""### DDoS-LOIC Threat Analysis

**Mechanism**: {info['mechanism']}

**Feature Anomalies**:
- *Flow Packets/s*: Exceeding 25,000 pkts/sec
- *Flow IAT Mean*: Under 35 microseconds
- *Init Win Bytes Forward*: 29,200 bytes (static tool signature)

#### Immediate Mitigation:
```bash
# Drop offending volumetric source immediately at edge firewall
sudo iptables -I INPUT -s 205.174.165.73 -p tcp --dport 80 -j DROP
```
"""
    elif "rule" in q or "iptables" in q or "block" in q:
        full_text = """### Ready-to-Deploy Firewall Mitigation Rules

#### 1. Instant Host Block (IPTables)
```bash
sudo iptables -I INPUT -s 205.174.165.73 -j DROP
```

#### 2. Rate-Limiting Protection (SYN Flood Mitigation)
```bash
sudo iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
```

#### 3. Suricata / Snort IDS Signature
```snort
alert tcp 205.174.165.73 any -> $HOME_NET 80 (msg:"TIDEWATCH - LOIC High Frequency Stream"; flow:to_server; threshold:type threshold, track by_src, count 100, seconds 2; sid:9001001; rev:1;)
```
"""
    else:
        full_text = f"""### Tidewatch Intelligence Engine

I can investigate flow features, compute SHAP contributions, and inspect live alerts from Neon Postgres.

**Try asking:**
- *"Summarize network traffic from the last hour"*
- *"Why was flow #89421 flagged as DDoS?"*
- *"Generate iptables rules for top adversaries"*
- *"Explain the detection heuristics for PortScan"*
"""

    words = full_text.split(" ")
    accumulated = ""
    for word in words:
        chunk = word + " "
        accumulated += chunk
        yield chunk
        await asyncio.sleep(0.015)

    await persist_chat_message(session_id, "assistant", accumulated.strip())


async def _run_tool(tool_name: str, tool_args: dict) -> Any:
    """Execute a named tool from ALL_CHAT_TOOLS."""
    selected_tool = next((t for t in ALL_CHAT_TOOLS if t.name == tool_name), None)
    if not selected_tool:
        return {"error": f"Tool {tool_name!r} not found"}
    try:
        return await selected_tool.ainvoke(tool_args)
    except Exception as te:
        return {"error": str(te)}


async def stream_chat_response(
    query: str,
    session_id: str = "default-session",
) -> AsyncGenerator[str, None]:
    """
    Streams tokens for the Tidewatch Copilot chat agent.
    Supports native tool-calling (groq) and structured JSON prompting (ollama/hf).
    """
    await persist_chat_message(session_id, "user", query)

    try:
        llm = get_llm()
        provider = get_current_provider()
        history = await get_chat_history(session_id, limit=6)
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + history + [HumanMessage(content=query)]

        if supports_native_tools():
            # ── Native tool-calling path (groq) ────────────────────────────
            llm_with_tools = llm.bind_tools(ALL_CHAT_TOOLS)
            ai_response = await llm_with_tools.ainvoke(messages)

            if ai_response.tool_calls:
                tool_messages = []
                for tool_call in ai_response.tool_calls:
                    tool_output = await _run_tool(tool_call["name"], tool_call["args"])
                    logger.info(f"[Chat] Tool {tool_call['name']} → {str(tool_output)[:120]}")
                    tool_messages.append(
                        ToolMessage(
                            content=str(tool_output),
                            tool_call_id=tool_call["id"],
                        )
                    )

                full_content = ""
                async for chunk in llm.astream(messages + [ai_response] + tool_messages):
                    text = chunk.content
                    if text:
                        full_content += text
                        yield text
                await persist_chat_message(session_id, "assistant", full_content)
            else:
                full_content = ""
                async for chunk in llm.astream(messages):
                    text = chunk.content
                    if text:
                        full_content += text
                        yield text
                await persist_chat_message(session_id, "assistant", full_content)

        else:
            # ── Structured JSON prompting path (ollama / huggingface) ───────
            tool_selection_prompt = f"""Given the user query, decide if a tool should be called.
Query: {query}

Available tools: query_flows, get_alert, summarize_window, attack_knowledge, none

Respond ONLY with valid JSON: {{"tool": "<tool_name>", "args": {{...}}}}
Use "none" if no tool is needed."""

            tool_response = await llm.ainvoke([
                SystemMessage(content="You are a tool-selection assistant. Output only valid JSON."),
                HumanMessage(content=tool_selection_prompt),
            ])

            tool_content = tool_response.content.strip()
            if tool_content.startswith("```"):
                tool_content = tool_content.split("```")[1]
                if tool_content.startswith("json"):
                    tool_content = tool_content[4:]
                tool_content = tool_content.strip()

            tool_result_text = ""
            try:
                tool_decision = json.loads(tool_content)
                tool_name = tool_decision.get("tool", "none")
                tool_args = tool_decision.get("args", {})
                if tool_name != "none":
                    tool_output = await _run_tool(tool_name, tool_args)
                    tool_result_text = f"\n\nTool result ({tool_name}):\n{json.dumps(tool_output, default=str)}"
                    logger.info(f"[Chat] Structured tool {tool_name} → {str(tool_output)[:120]}")
            except Exception as te:
                logger.warning(f"[Chat] Tool selection JSON parse error: {te}")

            final_messages = messages + ([HumanMessage(content=f"Tool output:{tool_result_text}")] if tool_result_text else [])
            full_content = ""
            async for chunk in llm.astream(final_messages):
                text = chunk.content
                if text:
                    full_content += text
                    yield text
            await persist_chat_message(session_id, "assistant", full_content)

    except Exception as e:
        logger.warning(f"[Chat] LLM agent error ({get_current_provider()}): {e}. Using rule-based fallback.")
        async for chunk in fallback_stream_response(query, session_id):
            yield chunk
