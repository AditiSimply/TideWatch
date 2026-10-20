from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.routes import alerts, chat, flows, llm, model, predict, stats, stream
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.db.base import Base
from app.db.session import engine
from app.ml.predictor import get_predictor


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    setup_logging()
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} (provider={settings.LLM_PROVIDER})")

    # Load ML predictor (trains if artifacts missing)
    try:
        predictor = get_predictor()
        logger.info(f"ML predictor ready — {len(predictor.feature_names)} features loaded")
    except Exception as e:
        logger.error(f"Failed to load ML predictor: {e}", exc_info=True)

    # Bootstrap DB tables (Alembic handles production; this covers dev SQLite)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection OK")
    except Exception as e:
        logger.warning(f"Database bootstrap warning: {e}")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Disposing DB engine pool...")
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Tidewatch — real-time ML Network Intrusion Detection System API. "
        "Supports Groq, Ollama, and HuggingFace LLM providers. "
        "All responses use camelCase JSON fields."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global error envelope middleware ──────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": str(exc), "details": None}},
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Any) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"error": {"code": "NOT_FOUND", "message": f"Route {request.url.path} not found.", "details": None}},
    )


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check() -> Dict[str, Any]:
    """Health check: database ping and ML engine status."""
    db_status = "ok"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {e}"

    predictor = get_predictor()
    ml_status = "ok" if predictor and predictor.model is not None else "unloaded"

    from app.agents.llm import get_llm_info
    llm_info = get_llm_info()

    return {
        "status": "healthy" if db_status == "ok" and ml_status == "ok" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status,
        "mlEngine": ml_status,
        "ml_engine": ml_status,
        "llm": {
            "provider": llm_info["provider"],
            "model": llm_info["model"],
            "healthy": llm_info["healthy"],
        },
    }


# ── Routes ────────────────────────────────────────────────────────────────────
PREFIX = settings.API_V1_STR

app.include_router(predict.router, prefix=PREFIX)
app.include_router(flows.router, prefix=PREFIX)
app.include_router(alerts.router, prefix=PREFIX)
app.include_router(stats.router, prefix=PREFIX)
app.include_router(model.router, prefix=PREFIX)
app.include_router(stream.router, prefix=PREFIX)
app.include_router(chat.router, prefix=PREFIX)
app.include_router(llm.router, prefix=PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
