from datetime import datetime, timezone
from typing import Any, Dict
import uuid
from sqlalchemy import DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, CompatibleJSON


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    version: Mapped[str] = mapped_column(String(50), index=True)
    metrics: Mapped[Dict[str, Any]] = mapped_column(CompatibleJSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
