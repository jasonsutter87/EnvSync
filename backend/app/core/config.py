"""
EnvSync Configuration
Application settings and environment configuration
"""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "EnvSync"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "postgresql://envsync:envsync@localhost:5432/envsync"
    DATABASE_ENCRYPTION_KEY: Optional[str] = None  # For encrypted columns

    # Redis (for sessions and caching)
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:4200", "http://localhost:3000"]

    # JWT Authentication
    JWT_SECRET_KEY: str = "jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Encryption (client-side encryption uses these for server-side validation)
    ENCRYPTION_ALGORITHM: str = "AES-256-GCM"
    KEY_DERIVATION: str = "argon2id"
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_COST: int = 65536
    ARGON2_PARALLELISM: int = 4

    # VeilCloud Integration
    VEILCLOUD_API_URL: str = "https://api.veilcloud.io"
    VEILCLOUD_API_KEY: Optional[str] = None

    # SSO/OIDC Configuration
    SSO_ENABLED: bool = False
    OIDC_ISSUER_URL: Optional[str] = None
    OIDC_CLIENT_ID: Optional[str] = None
    OIDC_CLIENT_SECRET: Optional[str] = None
    SAML_ENABLED: bool = False
    SAML_IDP_METADATA_URL: Optional[str] = None

    # Service Integrations
    NETLIFY_CLIENT_ID: Optional[str] = None
    NETLIFY_CLIENT_SECRET: Optional[str] = None
    VERCEL_CLIENT_ID: Optional[str] = None
    VERCEL_CLIENT_SECRET: Optional[str] = None
    RAILWAY_CLIENT_ID: Optional[str] = None
    RAILWAY_CLIENT_SECRET: Optional[str] = None

    # Storage
    STORAGE_BACKEND: str = "local"  # local, s3, gcs
    S3_BUCKET: Optional[str] = None
    S3_REGION: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds

    # Audit Logging
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_RETENTION_DAYS: int = 90

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
