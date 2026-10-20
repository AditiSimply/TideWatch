from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    flow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("flows.id", ondelete="CASCADE"),
        index=True,
    )
    attack_type: Mapped[str] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True, default="medium")
    status: Mapped[str] = mapped_column(String(20), index=True, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Relationships
    flow: Mapped["Flow"] = relationship("Flow", back_populates="alerts")
    ai_reports: Mapped[List["AiReport"]] = relationship(
        "AiReport",
        back_populates="alert",
        cascade="all, delete-orphan",
    )
