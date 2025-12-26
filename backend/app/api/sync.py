"""
Sync API Routes
Synchronization with VeilCloud
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.sync import SyncState, SyncConflict, SyncStatus as SyncStatusEnum
from app.models.audit import AuditLog
from app.schemas.sync import (
    SyncStatus,
    SyncRequest,
    SyncResponse,
    SyncPush,
    SyncPull,
    ConflictResponse,
    ConflictResolution,
    ConflictListResponse,
    VeilCloudStatus,
    SyncSettings,
)
from app.api.deps import get_current_active_user

router = APIRouter()


@router.get("/status", response_model=VeilCloudStatus)
async def get_sync_status(
    current_user: User = Depends(get_current_active_user),
):
    """Get VeilCloud connection and sync status."""
    # In production, this would check actual VeilCloud connection
    return VeilCloudStatus(
        connected=settings.VEILCLOUD_API_KEY is not None,
        authenticated=settings.VEILCLOUD_API_KEY is not None,
        last_sync=None,
        storage_used=0,
        storage_limit=1024 * 1024 * 100,  # 100MB
        error=None if settings.VEILCLOUD_API_KEY else "VeilCloud not configured",
    )


@router.post("/sync", response_model=SyncResponse)
async def sync_projects(
    data: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Sync projects with VeilCloud.
    Pushes local changes and pulls remote changes.
    """
    if not settings.VEILCLOUD_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VeilCloud sync not configured",
        )

    # Get projects to sync
    query = select(Project).where(Project.owner_id == current_user.id)
    if data.project_ids:
        query = query.where(Project.id.in_(data.project_ids))

    result = await db.execute(query)
    projects = result.scalars().all()

    pushed = 0
    pulled = 0
    conflicts = 0
    errors = []

    for project in projects:
        try:
            # Get sync state
            state_result = await db.execute(
                select(SyncState)
                .where(SyncState.user_id == current_user.id)
                .where(SyncState.entity_type == "project")
                .where(SyncState.entity_id == project.id)
            )
            sync_state = state_result.scalar_one_or_none()

            if not sync_state:
                # Create sync state
                sync_state = SyncState(
                    id=str(uuid.uuid4()),
                    user_id=current_user.id,
                    entity_type="project",
                    entity_id=project.id,
                    veilcloud_path=f"projects/{project.id}",
                )
                db.add(sync_state)

            # TODO: Actual VeilCloud sync logic
            # For now, just mark as synced
            sync_state.status = SyncStatusEnum.SYNCED
            sync_state.last_sync_at = datetime.now(timezone.utc)
            sync_state.local_version = project.sync_version
            sync_state.remote_version = project.sync_version

            project.sync_enabled = True
            project.last_synced_at = datetime.now(timezone.utc)
            pushed += 1

        except Exception as e:
            errors.append(f"Project {project.name}: {str(e)}")

    await _log_action(db, current_user, "sync.complete", f"{pushed} pushed, {pulled} pulled")
    await db.commit()

    return SyncResponse(
        success=len(errors) == 0,
        pushed=pushed,
        pulled=pulled,
        conflicts=conflicts,
        errors=errors,
        sync_time=datetime.now(timezone.utc),
    )


