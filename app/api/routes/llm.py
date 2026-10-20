"""
app/api/routes/llm.py
─────────────────────
GET  /llm/status   — returns current provider, model, health, fallback chain
POST /llm/provider — switch active provider at runtime (dev-only)
"""
from fastapi import APIRouter, HTTPException
from app.agents.llm import get_llm_info, set_runtime_provider
from app.core.config import settings
from app.schemas.chat import LLMProviderSwitch, LLMStatusResponse

router = APIRouter(prefix="/llm", tags=["llm"])

_VALID_PROVIDERS = {"groq", "ollama", "huggingface"}


@router.get("/status", response_model=LLMStatusResponse)
async def llm_status():
    """
    Returns the currently active LLM provider, the resolved model name,
    a connectivity health check, and the ordered fallback chain.
    """
    info = get_llm_info()
    return LLMStatusResponse(
        provider=info["provider"],
        model=info["model"],
        healthy=info["healthy"],
        error=info.get("error"),
        native_tool_calling=info["nativeToolCalling"],
        fallback_chain=info["fallbackChain"],
    )


@router.post("/provider", response_model=LLMStatusResponse)
async def switch_provider(payload: LLMProviderSwitch):
    """
    Switches the active LLM provider at runtime.
    Only available when ENV != 'production'.
    """
    if settings.ENV == "production":
        raise HTTPException(
            status_code=403,
            detail="Runtime provider switching is disabled in production. Set ENV=development.",
        )

    provider = payload.provider.lower()
    if provider not in _VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider {provider!r}. Valid options: {sorted(_VALID_PROVIDERS)}",
        )

    set_runtime_provider(provider)
    info = get_llm_info()
    return LLMStatusResponse(
        provider=info["provider"],
        model=info["model"],
        healthy=info["healthy"],
        error=info.get("error"),
        native_tool_calling=info["nativeToolCalling"],
        fallback_chain=info["fallbackChain"],
    )
