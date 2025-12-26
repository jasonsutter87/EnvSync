"""
SSO/OIDC API Routes
Enterprise Single Sign-On integration
"""
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, hash_api_key
from app.core.config import settings
from app.models.user import User, UserSession
from app.models.team import Team, TeamMember, TeamRole
from app.models.audit import AuditLog
from app.schemas.auth import TokenResponse, UserResponse

router = APIRouter()

# In-memory state store (use Redis in production)
_sso_states: dict = {}


@router.get("/providers")
async def list_providers():
    """List available SSO providers."""
    providers = []

    if settings.SSO_ENABLED and settings.OIDC_ISSUER_URL:
        providers.append({
            "id": "oidc",
            "name": "Enterprise SSO",
            "type": "oidc",
            "enabled": True,
        })

    if settings.SAML_ENABLED and settings.SAML_IDP_METADATA_URL:
        providers.append({
            "id": "saml",
            "name": "SAML SSO",
            "type": "saml",
            "enabled": True,
        })

    return {"providers": providers}


@router.get("/oidc/authorize")
async def oidc_authorize(
    redirect_uri: str,
    state: Optional[str] = None,
    team_id: Optional[str] = None,
):
    """
    Initiate OIDC authentication flow.
    Redirects to identity provider.
    """
    if not settings.SSO_ENABLED or not settings.OIDC_ISSUER_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC is not configured",
        )

    # Generate state for CSRF protection
    state_token = secrets.token_urlsafe(32)
    _sso_states[state_token] = {
        "redirect_uri": redirect_uri,
        "client_state": state,
        "team_id": team_id,
        "created_at": datetime.now(timezone.utc),
    }

    # Build authorization URL
    params = {
        "client_id": settings.OIDC_CLIENT_ID,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": f"{redirect_uri}/api/sso/oidc/callback",
        "state": state_token,
    }

    auth_url = f"{settings.OIDC_ISSUER_URL}/authorize?{urlencode(params)}"

    return RedirectResponse(url=auth_url)


@router.get("/oidc/callback")
async def oidc_callback(
    code: str,
    state: str,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle OIDC callback from identity provider.
    Exchanges code for tokens and creates/updates user.
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_description or error,
        )

    # Validate state
    state_data = _sso_states.pop(state, None)
    if not state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired state",
        )

    # Check state expiry (10 minutes)
    if datetime.now(timezone.utc) - state_data["created_at"] > timedelta(minutes=10):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State expired",
        )

    try:
        # Exchange code for tokens
        import httpx

        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                f"{settings.OIDC_ISSUER_URL}/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": f"{state_data['redirect_uri']}/api/sso/oidc/callback",
                    "client_id": settings.OIDC_CLIENT_ID,
                    "client_secret": settings.OIDC_CLIENT_SECRET,
                },
            )
            token_response.raise_for_status()
            tokens = token_response.json()

            # Get user info
            userinfo_response = await client.get(
                f"{settings.OIDC_ISSUER_URL}/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            userinfo_response.raise_for_status()
            userinfo = userinfo_response.json()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authenticate with identity provider: {str(e)}",
        )

    # Find or create user
    email = userinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by identity provider",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        # Create new user from SSO
        import base64
        salt = secrets.token_bytes(16)

        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password_hash="",  # SSO users don't have passwords
            name=userinfo.get("name"),
            master_key_salt=base64.b64encode(salt).decode(),
            sso_provider="oidc",
            sso_subject=userinfo.get("sub"),
            is_verified=True,  # SSO users are pre-verified
        )
        db.add(user)

        # If team_id specified, add to team
        if state_data.get("team_id"):
            team_result = await db.execute(
                select(Team).where(Team.id == state_data["team_id"])
            )
            team = team_result.scalar_one_or_none()

            if team and team.sso_enforced:
                # Check allowed domains
                if team.allowed_domains:
                    import json
                    allowed = json.loads(team.allowed_domains)
                    domain = email.split("@")[1]
                    if domain not in allowed:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Email domain not allowed for this team",
                        )

                # Add to team
                member = TeamMember(
                    id=str(uuid.uuid4()),
                    team_id=team.id,
                    user_id=user.id,
                    role=TeamRole.MEMBER,
                )
                db.add(member)

    else:
        # Update existing user
        user.sso_provider = "oidc"
        user.sso_subject = userinfo.get("sub")
        user.last_login_at = datetime.now(timezone.utc)

    # Create session
    refresh_token = create_refresh_token({"sub": user.id})
    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash=hash_api_key(refresh_token),
        device_info="SSO Login",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(session)

    # Audit log
    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action="user.sso_login",
        resource_type="user",
        resource_id=user.id,
        details="OIDC login",
    )
    db.add(log)

    await db.commit()

    # Create access token
    access_token = create_access_token({"sub": user.id})

    # Redirect back to app with tokens
    redirect_url = state_data["redirect_uri"]
    params = {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }
    if state_data.get("client_state"):
        params["state"] = state_data["client_state"]

    return RedirectResponse(url=f"{redirect_url}?{urlencode(params)}")


