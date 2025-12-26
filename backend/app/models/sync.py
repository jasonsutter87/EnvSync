"""
Sync Models
Sync state and conflict resolution
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class SyncStatus(str, enum.Enum):
    """Sync status for entities."""

    SYNCED = "synced"
    PENDING = "pending"
    CONFLICT = "conflict"
    ERROR = "error"


class ConflictResolution(str, enum.Enum):
    """How a conflict was resolved."""

    LOCAL_WINS = "local_wins"
    REMOTE_WINS = "remote_wins"
    MERGED = "merged"
    MANUAL = "manual"
    PENDING = "pending"


class SyncState(Base):
    """
    Tracks sync state for each syncable entity.
    Used to determine what needs to be pushed/pulled.
    """

    __tablename__ = "sync_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))

    # Entity reference
    entity_type: Mapped[str] = mapped_column(String(50), index=True)  # project, environment, variable
    entity_id: Mapped[str] = mapped_column(String(36), index=True)

    # Versioning
    local_version: Mapped[int] = mapped_column(Integer, default=0)
    remote_version: Mapped[int] = mapped_column(Integer, default=0)
    base_version: Mapped[int] = mapped_column(Integer, default=0)  # Last known common version

    # Hashes for change detection
    local_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    remote_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Status
    status: Mapped[SyncStatus] = mapped_column(Enum(SyncStatus), default=SyncStatus.PENDING)

    # VeilCloud reference
    veilcloud_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    veilcloud_etag: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Timestamps
    last_local_change: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_remote_change: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship()


class SyncConflict(Base):
    """
    Records sync conflicts for manual resolution.
    Stores both versions until resolved.
    """

    __tablename__ = "sync_conflicts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    sync_state_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sync_states.id", ondelete="CASCADE")
    )

    # Conflict data
    local_data: Mapped[str] = mapped_column(Text)  # JSON, encrypted
    remote_data: Mapped[str] = mapped_column(Text)  # JSON, encrypted
    base_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Common ancestor

    # Resolution
    resolution: Mapped[ConflictResolution] = mapped_column(
        Enum(ConflictResolution), default=ConflictResolution.PENDING
    )
    resolved_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Timestamps
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    sync_state: Mapped["SyncState"] = relationship()
    resolved_by: Mapped[Optional["User"]] = relationship()


# Import for type hints
from app.models.user import User
