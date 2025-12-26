"""
Audit Log Model
Tamper-evident audit trail with VeilChain integration
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLog(Base):
    """
    Immutable audit log entry.
    Logs all access and modifications to secrets.
    Integrates with VeilChain for tamper-proof verification.
    """

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # Actor
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    user_email: Mapped[str] = mapped_column(String(255))  # Denormalized for history
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Action
    action: Mapped[str] = mapped_column(String(50), index=True)
    """
    Actions include:
    - user.login, user.logout, user.password_change
    - project.create, project.update, project.delete, project.share
    - environment.create, environment.update, environment.delete
    - variable.create, variable.read, variable.update, variable.delete
    - variable.export, variable.import
    - team.create, team.invite, team.remove_member, team.role_change
    - integration.connect, integration.push, integration.pull
    - admin.user_create, admin.user_suspend, admin.settings_change
    """

    # Resource
    resource_type: Mapped[str] = mapped_column(String(50), index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    resource_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Context
    team_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    environment_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Details
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    changes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON diff
    metadata: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Extra JSON

    # VeilChain integration (for tamper-proof verification)
    veilchain_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    veilchain_block: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Compliance
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info, warning, critical
    compliance_tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array

    # Timestamp (immutable)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Relationships (optional, for querying)
    user: Mapped[Optional["User"]] = relationship()
    team: Mapped[Optional["Team"]] = relationship()
    project: Mapped[Optional["Project"]] = relationship()

    # Composite indexes for common queries
    __table_args__ = (
        Index("ix_audit_user_time", "user_id", "timestamp"),
        Index("ix_audit_team_time", "team_id", "timestamp"),
        Index("ix_audit_project_time", "project_id", "timestamp"),
        Index("ix_audit_action_time", "action", "timestamp"),
    )


# Import for type hints
from app.models.user import User
from app.models.team import Team
from app.models.project import Project
