from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from app.schemas.common import CamelModel


class FlowResponse(CamelModel):
    id: uuid.UUID
    ts: datetime
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    features: Optional[Dict[str, Any]] = None
    prediction: Optional[str] = None
    confidence: Optional[float] = None