@router.post("/saml/acs")
async def saml_assertion_consumer(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    SAML Assertion Consumer Service (ACS) endpoint.
    Processes SAML responses from identity provider.
    """
    if not settings.SAML_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SAML is not configured",
        )

    # In production, use python-saml library to validate SAML response
    # This is a simplified example

    form_data = await request.form()
    saml_response = form_data.get("SAMLResponse")
    relay_state = form_data.get("RelayState")

    if not saml_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SAMLResponse not provided",
        )

    try:
        # Parse and validate SAML response
        # In production, use OneLogin's python-saml library
        import base64
        import xml.etree.ElementTree as ET

        decoded = base64.b64decode(saml_response)
        root = ET.fromstring(decoded)

        # Extract user attributes (simplified)
        ns = {"saml": "urn:oasis:names:tc:SAML:2.0:assertion"}
        email = None
        name = None

        for attr in root.findall(".//saml:Attribute", ns):
            attr_name = attr.get("Name")
            value = attr.find("saml:AttributeValue", ns)
            if value is not None:
                if "email" in attr_name.lower():
                    email = value.text
                elif "name" in attr_name.lower():
                    name = value.text

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not found in SAML response",
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid SAML response: {str(e)}",
        )

    # Find or create user (same as OIDC)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        import base64
        salt = secrets.token_bytes(16)

        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password_hash="",
            name=name,
            master_key_salt=base64.b64encode(salt).decode(),
            sso_provider="saml",
            is_verified=True,
        )
        db.add(user)
    else:
        user.sso_provider = "saml"
        user.last_login_at = datetime.now(timezone.utc)

    # Create session
    refresh_token = create_refresh_token({"sub": user.id})
    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash=hash_api_key(refresh_token),
        device_info="SAML Login",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(session)

    # Audit log
    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action="user.saml_login",
        resource_type="user",
        resource_id=user.id,
    )
    db.add(log)

    await db.commit()

    # Create access token
    access_token = create_access_token({"sub": user.id})

    # Redirect back
    redirect_url = relay_state or "/"
    params = {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }

    return RedirectResponse(url=f"{redirect_url}?{urlencode(params)}")


@router.get("/saml/metadata")
async def saml_metadata():
    """
    Return SAML Service Provider metadata.
    Used to configure the identity provider.
    """
    if not settings.SAML_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SAML is not configured",
        )

    # Generate SP metadata XML
    metadata = f"""<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="envsync">
  <md:SPSSODescriptor AuthnRequestsSigned="false"
                       WantAssertionsSigned="true"
                       protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                  Location="{settings.CORS_ORIGINS[0]}/api/sso/saml/acs"
                                  index="0"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>"""

    return Response(content=metadata, media_type="application/xml")
