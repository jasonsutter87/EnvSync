"""
Authentication Schemas
Request/response models for auth endpoints
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """User registration request."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = Field(None, max_length=255)
    master_key_salt: str = Field(description="Base64 encoded salt for key derivation")


class UserLogin(BaseModel):
    """User login request."""

    email: EmailStr
    password: str
    device_info: Optional[str] = None


class UserResponse(BaseModel):
    """User information response."""

    id: str
    email: str
    name: Optional[str]
    is_verified: bool
    is_admin: bool
    subscription_tier: str
    subscription_expires: Optional[datetime]
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Authentication token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class TokenRefresh(BaseModel):
    """Token refresh request."""

    refresh_token: str


class PasswordChange(BaseModel):
    """Password change request."""

    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    new_master_key_salt: str = Field(description="New salt for key derivation")


class PasswordReset(BaseModel):
    """Password reset request."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation."""

    token: str
    new_password: str = Field(min_length=8, max_length=128)
    new_master_key_salt: str


class APIKeyCreate(BaseModel):
    """API key creation request."""

    name: str = Field(max_length=100)
    scopes: List[str] = Field(default=["read", "write"])
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)


class APIKeyResponse(BaseModel):
    """API key response (key only shown once on creation)."""

    id: str
    name: str
    key_prefix: str
    scopes: List[str]
    is_active: bool
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class APIKeyCreated(APIKeyResponse):
    """Response when API key is created (includes full key)."""

    key: str  # Only returned on creation


class SSOLoginRequest(BaseModel):
    """SSO login initiation."""

    provider: str  # oidc, saml
    redirect_uri: str


class SSOCallback(BaseModel):
    """SSO callback data."""

    code: Optional[str] = None
    state: str
    error: Optional[str] = None
    error_description: Optional[str] = None
