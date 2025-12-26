"""
Teams API Routes
Team management, invitations, and VeilKey integration
"""
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import hash_api_key
from app.models.user import User
from app.models.project import Project
from app.models.team import Team, TeamMember, TeamInvite, TeamRole, InviteStatus
from app.models.audit import AuditLog
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamDetail,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamInviteCreate,
    TeamInviteResponse,
    TeamInviteAccept,
    AuditLogEntry,
    AuditLogResponse,
)
from app.api.deps import (
    get_current_active_user,
    get_team_member,
    require_team_admin,
    require_team_owner,
)

router = APIRouter()


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List teams the user is a member of."""
    result = await db.execute(
        select(Team)
        .join(TeamMember)
        .where(TeamMember.user_id == current_user.id)
        .where(TeamMember.is_active == True)
        .where(Team.is_active == True)
    )
    teams = result.scalars().all()

    responses = []
    for team in teams:
        member_count = await db.execute(
            select(func.count()).where(TeamMember.team_id == team.id).where(TeamMember.is_active == True)
        )
        project_count = await db.execute(
            select(func.count()).where(Project.team_id == team.id)
        )

        response = TeamResponse.model_validate(team)
        response.member_count = member_count.scalar() or 0
        response.project_count = project_count.scalar() or 0
        responses.append(response)

    return responses


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new team."""
    # Check for duplicate slug
    result = await db.execute(select(Team).where(Team.slug == data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team slug already exists",
        )

    # Create team
    team = Team(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        slug=data.slug,
        veilkey_enabled=data.veilkey_enabled,
        veilkey_threshold=data.veilkey_threshold,
        veilkey_total_shares=data.veilkey_total_shares,
    )
    db.add(team)

    # Add creator as owner
    member = TeamMember(
        id=str(uuid.uuid4()),
        team_id=team.id,
        user_id=current_user.id,
        role=TeamRole.OWNER,
    )
    db.add(member)

    await _log_action(db, current_user, "team.create", team.id, team.name)
    await db.commit()
    await db.refresh(team)

    response = TeamResponse.model_validate(team)
    response.member_count = 1
    response.project_count = 0
    return response


@router.get("/{team_id}", response_model=TeamDetail)
async def get_team(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(get_team_member),
):
    """Get team details."""
    result = await db.execute(
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.members))
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Get current user's role
    member_result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.user_id == current_user.id)
    )
    current_member = member_result.scalar_one_or_none()

    # Build member responses with user info
    members = []
    for m in team.members:
        if not m.is_active:
            continue
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        user = user_result.scalar_one()
        members.append(TeamMemberResponse(
            id=m.id,
            user_id=m.user_id,
            user_email=user.email,
            user_name=user.name,
            role=m.role,
            is_active=m.is_active,
            has_key_share=m.encrypted_key_share is not None,
            joined_at=m.joined_at,
            last_access_at=m.last_access_at,
        ))

    response = TeamDetail.model_validate(team)
    response.members = members
    response.member_count = len(members)
    response.current_user_role = current_member.role if current_member else None

    return response


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(require_team_admin),
):
    """Update team settings."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    if data.name is not None:
        team.name = data.name
    if data.description is not None:
        team.description = data.description
    if data.veilkey_threshold is not None:
        team.veilkey_threshold = data.veilkey_threshold
    if data.sso_enforced is not None:
        team.sso_enforced = data.sso_enforced
    if data.allowed_domains is not None:
        import json
        team.allowed_domains = json.dumps(data.allowed_domains)

    await _log_action(db, current_user, "team.update", team.id, team.name)
    await db.commit()
    await db.refresh(team)

    return TeamResponse.model_validate(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(require_team_owner),
):
    """Delete a team."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    await _log_action(db, current_user, "team.delete", team.id, team.name)
    await db.delete(team)
    await db.commit()


# Members
@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_members(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(get_team_member),
):
    """List team members."""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.is_active == True)
    )
    members = result.scalars().all()

    responses = []
    for m in members:
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        user = user_result.scalar_one()
        responses.append(TeamMemberResponse(
            id=m.id,
            user_id=m.user_id,
            user_email=user.email,
            user_name=user.name,
            role=m.role,
            is_active=m.is_active,
            has_key_share=m.encrypted_key_share is not None,
            joined_at=m.joined_at,
            last_access_at=m.last_access_at,
        ))

    return responses


@router.put("/{team_id}/members/{member_id}", response_model=TeamMemberResponse)
async def update_member(
    team_id: str,
    member_id: str,
    data: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    admin_member: TeamMember = Depends(require_team_admin),
):
    """Update a team member's role."""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.id == member_id)
        .where(TeamMember.team_id == team_id)
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Prevent demoting owners unless you're an owner
    if member.role == TeamRole.OWNER and admin_member.role != TeamRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can modify other owners",
        )

    if data.role is not None:
        member.role = data.role
    if data.is_active is not None:
        member.is_active = data.is_active

    user_result = await db.execute(select(User).where(User.id == member.user_id))
    user = user_result.scalar_one()

    await _log_action(db, current_user, "team.role_change", team_id, f"{user.email}: {data.role}")
    await db.commit()
    await db.refresh(member)

    return TeamMemberResponse(
        id=member.id,
        user_id=member.user_id,
        user_email=user.email,
        user_name=user.name,
        role=member.role,
        is_active=member.is_active,
        has_key_share=member.encrypted_key_share is not None,
        joined_at=member.joined_at,
        last_access_at=member.last_access_at,
    )


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: str,
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    admin_member: TeamMember = Depends(require_team_admin),
):
    """Remove a member from the team."""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.id == member_id)
        .where(TeamMember.team_id == team_id)
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if member.role == TeamRole.OWNER:
        # Count remaining owners
        owner_count = await db.execute(
            select(func.count())
            .where(TeamMember.team_id == team_id)
            .where(TeamMember.role == TeamRole.OWNER)
            .where(TeamMember.is_active == True)
        )
        if owner_count.scalar() <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner",
            )

    user_result = await db.execute(select(User).where(User.id == member.user_id))
    user = user_result.scalar_one()

    await _log_action(db, current_user, "team.remove_member", team_id, user.email)
    await db.delete(member)
    await db.commit()


