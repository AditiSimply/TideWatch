import json
from typing import List, Literal, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


LLMProvider = Literal["groq", "ollama", "huggingface"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Tidewatch NIDS"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENV: str = "development"  # "production" disables runtime provider switch

    # -----------------------------------------------------------------------
    # Database
    # -----------------------------------------------------------------------
    DATABASE_URL: str = "sqlite+aiosqlite:///./tidewatch.db"
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # -----------------------------------------------------------------------
    # LLM Provider selection
    # -----------------------------------------------------------------------
    LLM_PROVIDER: LLMProvider = "groq"

    # Groq
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"

    # HuggingFace
    HUGGINGFACEHUB_API_TOKEN: Optional[str] = None
    HF_MODEL: str = "Qwen/Qwen2.5-7B-Instruct"

    # Shared LLM settings
    LLM_TIMEOUT_SECONDS: float = 20.0
    LLM_MAX_RETRIES: int = 2

    # -----------------------------------------------------------------------
    # CORS
    # -----------------------------------------------------------------------
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # -----------------------------------------------------------------------
    # Artifacts
    # -----------------------------------------------------------------------
    MODEL_ARTIFACTS_DIR: str = "artifacts"
    SIMULATION_DATA_PATH: str = "artifacts/test_samples.csv"

    # -----------------------------------------------------------------------
    # Logging
    # -----------------------------------------------------------------------
    LOG_LEVEL: str = "INFO"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:5173"]

    @property
    def async_database_url(self) -> str:
        """
        Ensures the database URL uses an async driver:
        asyncpg for PostgreSQL/Neon, aiosqlite for SQLite.

        Strips libpq-specific query params (sslmode, channel_binding, etc.)
        that asyncpg does not accept; SSL is handled via connect_args in
        session.py instead.
        """
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("sqlite://") and not url.startswith("sqlite+aiosqlite://"):
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)

        # Drop query params that asyncpg rejects (Neon appends these).
        if "?" in url:
            import re
            base, _, query = url.partition("?")
            kept = [
                kv
                for kv in query.split("&")
                if kv and not kv.lower().startswith(
                    ("sslmode=", "channel_binding=", "ssl=", "uselibpqcompat=")
                )
            ]
            url = base + ("?" + "&".join(kept) if kept else "")
        return url

    @property
    def is_postgres(self) -> bool:
        return "postgresql" in self.DATABASE_URL or "postgres" in self.DATABASE_URL


settings = Settings()
