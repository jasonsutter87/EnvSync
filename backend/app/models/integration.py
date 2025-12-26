"""
Integration Models
Service integrations (Netlify, Vercel, Railway, etc.)
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class ServiceType(str, enum.Enum):
    """Supported service integrations."""

    NETLIFY = "netlify"
    VERCEL = "vercel"
    RAILWAY = "railway"
    FLY_IO = "fly_io"
    AWS_SSM = "aws_ssm"
    GITHUB_ACTIONS = "github_actions"
    GITLAB_CI = "gitlab_ci"
    HEROKU = "heroku"
    RENDER = "render"
    CLOUDFLARE = "cloudflare"


class SyncDirection(str, enum.Enum):
    """Sync direction for integrations."""

    PULL = "pull"  # Service -> EnvSync
    PUSH = "push"  # EnvSync -> Service
    BIDIRECTIONAL = "bidirectional"


class ServiceIntegration(Base):
    """
    Connection to external services for env var sync.
    Tokens are encrypted at rest.
    """

    __tablename__ = "service_integrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )

    # Service details
    service_type: Mapped[ServiceType] = mapped_column(Enum(ServiceType))
    service_name: Mapped[str] = mapped_column(String(100))  # User-friendly name

    # Authentication (encrypted)
    encrypted_access_token: Mapped[str] = mapped_column(Text)
    encrypted_refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_nonce: Mapped[str] = mapped_column(String(24))
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Service-specific identifiers
    external_account_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_project_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_project_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Sync configuration
    sync_direction: Mapped[SyncDirection] = mapped_column(
        Enum(SyncDirection), default=SyncDirection.BIDIRECTIONAL
    )
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_on_deploy: Mapped[bool] = mapped_column(Boolean, default=False)

    # Environment mapping (JSON: { "dev": "development", "prod": "production" })
    environment_mapping: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sync_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sync_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship()
    project: Mapped[Optional["Project"]] = relationship(back_populates="integrations")


# Import for type hints
from app.models.user import User
from app.models.project import Project