# Invites
@router.get("/{team_id}/invites", response_model=list[TeamInviteResponse])
async def list_invites(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(require_team_admin),
):
    """List pending team invitations."""
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.team_id == team_id)
        .where(TeamInvite.status == InviteStatus.PENDING)
    )
    invites = result.scalars().all()

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one()

    responses = []
    for invite in invites:
        inviter_result = await db.execute(select(User).where(User.id == invite.invited_by_id))
        inviter = inviter_result.scalar_one()
        responses.append(TeamInviteResponse(
            id=invite.id,
            team_id=invite.team_id,
            team_name=team.name,
            email=invite.email,
            invited_by_email=inviter.email,
            role=invite.role,
            status=invite.status,
            message=invite.message,
            created_at=invite.created_at,
            expires_at=invite.expires_at,
            responded_at=invite.responded_at,
        ))

    return responses


@router.post("/{team_id}/invites", response_model=TeamInviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    team_id: str,
    data: TeamInviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(require_team_admin),
):
    """Invite a user to the team."""
    # Check if already a member
    user_result = await db.execute(select(User).where(User.email == data.email))
    existing_user = user_result.scalar_one_or_none()

    if existing_user:
        member_result = await db.execute(
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .where(TeamMember.user_id == existing_user.id)
        )
        if member_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a team member",
            )

    # Check for pending invite
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.team_id == team_id)
        .where(TeamInvite.email == data.email)
        .where(TeamInvite.status == InviteStatus.PENDING)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already pending for this email",
        )

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one()

    token = secrets.token_urlsafe(32)
    invite = TeamInvite(
        id=str(uuid.uuid4()),
        team_id=team_id,
        email=data.email,
        invited_by_id=current_user.id,
        role=data.role,
        message=data.message,
        token_hash=hash_api_key(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invite)

    await _log_action(db, current_user, "team.invite", team_id, data.email)
    await db.commit()
    await db.refresh(invite)

    # In production, send email with invite link containing token

    return TeamInviteResponse(
        id=invite.id,
        team_id=invite.team_id,
        team_name=team.name,
        email=invite.email,
        invited_by_email=current_user.email,
        role=invite.role,
        status=invite.status,
        message=invite.message,
        created_at=invite.created_at,
        expires_at=invite.expires_at,
        responded_at=invite.responded_at,
    )


@router.post("/invites/accept", response_model=TeamMemberResponse)
async def accept_invite(
    data: TeamInviteAccept,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Accept a team invitation."""
    token_hash = hash_api_key(data.token)
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.token_hash == token_hash)
        .where(TeamInvite.status == InviteStatus.PENDING)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if invite.expires_at < datetime.now(timezone.utc):
        invite.status = InviteStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation has expired")

    if invite.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invitation is for a different email address",
        )

    # Create membership
    member = TeamMember(
        id=str(uuid.uuid4()),
        team_id=invite.team_id,
        user_id=current_user.id,
        role=invite.role,
    )
    db.add(member)

    invite.status = InviteStatus.ACCEPTED
    invite.responded_at = datetime.now(timezone.utc)

    await _log_action(db, current_user, "team.join", invite.team_id, current_user.email)
    await db.commit()

    return TeamMemberResponse(
        id=member.id,
        user_id=member.user_id,
        user_email=current_user.email,
        user_name=current_user.name,
        role=member.role,
        is_active=member.is_active,
        has_key_share=False,
        joined_at=member.joined_at,
        last_access_at=member.last_access_at,
    )


@router.delete("/{team_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invite(
    team_id: str,
    invite_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(require_team_admin),
):
    """Cancel a pending invitation."""
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.id == invite_id)
        .where(TeamInvite.team_id == team_id)
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    await db.delete(invite)
    await db.commit()


# Audit logs
@router.get("/{team_id}/audit", response_model=AuditLogResponse)
async def get_audit_log(
    team_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: TeamMember = Depends(require_team_admin),
):
    """Get team audit log."""
    offset = (page - 1) * page_size

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.team_id == team_id)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(page_size + 1)  # Fetch one extra to check for more
    )
    logs = result.scalars().all()

    has_more = len(logs) > page_size
    if has_more:
        logs = logs[:page_size]

    entries = [
        AuditLogEntry(
            id=log.id,
            action=log.action,
            user_email=log.user_email,
            resource_type=log.resource_type,
            resource_name=log.resource_name,
            details=None,
            timestamp=log.timestamp,
            severity=log.severity,
        )
        for log in logs
    ]

    total_result = await db.execute(
        select(func.count()).where(AuditLog.team_id == team_id)
    )
    total = total_result.scalar() or 0

    return AuditLogResponse(entries=entries, total=total, has_more=has_more)


async def _log_action(
    db: AsyncSession,
    user: User,
    action: str,
    team_id: str,
    details: str,
):
    """Log team action to audit trail."""
    from app.core.config import settings

    if not settings.AUDIT_LOG_ENABLED:
        return

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type="team",
        resource_id=team_id,
        team_id=team_id,
        details=details,
    )
    db.add(log)
