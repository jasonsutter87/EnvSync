"""
Admin API Routes
System administration, user management, and enterprise features
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password, generate_salt
from app.core.config import settings
from app.models.user import User
from app.models.project import Project, Environment, Variable
from app.models.team import Team, TeamMember
from app.models.audit import AuditLog
from app.schemas.admin import (
    AdminUserResponse,
    AdminUserUpdate,
    AdminUserCreate,
    AdminUserList,
    AdminStats,
    SystemSettings,
    AuditLogQuery,
    ComplianceReport,
    SystemHealth,
)
from app.api.deps import get_admin_user

router = APIRouter()


@router.get("/stats", response_model=AdminStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Get system-wide statistics."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # User counts
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    active_users = (await db.execute(
        select(func.count()).where(User.is_active == True)
    )).scalar() or 0
    verified_users = (await db.execute(
        select(func.count()).where(User.is_verified == True)
    )).scalar() or 0
    admin_users = (await db.execute(
        select(func.count()).where(User.is_admin == True)
    )).scalar() or 0

    # Project counts
    total_projects = (await db.execute(select(func.count()).select_from(Project))).scalar() or 0
    total_environments = (await db.execute(select(func.count()).select_from(Environment))).scalar() or 0
    total_variables = (await db.execute(select(func.count()).select_from(Variable))).scalar() or 0

    # Team counts
    total_teams = (await db.execute(select(func.count()).select_from(Team))).scalar() or 0
    total_team_members = (await db.execute(select(func.count()).select_from(TeamMember))).scalar() or 0

    # Subscription counts
    free_users = (await db.execute(
        select(func.count()).where(User.subscription_tier == "free")
    )).scalar() or 0
    pro_users = (await db.execute(
        select(func.count()).where(User.subscription_tier == "pro")
    )).scalar() or 0
    team_users = (await db.execute(
        select(func.count()).where(User.subscription_tier == "team")
    )).scalar() or 0
    enterprise_users = (await db.execute(
        select(func.count()).where(User.subscription_tier == "enterprise")
    )).scalar() or 0

    # Activity counts
    logins_today = (await db.execute(
        select(func.count())
        .where(AuditLog.action == "user.login")
        .where(AuditLog.timestamp >= today_start)
    )).scalar() or 0
    logins_week = (await db.execute(
        select(func.count())
        .where(AuditLog.action == "user.login")
        .where(AuditLog.timestamp >= week_start)
    )).scalar() or 0
    syncs_today = (await db.execute(
        select(func.count())
        .where(AuditLog.action.like("sync.%"))
        .where(AuditLog.timestamp >= today_start)
    )).scalar() or 0
    syncs_week = (await db.execute(
        select(func.count())
        .where(AuditLog.action.like("sync.%"))
        .where(AuditLog.timestamp >= week_start)
    )).scalar() or 0

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        admin_users=admin_users,
        total_projects=total_projects,
        total_environments=total_environments,
        total_variables=total_variables,
        total_teams=total_teams,
        total_team_members=total_team_members,
        free_users=free_users,
        pro_users=pro_users,
        team_users=team_users,
        enterprise_users=enterprise_users,
        logins_today=logins_today,
        logins_week=logins_week,
        syncs_today=syncs_today,
        syncs_week=syncs_week,
        storage_used_bytes=0,  # Would calculate from actual storage
        storage_limit_bytes=1024 * 1024 * 1024 * 100,  # 100GB
    )


@router.get("/users", response_model=AdminUserList)
async def list_users(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    subscription_tier: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """List all users with filtering."""
    query = select(User)

    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%")
        )
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if subscription_tier:
        query = query.where(User.subscription_tier == subscription_tier)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    # Build responses with counts
    responses = []
    for user in users:
        project_count = (await db.execute(
            select(func.count()).where(Project.owner_id == user.id)
        )).scalar() or 0
        team_count = (await db.execute(
            select(func.count())
            .select_from(TeamMember)
            .where(TeamMember.user_id == user.id)
            .where(TeamMember.is_active == True)
        )).scalar() or 0

        response = AdminUserResponse.model_validate(user)
        response.project_count = project_count
        response.team_count = team_count
        responses.append(response)

    return AdminUserList(
        users=responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Create a new user (admin only)."""
    # Check for existing user
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    import base64
    salt = generate_salt()

    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        master_key_salt=base64.b64encode(salt).decode(),
        is_admin=data.is_admin,
        subscription_tier=data.subscription_tier,
        is_verified=True,  # Admin-created users are pre-verified
    )
    db.add(user)

    # Audit log
    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=admin.id,
        user_email=admin.email,
        action="admin.user_create",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.add(log)

    await db.commit()
    await db.refresh(user)

    return AdminUserResponse.model_validate(user)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Get user details."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    project_count = (await db.execute(
        select(func.count()).where(Project.owner_id == user.id)
    )).scalar() or 0
    team_count = (await db.execute(
        select(func.count())
        .select_from(TeamMember)
        .where(TeamMember.user_id == user.id)
        .where(TeamMember.is_active == True)
    )).scalar() or 0

    response = AdminUserResponse.model_validate(user)
    response.project_count = project_count
    response.team_count = team_count
    return response


