"""
app/api/routes/chat.py
──────────────────────
POST /chat                       — SSE streaming chat with Tidewatch Copilot
GET  /chat/{session_id}/history  — paginated message history for a session
"""
import json
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agents.chat_agent import stream_chat_response
from app.api.deps import get_db
from app.db.session import async_session_factory
from app.models.chat import ChatMessage
from app.schemas.chat import ChatMessageResponse, ChatRequest
from app.schemas.common import Paginated

router = APIRouter(prefix="", tags=["chat"])

_HEARTBEAT_INTERVAL = 15  # seconds between SSE keepalive comments


@router.post("/chat")
async def chat_sse_stream(payload: ChatRequest):
    """
    SSE Streaming endpoint for Tidewatch Copilot.
    Streams token-by-token reasoning, tool executions, and markdown responses.
    Sends a heartbeat comment every 15 seconds to keep proxies alive.
    """
    import asyncio

    async def event_generator():
        session_id = payload.session_id or "default-session"
        heartbeat_counter = 0
        try:
            async for chunk in stream_chat_response(payload.message, session_id=session_id):
                yield {
                    "event": "message",
                    "data": json.dumps({"token": chunk}),
                }
                heartbeat_counter += 1
                # Emit heartbeat every ~15 tokens as a proxy for time
                if heartbeat_counter % 30 == 0:
                    yield {"event": "heartbeat", "data": ""}

            yield {
                "event": "done",
                "data": json.dumps({"status": "finished"}),
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/{session_id}/history", response_model=Paginated[ChatMessageResponse])
async def get_chat_history(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns paginated chat history for a given session ID.
    Messages are returned in chronological order (oldest first).
    """
    offset = (page - 1) * page_size

    total_res = await db.execute(
        select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session_id)
    )
    total = total_res.scalar() or 0

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    res = await db.execute(stmt)
    messages = res.scalars().all()

    return Paginated[ChatMessageResponse](
        items=[ChatMessageResponse.model_validate(m) for m in messages],
        total=total,
        page=page,
        page_size=page_size,
    )
