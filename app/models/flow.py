from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import DateTime, Float, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, CompatibleJSON


class Flow(Base):
    __tablename__ = "flows"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    src_ip: Mapped[str] = mapped_column(String(45), index=True)
    dst_ip: Mapped[str] = mapped_column(String(45), index=True)
    src_port: Mapped[int] = mapped_column(Integer)
    dst_port: Mapped[int] = mapped_column(Integer, index=True)
    protocol: Mapped[str] = mapped_column(String(10), default="TCP")
    features: Mapped[Dict[str, Any]] = mapped_column(CompatibleJSON)
    prediction: Mapped[str] = mapped_column(String(50), index=True)
    confidence: Mapped[float] = mapped_column(Float)

    # Relationships
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert",
        back_populates="flow",
        cascade="all, delete-orphan",
    )
