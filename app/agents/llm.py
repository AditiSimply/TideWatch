"""
app/agents/llm.py
─────────────────
Multi-provider LLM gateway for Tidewatch.

Supported providers (set LLM_PROVIDER env var):
  groq          ChatGroq, requires GROQ_API_KEY
  ollama        ChatOllama, requires a local Ollama server
  huggingface   ChatHuggingFace + HuggingFaceEndpoint, requires HUGGINGFACEHUB_API_TOKEN

Fallback chain:
  primary provider → next configured provider → raises RuntimeError
  LangChain's .with_fallbacks() wraps the final chain.

Models that do NOT support native tool-calling (ollama, huggingface) use
structured output via JSON-schema prompting + Pydantic parsing instead.
"""

from __future__ import annotations

import threading
from typing import Any, Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import Runnable

from app.core.config import Settings, settings as _default_settings
from app.core.logging import logger

# ── runtime-mutable provider state ─────────────────────────────────────────────
_lock = threading.Lock()
_runtime_provider: str | None = None  # None → use settings.LLM_PROVIDER


def get_current_provider() -> str:
    with _lock:
        return _runtime_provider or _default_settings.LLM_PROVIDER


def set_runtime_provider(provider: str) -> None:
    """Switch provider at runtime (dev-only)."""
    with _lock:
        global _runtime_provider
        _runtime_provider = provider
    logger.info(f"[LLM] Runtime provider switched to: {provider}")


# ── provider factories ──────────────────────────────────────────────────────────

def _make_groq(cfg: Settings) -> BaseChatModel:
    from langchain_groq import ChatGroq

    if not cfg.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured")
    return ChatGroq(
        model=cfg.GROQ_MODEL,
        api_key=cfg.GROQ_API_KEY,
        temperature=0.1,
        max_retries=cfg.LLM_MAX_RETRIES,
        timeout=cfg.LLM_TIMEOUT_SECONDS,
    )


def _make_ollama(cfg: Settings) -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=cfg.OLLAMA_MODEL,
        base_url=cfg.OLLAMA_BASE_URL,
        temperature=0.1,
        num_predict=1024,
    )


def _make_huggingface(cfg: Settings) -> BaseChatModel:
    from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

    if not cfg.HUGGINGFACEHUB_API_TOKEN:
        raise RuntimeError("HUGGINGFACEHUB_API_TOKEN is not configured")
    endpoint = HuggingFaceEndpoint(
        repo_id=cfg.HF_MODEL,
        huggingfacehub_api_token=cfg.HUGGINGFACEHUB_API_TOKEN,
        task="text-generation",
        max_new_tokens=1024,
        temperature=0.1,
        timeout=cfg.LLM_TIMEOUT_SECONDS,
    )
    return ChatHuggingFace(llm=endpoint)


_FACTORIES = {
    "groq": _make_groq,
    "ollama": _make_ollama,
    "huggingface": _make_huggingface,
}

# Providers that support native tool-calling reliably
_NATIVE_TOOL_PROVIDERS = {"groq"}


def _build_provider(name: str, cfg: Settings) -> BaseChatModel:
    factory = _FACTORIES.get(name)
    if factory is None:
        raise ValueError(f"Unknown LLM provider: {name!r}. Choose from: {list(_FACTORIES)}")
    return factory(cfg)


def _fallback_chain_names(primary: str) -> list[str]:
    """Returns provider names to try after primary, in priority order."""
    order = ["groq", "ollama", "huggingface"]
    idx = order.index(primary) if primary in order else len(order)
    return order[idx + 1:]


def get_llm(cfg: Settings | None = None) -> Runnable:
    """
    Build and return the active LLM with automatic fallback wrapping.

    Returns a LangChain Runnable. If the primary provider is unavailable,
    falls back through the chain of other configured providers.
    """
    cfg = cfg or _default_settings
    primary_name = get_current_provider()

    try:
        primary_llm = _build_provider(primary_name, cfg)
    except Exception as e:
        logger.error(f"[LLM] Primary provider {primary_name!r} failed to initialize: {e}")
        # Try next in chain
        for fallback_name in _fallback_chain_names(primary_name):
            try:
                logger.warning(f"[LLM] Falling back to provider: {fallback_name!r}")
                primary_llm = _build_provider(fallback_name, cfg)
                primary_name = fallback_name
                break
            except Exception as fe:
                logger.warning(f"[LLM] Fallback {fallback_name!r} also failed: {fe}")
        else:
            raise RuntimeError(
                "All LLM providers are unavailable. "
                "Set GROQ_API_KEY, or run Ollama locally, or set HUGGINGFACEHUB_API_TOKEN."
            )

    # Build fallback runnables for remaining providers
    fallbacks: list[Runnable] = []
    for fb_name in _fallback_chain_names(primary_name):
        try:
            fb_llm = _build_provider(fb_name, cfg)
            fallbacks.append(fb_llm)
        except Exception:
            pass  # Skip unconfigured fallbacks silently

    if fallbacks:
        return primary_llm.with_fallbacks(fallbacks)
    return primary_llm


def supports_native_tools() -> bool:
    """Returns True if the current provider reliably supports native tool-calling."""
    return get_current_provider() in _NATIVE_TOOL_PROVIDERS


def get_llm_info(cfg: Settings | None = None) -> dict[str, Any]:
    """
    Returns metadata about the active LLM provider and health status.
    Used by GET /llm/status.
    """
    cfg = cfg or _default_settings
    provider = get_current_provider()

    model_map = {
        "groq": cfg.GROQ_MODEL,
        "ollama": cfg.OLLAMA_MODEL,
        "huggingface": cfg.HF_MODEL,
    }

    # Check health by attempting to instantiate
    healthy = False
    error_msg: str | None = None
    try:
        _build_provider(provider, cfg)
        healthy = True
    except Exception as e:
        error_msg = str(e)

    # Build fallback chain info
    fallback_chain: list[dict] = []
    for fb_name in _fallback_chain_names(provider):
        fb_healthy = False
        try:
            _build_provider(fb_name, cfg)
            fb_healthy = True
        except Exception:
            pass
        fallback_chain.append({
            "provider": fb_name,
            "model": model_map.get(fb_name, "unknown"),
            "healthy": fb_healthy,
        })

    return {
        "provider": provider,
        "model": model_map.get(provider, "unknown"),
        "healthy": healthy,
        "error": error_msg,
        "nativeToolCalling": supports_native_tools(),
        "fallbackChain": fallback_chain,
    }
