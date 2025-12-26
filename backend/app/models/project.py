"""
Project Models
Projects, environments, and encrypted variables
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Project(Base):
    """Project containing environment variables."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Emoji or icon name

    # Ownership
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    team_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )

    # Encryption metadata
    encryption_version: Mapped[int] = mapped_column(Integer, default=1)
    key_salt: Mapped[str] = mapped_column(String(64))  # Project-specific salt

    # Sync
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    sync_version: Mapped[int] = mapped_column(Integer, default=0)

    # Status
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="projects")
    team: Mapped[Optional["Team"]] = relationship(back_populates="projects")
    environments: Mapped[List["Environment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    integrations: Mapped[List["ServiceIntegration"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Environment(Base):
    """Environment within a project (dev, staging, prod)."""

    __tablename__ = "environments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(50))  # dev, staging, prod, etc.
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # Hex color

    # Sync
    sync_version: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="environments")
    variables: Mapped[List["Variable"]] = relationship(
        back_populates="environment", cascade="all, delete-orphan"
    )


class Variable(Base):
    """
    Encrypted environment variable.
    Key is stored in plaintext for search, value is encrypted.
    """

    __tablename__ = "variables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    environment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("environments.id", ondelete="CASCADE")
    )

    # Variable data (key is plaintext for search, value is encrypted)
    key: Mapped[str] = mapped_column(String(255), index=True)
    encrypted_value: Mapped[str] = mapped_column(Text)  # Base64 encoded encrypted value
    value_nonce: Mapped[str] = mapped_column(String(24))  # Base64 encoded nonce

    # Metadata
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=True)  # Hide value by default
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # History
    version: Mapped[int] = mapped_column(Integer, default=1)
    previous_value_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Sync
    sync_version: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    environment: Mapped["Environment"] = relationship(back_populates="variables")


# Import for type hints (avoid circular imports)
from app.models.user import User
from app.models.team import Team
from app.models.integration import ServiceIntegration
