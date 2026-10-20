# All models must be imported here so that Alembic's autogenerate
# and SQLAlchemy's metadata can discover the full schema.
from app.models.base import Base  # noqa: F401
from app.models.flow import Flow  # noqa: F401
from app.models.alert import Alert  # noqa: F401
from app.models.model_run import ModelRun  # noqa: F401
from app.models.ai_report import AiReport  # noqa: F401
from app.models.chat import ChatMessage  # noqa: F401

__all__ = ["Base", "Flow", "Alert", "ModelRun", "AiReport", "ChatMessage"]
