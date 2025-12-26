"""
Authentication API Routes
User registration, login, token management, and API keys
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_api_key,
    hash_api_key,
)
from app.core.config import settings
from app.models.user import User, UserSession, APIKey
from app.models.audit import AuditLog
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    TokenRefresh,
    PasswordChange,
    APIKeyCreate,
    APIKeyResponse,
    APIKeyCreated,
)
from app.api.deps import get_current_user, get_current_active_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        master_key_salt=user_data.master_key_salt,
    )
    db.add(user)

    # Create session
    session = await _create_session(db, user, request)

    # Audit log
    await _log_action(db, user, "user.register", "user", user.id, request)

    await db.commit()

    return _token_response(user, session)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return tokens."""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended",
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)

    # Create session
    session = await _create_session(db, user, request, credentials.device_info)

    # Audit log
    await _log_action(db, user, "user.login", "user", user.id, request)

    await db.commit()

    return _token_response(user, session)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh, request: Request, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Find session
    token_hash = hash_api_key(data.refresh_token)
    result = await db.execute(
        select(UserSession)
        .where(UserSession.refresh_token_hash == token_hash)
        .where(UserSession.is_active == True)
    )
    session = result.scalar_one_or_none()

    if not session or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    # Get user
    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Update session
    session.last_used_at = datetime.now(timezone.utc)

    # Create new tokens
    new_refresh = create_refresh_token({"sub": user.id})
    session.refresh_token_hash = hash_api_key(new_refresh)

    await db.commit()

    access_token = create_access_token({"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Logout and invalidate current session."""
    # Get authorization header to find the session
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = decode_token(token)
        if payload:
            # Invalidate all sessions for this user (or just current one)
            # For now, invalidate all
            result = await db.execute(
                select(UserSession)
                .where(UserSession.user_id == current_user.id)
                .where(UserSession.is_active == True)
            )
            for session in result.scalars():
                session.is_active = False

    await _log_action(db, current_user, "user.logout", "user", current_user.id, request)
    await db.commit()

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.put("/password")
async def change_password(
    data: PasswordChange,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Change user password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = hash_password(data.new_password)
    current_user.master_key_salt = data.new_master_key_salt

    await _log_action(db, current_user, "user.password_change", "user", current_user.id, request)
    await db.commit()

    return {"message": "Password changed successfully"}


# API Keys
@router.get("/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all API keys for current user."""
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id).order_by(APIKey.created_at.desc())
    )
    return [APIKeyResponse.model_validate(key) for key in result.scalars()]


@router.post("/api-keys", response_model=APIKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: APIKeyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new API key."""
    key = generate_api_key()
    key_hash = hash_api_key(key)

    expires_at = None
    if data.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)

    api_key = APIKey(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        key_hash=key_hash,
        key_prefix=key[:10],
        scopes=",".join(data.scopes),
        expires_at=expires_at,
    )
    db.add(api_key)

    await _log_action(db, current_user, "api_key.create", "api_key", api_key.id, request)
    await db.commit()

    response = APIKeyCreated.model_validate(api_key)
    response.key = key
    response.scopes = data.scopes
    return response


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete an API key."""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id).where(APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    await db.delete(api_key)
    await _log_action(db, current_user, "api_key.delete", "api_key", key_id, request)
    await db.commit()

    return {"message": "API key deleted"}


# Helper functions
async def _create_session(
    db: AsyncSession, user: User, request: Request, device_info: Optional[str] = None
) -> UserSession:
    """Create a new user session."""
    refresh_token = create_refresh_token({"sub": user.id})
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash=hash_api_key(refresh_token),
        device_info=device_info or request.headers.get("User-Agent", "")[:255],
        ip_address=request.client.host if request.client else None,
        expires_at=expires_at,
    )
    db.add(session)
    session._refresh_token = refresh_token  # Temporary storage for response
    return session


def _token_response(user: User, session: UserSession) -> TokenResponse:
    """Build token response."""
    access_token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=access_token,
        refresh_token=session._refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


async def _log_action(
    db: AsyncSession,
    user: User,
    action: str,
    resource_type: str,
    resource_id: str,
    request: Request,
):
    """Log an audit action."""
    if not settings.AUDIT_LOG_ENABLED:
        return

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent", "")[:500],
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    db.add(log)
