"""
Sync Schemas
Request/response models for sync operations
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.sync import SyncStatus as SyncStatusEnum, ConflictResolution as ConflictResEnum


class SyncStatus(BaseModel):
    """Current sync status for an entity."""

    entity_type: str
    entity_id: str
    status: SyncStatusEnum
    local_version: int
    remote_version: int
    last_sync_at: Optional[datetime]
    has_local_changes: bool
    has_remote_changes: bool
    error: Optional[str] = None


class SyncRequest(BaseModel):
    """Request to sync specific entities."""

    project_ids: Optional[List[str]] = None  # None = sync all
    force: bool = False  # Force sync even if no changes detected


class SyncPush(BaseModel):
    """Push local changes to server."""

    entity_type: str
    entity_id: str
    data: str = Field(description="Encrypted JSON data")
    local_version: int
    checksum: str


class SyncPull(BaseModel):
    """Pull request for specific entities."""

    entities: List[Dict[str, Any]]  # [{ "type": "project", "id": "...", "version": 5 }]


class SyncResponse(BaseModel):
    """Sync operation response."""

    success: bool
    pushed: int = 0
    pulled: int = 0
    conflicts: int = 0
    errors: List[str] = []
    sync_time: datetime


class ConflictData(BaseModel):
    """Data for a single side of a conflict."""

    version: int
    data: str = Field(description="Encrypted JSON data")
    modified_at: datetime
    modified_by: Optional[str] = None


class ConflictResponse(BaseModel):
    """Sync conflict requiring resolution."""

    id: str
    entity_type: str
    entity_id: str
    entity_name: Optional[str]
    local: ConflictData
    remote: ConflictData
    base: Optional[ConflictData] = None
    detected_at: datetime


class ConflictResolution(BaseModel):
    """Resolve a sync conflict."""

    conflict_id: str
    resolution: ConflictResEnum
    resolved_data: Optional[str] = None  # Required for MERGED resolution


class ConflictListResponse(BaseModel):
    """List of pending conflicts."""

    conflicts: List[ConflictResponse]
    total: int


class VeilCloudStatus(BaseModel):
    """VeilCloud connection status."""

    connected: bool
    authenticated: bool
    last_sync: Optional[datetime]
    storage_used: int = 0  # bytes
    storage_limit: int = 0  # bytes
    error: Optional[str] = None


class SyncSettings(BaseModel):
    """User sync settings."""

    auto_sync_enabled: bool = True
    sync_interval_minutes: int = Field(default=5, ge=1, le=60)
    conflict_resolution: str = "ask"  # ask, local_wins, remote_wins
    sync_on_change: bool = True
