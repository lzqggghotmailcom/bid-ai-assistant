from pydantic_settings import BaseSettings
import secrets


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # App
    APP_NAME: str = "AI投标助手"
    DEBUG: bool = False
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Database — set DATABASE_TYPE=sqlite for dev mode without PostgreSQL
    DATABASE_TYPE: str = "postgresql"
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""
    SQLITE_URL: str = "sqlite+aiosqlite:///./bid_assistant.db"

    # Allowed CORS origins (comma-separated)
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_V4_MODEL: str = "deepseek-v4-pro"
    DEEPSEEK_V3_MODEL: str = "deepseek-chat"

    # Embedding
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DEVICE: str = "cpu"

    # Storage
    UPLOAD_DIR: str = "./uploads"
    OSS_ENDPOINT: str = ""
    OSS_BUCKET: str = ""
    OSS_ACCESS_KEY: str = ""
    OSS_SECRET_KEY: str = ""

    # Limits
    MAX_UPLOAD_SIZE_MB: int = 50
    GENERATION_TIMEOUT_SECONDS: int = 900

    # Payment (PayJS)
    PAYJS_MCHID: str = ""
    PAYJS_KEY: str = ""
    PAYJS_API_URL: str = "https://payjs.cn/api"
    PAYJS_NOTIFY_URL: str = ""  # Set to your public callback URL

    # Subscription plans
    PLANS: dict = {
        "single":     {"name": "单项目",   "price_yuan": 299,  "projects": 1,  "validity_days": 30},
        "quarterly":  {"name": "季度版",   "price_yuan": 899,  "projects": 5,  "validity_days": 90},
        "annual":     {"name": "年度版",   "price_yuan": 2999, "projects": 20, "validity_days": 365},
        "enterprise": {"name": "企业版",   "price_yuan": 9999, "projects": 50, "validity_days": 365},
    }
    FREE_TRIAL_PROJECTS: int = 1


settings = Settings()
