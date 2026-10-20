from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, CompatibleJSON


class AiReport(Base):
    __tablename__ = "ai_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("alerts.id", ondelete="CASCADE"),
        index=True,
    )
    explanation: Mapped[str] = mapped_column(Text)
    mitigation: Mapped[Dict[str, Any]] = mapped_column(CompatibleJSON)
    severity_score: Mapped[float] = mapped_column(Float, default=5.0)
    # LLM provenance
    provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Relationship
    alert: Mapped["Alert"] = relationship("Alert", back_populates="ai_reports")