@router.post("/push", response_model=dict)
async def push_changes(
    data: SyncPush,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Push local changes to VeilCloud."""
    if not settings.VEILCLOUD_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VeilCloud sync not configured",
        )

    # Get or create sync state
    result = await db.execute(
        select(SyncState)
        .where(SyncState.user_id == current_user.id)
        .where(SyncState.entity_type == data.entity_type)
        .where(SyncState.entity_id == data.entity_id)
    )
    sync_state = result.scalar_one_or_none()

    if not sync_state:
        sync_state = SyncState(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            veilcloud_path=f"{data.entity_type}s/{data.entity_id}",
        )
        db.add(sync_state)

    # Check for conflicts
    if sync_state.remote_version > sync_state.base_version and data.local_version <= sync_state.base_version:
        # Conflict detected
        conflict = SyncConflict(
            id=str(uuid.uuid4()),
            sync_state_id=sync_state.id,
            local_data=data.data,
            remote_data="",  # Would be fetched from VeilCloud
        )
        db.add(conflict)
        sync_state.status = SyncStatusEnum.CONFLICT
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sync conflict detected",
        )

    # TODO: Push to VeilCloud
    sync_state.local_version = data.local_version
    sync_state.remote_version = data.local_version
    sync_state.base_version = data.local_version
    sync_state.local_hash = data.checksum
    sync_state.remote_hash = data.checksum
    sync_state.status = SyncStatusEnum.SYNCED
    sync_state.last_sync_at = datetime.now(timezone.utc)
    sync_state.last_local_change = datetime.now(timezone.utc)

    await db.commit()

    return {"success": True, "version": data.local_version}


@router.post("/pull", response_model=dict)
async def pull_changes(
    data: SyncPull,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Pull remote changes from VeilCloud."""
    if not settings.VEILCLOUD_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VeilCloud sync not configured",
        )

    updates = []

    for entity in data.entities:
        # Get sync state
        result = await db.execute(
            select(SyncState)
            .where(SyncState.user_id == current_user.id)
            .where(SyncState.entity_type == entity["type"])
            .where(SyncState.entity_id == entity["id"])
        )
        sync_state = result.scalar_one_or_none()

        if sync_state and sync_state.remote_version > entity.get("version", 0):
            # TODO: Fetch from VeilCloud
            updates.append({
                "type": entity["type"],
                "id": entity["id"],
                "version": sync_state.remote_version,
                "data": "",  # Would contain encrypted data from VeilCloud
            })

    return {"updates": updates}


@router.get("/conflicts", response_model=ConflictListResponse)
async def list_conflicts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List pending sync conflicts."""
    result = await db.execute(
        select(SyncConflict)
        .join(SyncState)
        .where(SyncState.user_id == current_user.id)
        .where(SyncConflict.resolution == "pending")
    )
    conflicts = result.scalars().all()

    return ConflictListResponse(
        conflicts=[
            ConflictResponse(
                id=c.id,
                entity_type=c.sync_state.entity_type,
                entity_id=c.sync_state.entity_id,
                entity_name=None,
                local={"version": 0, "data": c.local_data, "modified_at": c.detected_at},
                remote={"version": 0, "data": c.remote_data, "modified_at": c.detected_at},
                detected_at=c.detected_at,
            )
            for c in conflicts
        ],
        total=len(conflicts),
    )


@router.post("/conflicts/{conflict_id}/resolve", response_model=dict)
async def resolve_conflict(
    conflict_id: str,
    data: ConflictResolution,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Resolve a sync conflict."""
    result = await db.execute(
        select(SyncConflict)
        .join(SyncState)
        .where(SyncConflict.id == conflict_id)
        .where(SyncState.user_id == current_user.id)
    )
    conflict = result.scalar_one_or_none()

    if not conflict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict not found")

    from app.models.sync import ConflictResolution as ConflictResEnum

    conflict.resolution = data.resolution
    conflict.resolved_data = data.resolved_data
    conflict.resolved_by_id = current_user.id
    conflict.resolved_at = datetime.now(timezone.utc)

    # Update sync state
    sync_state = conflict.sync_state
    sync_state.status = SyncStatusEnum.SYNCED

    await db.commit()

    return {"success": True}


@router.get("/settings", response_model=SyncSettings)
async def get_sync_settings(
    current_user: User = Depends(get_current_active_user),
):
    """Get user sync settings."""
    # In production, would fetch from user preferences
    return SyncSettings(
        auto_sync_enabled=True,
        sync_interval_minutes=5,
        conflict_resolution="ask",
        sync_on_change=True,
    )


@router.put("/settings", response_model=SyncSettings)
async def update_sync_settings(
    data: SyncSettings,
    current_user: User = Depends(get_current_active_user),
):
    """Update user sync settings."""
    # In production, would save to user preferences
    return data


async def _log_action(
    db: AsyncSession,
    user: User,
    action: str,
    details: str,
):
    """Log sync action to audit trail."""
    if not settings.AUDIT_LOG_ENABLED:
        return

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type="sync",
        details=details,
    )
    db.add(log)
