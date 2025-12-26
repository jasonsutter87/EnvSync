"""
Team Schemas
Request/response models for teams and members
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr

from app.models.team import TeamRole, InviteStatus


class TeamCreate(BaseModel):
    """Create a new team."""

    name: str = Field(max_length=100)
    description: Optional[str] = None
    slug: str = Field(max_length=100, pattern=r"^[a-z0-9-]+$")
    veilkey_enabled: bool = False
    veilkey_threshold: int = Field(default=2, ge=1, le=10)
    veilkey_total_shares: int = Field(default=3, ge=2, le=20)


class TeamUpdate(BaseModel):
    """Update a team."""

    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    veilkey_threshold: Optional[int] = Field(None, ge=1, le=10)
    sso_enforced: Optional[bool] = None
    allowed_domains: Optional[List[str]] = None


class TeamMemberResponse(BaseModel):
    """Team member information."""

    id: str
    user_id: str
    user_email: str
    user_name: Optional[str]
    role: TeamRole
    is_active: bool
    has_key_share: bool
    joined_at: datetime
    last_access_at: Optional[datetime]

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    """Team information."""

    id: str
    name: str
    description: Optional[str]
    slug: str
    veilkey_enabled: bool
    veilkey_threshold: int
    veilkey_total_shares: int
    sso_enforced: bool
    subscription_tier: str
    max_members: int
    max_projects: int
    member_count: int = 0
    project_count: int = 0
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamDetail(TeamResponse):
    """Team with members and projects."""

    members: List[TeamMemberResponse] = []
    current_user_role: Optional[TeamRole] = None


class TeamInviteCreate(BaseModel):
    """Create a team invitation."""

    email: EmailStr
    role: TeamRole = TeamRole.MEMBER
    message: Optional[str] = None


class TeamInviteResponse(BaseModel):
    """Team invitation response."""

    id: str
    team_id: str
    team_name: str
    email: str
    invited_by_email: str
    role: TeamRole
    status: InviteStatus
    message: Optional[str]
    created_at: datetime
    expires_at: datetime
    responded_at: Optional[datetime]

    class Config:
        from_attributes = True


class TeamInviteAccept(BaseModel):
    """Accept a team invitation."""

    token: str


class TeamMemberUpdate(BaseModel):
    """Update a team member."""

    role: Optional[TeamRole] = None
    is_active: Optional[bool] = None


class TeamKeyShare(BaseModel):
    """VeilKey share distribution."""

    member_id: str
    encrypted_share: str = Field(description="Share encrypted with member's key")


class TeamProjectAssign(BaseModel):
    """Assign a project to a team."""

    project_id: str


class AuditLogEntry(BaseModel):
    """Audit log entry for team activity."""

    id: str
    action: str
    user_email: str
    resource_type: str
    resource_name: Optional[str]
    details: Optional[dict]
    timestamp: datetime
    severity: str

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    """Audit log response."""

    entries: List[AuditLogEntry]
    total: int
    has_more: bool
