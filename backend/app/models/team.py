"""
Team Models
Teams, members, invites, and VeilKey integration
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class TeamRole(str, enum.Enum):
    """Team member roles."""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class InviteStatus(str, enum.Enum):
    """Invite status."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class Team(Base):
    """Team for collaborative secret management."""

    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    # VeilKey configuration (threshold encryption)
    veilkey_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    veilkey_threshold: Mapped[int] = mapped_column(Integer, default=2)  # t-of-n
    veilkey_total_shares: Mapped[int] = mapped_column(Integer, default=3)
    veilkey_public_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # SSO Configuration
    sso_enforced: Mapped[bool] = mapped_column(Boolean, default=False)
    allowed_domains: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array

    # Subscription
    subscription_tier: Mapped[str] = mapped_column(String(20), default="team")
    max_members: Mapped[int] = mapped_column(Integer, default=10)
    max_projects: Mapped[int] = mapped_column(Integer, default=50)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    members: Mapped[List["TeamMember"]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )
    invites: Mapped[List["TeamInvite"]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )
    projects: Mapped[List["Project"]] = relationship(back_populates="team")


class TeamMember(Base):
    """Team membership with role and VeilKey share."""

    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))

    # Role
    role: Mapped[TeamRole] = mapped_column(Enum(TeamRole), default=TeamRole.MEMBER)

    # VeilKey share (encrypted with user's key)
    encrypted_key_share: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_share_version: Mapped[int] = mapped_column(Integer, default=1)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timestamps
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_access_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="team_memberships")


class TeamInvite(Base):
    """Pending team invitations."""

    __tablename__ = "team_invites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(255), index=True)
    invited_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))

    # Invite details
    role: Mapped[TeamRole] = mapped_column(Enum(TeamRole), default=TeamRole.MEMBER)
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus), default=InviteStatus.PENDING)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    # Message
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship(back_populates="invites")
    invited_by: Mapped["User"] = relationship()


# Import for type hints (avoid circular imports)
from app.models.user import User
from app.models.project import Project
