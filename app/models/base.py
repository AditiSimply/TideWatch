from datetime import datetime, timezone
import uuid
from sqlalchemy import DateTime, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON

# JSON field that uses JSONB on PostgreSQL and JSON on SQLite/others
CompatibleJSON = JSON().with_variant(JSONB, "postgresql")


class Base(DeclarativeBase):
    pass


class TimeStampedModel(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
