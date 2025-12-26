"""
API Dependencies
Authentication and authorization dependencies
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token, hash_api_key
from app.models.user import User, APIKey
from app.models.team import Team, TeamMember, TeamRole


security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get current user from JWT token or API key."""
    if not credentials:
        return None

    token = credentials.credentials

    # Try JWT token first
    payload = decode_token(token)
    if payload and payload.get("type") != "refresh":
        user_id = payload.get("sub")
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()

    # Try API key
    if token.startswith("es_"):
        key_hash = hash_api_key(token)
        result = await db.execute(
            select(APIKey)
            .where(APIKey.key_hash == key_hash)
            .where(APIKey.is_active == True)
        )
        api_key = result.scalar_one_or_none()
        if api_key:
            # Update last used
            from datetime import datetime, timezone
            api_key.last_used_at = datetime.now(timezone.utc)

            result = await db.execute(select(User).where(User.id == api_key.user_id))
            return result.scalar_one_or_none()

    return None


async def get_current_active_user(
    current_user: Optional[User] = Depends(get_current_user),
) -> User:
    """Require an authenticated and active user."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended",
        )
    return current_user


async def get_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Require an admin user."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_team_member(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TeamMember:
    """Get current user's team membership."""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .where(TeamMember.user_id == current_user.id)
        .where(TeamMember.is_active == True)
    )
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this team",
        )
    return member


async def require_team_admin(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TeamMember:
    """Require team admin or owner role."""
    member = await get_team_member(team_id, db, current_user)

    if member.role not in [TeamRole.OWNER, TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team admin access required",
        )
    return member


async def require_team_owner(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TeamMember:
    """Require team owner role."""
    member = await get_team_member(team_id, db, current_user)

    if member.role != TeamRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team owner access required",
        )
    return member


class RateLimiter:
    """Simple rate limiter dependency."""

    def __init__(self, requests: int = 100, window: int = 60):
        self.requests = requests
        self.window = window
        self._cache: dict = {}

    async def __call__(self, current_user: User = Depends(get_current_active_user)):
        # In production, use Redis for distributed rate limiting
        from datetime import datetime
        import time

        key = current_user.id
        now = time.time()

        if key not in self._cache:
            self._cache[key] = []

        # Clean old entries
        self._cache[key] = [t for t in self._cache[key] if now - t < self.window]

        if len(self._cache[key]) >= self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
            )

        self._cache[key].append(now)
        return current_user


# Default rate limiters
rate_limit_standard = RateLimiter(requests=100, window=60)
rate_limit_strict = RateLimiter(requests=20, window=60)
