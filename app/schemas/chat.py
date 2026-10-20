from datetime import datetime
from typing import Literal, Optional
import uuid
from app.schemas.common import CamelModel


class ChatRequest(CamelModel):
    session_id: str = "default-session"
    message: str
    flow_id: Optional[uuid.UUID] = None
    alert_id: Optional[uuid.UUID] = None


class ChatMessageResponse(CamelModel):
    id: uuid.UUID
    session_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime


class LLMStatusResponse(CamelModel):
    provider: str
    model: str
    healthy: bool
    error: Optional[str] = None
    native_tool_calling: bool
    fallback_chain: list


class LLMProviderSwitch(CamelModel):
    provider: str
