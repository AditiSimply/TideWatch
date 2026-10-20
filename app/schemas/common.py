"""
app/schemas/common.py
─────────────────────
Shared schema primitives used across all routes:
  - CamelCase config mixin
  - Paginated response wrapper
  - Consistent error envelope
"""
from __future__ import annotations

from typing import Any, Generic, List, Optional, TypeVar
import re
from pydantic import BaseModel, ConfigDict, model_serializer
from pydantic.alias_generators import to_camel


T = TypeVar("T")


class CamelModel(BaseModel):
    """Base model that serialises fields as camelCase for TypeScript frontend while preserving snake_case."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # also accept snake_case on input
        from_attributes=True,
    )

    @model_serializer(mode="wrap")
    def serialize_dual_case(self, handler):
        data = handler(self)
        if isinstance(data, dict):
            extra = {}
            for k, v in data.items():
                snake_k = re.sub(r"(?<!^)(?=[A-Z])", "_", k).lower()
                if snake_k != k and snake_k not in data:
                    extra[snake_k] = v
            data.update(extra)
        return data


class Paginated(CamelModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int


class ErrorDetail(CamelModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorEnvelope(CamelModel):
    error: ErrorDetail
