"""
Admin Schemas
Request/response models for admin operations
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class AdminUserResponse(BaseModel):
    """Admin view of a user."""

    id: str
    email: str
    name: Optional[str]
    is_active: bool
    is_verified: bool
    is_admin: bool
    subscription_tier: str
    subscription_expires: Optional[datetime]
    sso_provider: Optional[str]
    project_count: int = 0
    team_count: int = 0
    last_login_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    """Admin update of a user."""

    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_admin: Optional[bool] = None
    subscription_tier: Optional[str] = None
    subscription_expires: Optional[datetime] = None


class AdminUserCreate(BaseModel):
    """Admin create a user."""

    email: EmailStr
    name: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)
    is_admin: bool = False
    subscription_tier: str = "free"
    send_welcome_email: bool = True


class AdminUserList(BaseModel):
    """List of users for admin."""

    users: List[AdminUserResponse]
    total: int
    page: int
    page_size: int


class AdminStats(BaseModel):
    """System statistics."""

    # Users
    total_users: int
    active_users: int
    verified_users: int
    admin_users: int

    # Projects
    total_projects: int
    total_environments: int
    total_variables: int

    # Teams
    total_teams: int
    total_team_members: int

    # Subscriptions
    free_users: int
    pro_users: int
    team_users: int
    enterprise_users: int

    # Activity
    logins_today: int
    logins_week: int
    syncs_today: int
    syncs_week: int

    # Storage
    storage_used_bytes: int
    storage_limit_bytes: int


class SystemSettings(BaseModel):
    """System-wide settings."""

    # Registration
    registration_enabled: bool = True
    require_email_verification: bool = True
    allowed_email_domains: Optional[List[str]] = None

    # Security
    session_timeout_minutes: int = Field(default=30, ge=5, le=1440)
    max_sessions_per_user: int = Field(default=5, ge=1, le=20)
    password_min_length: int = Field(default=8, ge=8, le=128)
    require_2fa: bool = False

    # Sync
    max_sync_size_mb: int = Field(default=50, ge=1, le=500)
    sync_retention_days: int = Field(default=90, ge=30, le=365)

    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = Field(default=100, ge=10, le=10000)
    rate_limit_window_seconds: int = Field(default=60, ge=10, le=3600)

    # Features
    veilcloud_sync_enabled: bool = True
    service_integrations_enabled: bool = True
    team_features_enabled: bool = True


class AuditLogQuery(BaseModel):
    """Query audit logs."""

    user_id: Optional[str] = None
    team_id: Optional[str] = None
    project_id: Optional[str] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    severity: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=10, le=200)


class AuditLogExport(BaseModel):
    """Export audit logs."""

    format: str = Field(default="json", pattern=r"^(json|csv)$")
    query: AuditLogQuery


class ComplianceReport(BaseModel):
    """Compliance report data."""

    report_type: str  # soc2, hipaa, gdpr
    generated_at: datetime
    period_start: datetime
    period_end: datetime
    summary: Dict[str, Any]
    findings: List[Dict[str, Any]]
    recommendations: List[str]


class SystemHealth(BaseModel):
    """System health status."""

    status: str  # healthy, degraded, unhealthy
    database: bool
    redis: bool
    veilcloud: bool
    storage: bool
    checks: Dict[str, bool]
    last_check: datetime