@router.put("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: str,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update user details."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_verified is not None:
        user.is_verified = data.is_verified
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.subscription_tier is not None:
        user.subscription_tier = data.subscription_tier
    if data.subscription_expires is not None:
        user.subscription_expires = data.subscription_expires

    # Audit log
    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=admin.id,
        user_email=admin.email,
        action="admin.user_update",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.add(log)

    await db.commit()
    await db.refresh(user)

    return AdminUserResponse.model_validate(user)


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Suspend a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend your own account",
        )

    user.is_active = False

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=admin.id,
        user_email=admin.email,
        action="admin.user_suspend",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
        severity="warning",
    )
    db.add(log)

    await db.commit()

    return {"message": "User suspended"}


@router.post("/users/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Unsuspend a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = True

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=admin.id,
        user_email=admin.email,
        action="admin.user_unsuspend",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.add(log)

    await db.commit()

    return {"message": "User unsuspended"}


@router.get("/settings", response_model=SystemSettings)
async def get_system_settings(
    _: User = Depends(get_admin_user),
):
    """Get system settings."""
    # In production, would load from database/config
    return SystemSettings()


@router.put("/settings", response_model=SystemSettings)
async def update_system_settings(
    data: SystemSettings,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update system settings."""
    # In production, would save to database/config

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=admin.id,
        user_email=admin.email,
        action="admin.settings_change",
        resource_type="system",
        severity="warning",
    )
    db.add(log)
    await db.commit()

    return data


@router.get("/audit", response_model=dict)
async def query_audit_logs(
    user_id: Optional[str] = Query(None),
    team_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Query audit logs with filters."""
    query = select(AuditLog)

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if team_id:
        query = query.where(AuditLog.team_id == team_id)
    if project_id:
        query = query.where(AuditLog.project_id == project_id)
    if action:
        query = query.where(AuditLog.action.like(f"%{action}%"))
    if severity:
        query = query.where(AuditLog.severity == severity)
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "entries": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_email": log.user_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "resource_name": log.resource_name,
                "ip_address": log.ip_address,
                "severity": log.severity,
                "timestamp": log.timestamp.isoformat(),
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/health", response_model=SystemHealth)
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Get system health status."""
    checks = {}

    # Database check
    try:
        await db.execute(select(func.count()).select_from(User))
        checks["database"] = True
    except Exception:
        checks["database"] = False

    # Redis check (placeholder)
    checks["redis"] = True  # Would actually check Redis

    # VeilCloud check
    checks["veilcloud"] = settings.VEILCLOUD_API_KEY is not None

    # Storage check
    checks["storage"] = True  # Would check storage backend

    all_healthy = all(checks.values())

    return SystemHealth(
        status="healthy" if all_healthy else "degraded",
        database=checks["database"],
        redis=checks["redis"],
        veilcloud=checks["veilcloud"],
        storage=checks["storage"],
        checks=checks,
        last_check=datetime.now(timezone.utc),
    )
