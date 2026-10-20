from collections.abc import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.ml.predictor import Predictor, get_predictor

# Re-export for route injection
__all__ = ["get_db", "get_predictor", "AsyncSession", "Predictor"]
