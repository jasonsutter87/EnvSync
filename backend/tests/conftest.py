"""
Test Configuration and Fixtures
Provides database setup, test client, and factory fixtures for testing
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token, generate_salt
from app.models.user import User, UserSession, APIKey
from app.models.project import Project, Environment, Variable
from app.models.team import Team, TeamMember, TeamRole
from app.core.config import settings


# Test database URL - use a separate test database
TEST_DATABASE_URL = "postgresql+asyncpg://envsync:envsync@localhost:5432/envsync_test"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool,  # Disable pooling for tests
)

test_async_session_maker = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test.
    Creates all tables before the test and drops them after.
    """
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async with test_async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    # Drop all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create a test client with database session override.
    """
    async def override_get_db():
        try:
            yield db_session
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# =============================================================================
# User Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        id=str(uuid.uuid4()),
        email="test@envsync.io",
        password_hash=hash_password("TestPassword123!"),
        name="Test User",
        master_key_salt="dGVzdF9zYWx0XzEyMzQ1Njc4",  # test_salt_12345678 in base64
        is_active=True,
        is_verified=True,
        is_admin=False,
        subscription_tier="free",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user."""
    user = User(
        id=str(uuid.uuid4()),
        email="admin@envsync.io",
        password_hash=hash_password("AdminPassword123!"),
        name="Admin User",
        master_key_salt="YWRtaW5fc2FsdF8xMjM0NTY3OA==",  # admin_salt_12345678 in base64
        is_active=True,
        is_verified=True,
        is_admin=True,
        subscription_tier="enterprise",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(db_session: AsyncSession) -> User:
    """Create an inactive user."""
    user = User(
        id=str(uuid.uuid4()),
        email="inactive@envsync.io",
        password_hash=hash_password("InactivePassword123!"),
        name="Inactive User",
        master_key_salt="aW5hY3RpdmVfc2FsdF8xMjM0NTY3OA==",
        is_active=False,
        is_verified=False,
        is_admin=False,
        subscription_tier="free",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    """Generate authentication headers for test user."""
    token = create_access_token({"sub": test_user.id})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_headers(admin_user: User) -> dict:
    """Generate authentication headers for admin user."""
    token = create_access_token({"sub": admin_user.id})
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# Project Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_project(db_session: AsyncSession, test_user: User) -> Project:
    """Create a test project with environments."""
    project = Project(
        id=str(uuid.uuid4()),
        name="Test Project",
        description="A test project for unit tests",
        icon="🧪",
        owner_id=test_user.id,
        key_salt="cHJvamVjdF9zYWx0XzEyMzQ1Njc4",  # project_salt_12345678 in base64
        sync_enabled=False,
        is_archived=False,
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


@pytest_asyncio.fixture
async def archived_project(db_session: AsyncSession, test_user: User) -> Project:
    """Create an archived test project."""
    project = Project(
        id=str(uuid.uuid4()),
        name="Archived Project",
        description="An archived project",
        owner_id=test_user.id,
        key_salt="YXJjaGl2ZWRfc2FsdF8xMjM0NTY3OA==",
        is_archived=True,
    )
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)
    return project


# =============================================================================
# Environment Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_environment(db_session: AsyncSession, test_project: Project) -> Environment:
    """Create a test environment."""
    env = Environment(
        id=str(uuid.uuid4()),
        project_id=test_project.id,
        name="development",
        display_order=0,
        color="#22c55e",
    )
    db_session.add(env)
    await db_session.commit()
    await db_session.refresh(env)
    return env


@pytest_asyncio.fixture
async def staging_environment(db_session: AsyncSession, test_project: Project) -> Environment:
    """Create a staging environment."""
    env = Environment(
        id=str(uuid.uuid4()),
        project_id=test_project.id,
        name="staging",
        display_order=1,
        color="#f59e0b",
    )
    db_session.add(env)
    await db_session.commit()
    await db_session.refresh(env)
    return env


@pytest_asyncio.fixture
async def production_environment(db_session: AsyncSession, test_project: Project) -> Environment:
    """Create a production environment."""
    env = Environment(
        id=str(uuid.uuid4()),
        project_id=test_project.id,
        name="production",
        display_order=2,
        color="#ef4444",
    )
    db_session.add(env)
    await db_session.commit()
    await db_session.refresh(env)
    return env


# =============================================================================
# Variable Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_variable(db_session: AsyncSession, test_environment: Environment) -> Variable:
    """Create a test variable."""
    var = Variable(
        id=str(uuid.uuid4()),
        environment_id=test_environment.id,
        key="DATABASE_URL",
        encrypted_value="ZW5jcnlwdGVkX3Rlc3RfdmFsdWU=",  # encrypted_test_value in base64
        value_nonce="dGVzdF9ub25jZQ==",  # test_nonce in base64
        description="Database connection string",
        is_secret=True,
        category="database",
        version=1,
    )
    db_session.add(var)
    await db_session.commit()
    await db_session.refresh(var)
    return var


@pytest_asyncio.fixture
async def api_key_variable(db_session: AsyncSession, test_environment: Environment) -> Variable:
    """Create an API key variable."""
    var = Variable(
        id=str(uuid.uuid4()),
        environment_id=test_environment.id,
        key="API_KEY",
        encrypted_value="ZW5jcnlwdGVkX2FwaV9rZXk=",
        value_nonce="YXBpX25vbmNl",
        description="External API key",
        is_secret=True,
        category="api",
        version=1,
    )
    db_session.add(var)
    await db_session.commit()
    await db_session.refresh(var)
    return var


@pytest_asyncio.fixture
async def public_variable(db_session: AsyncSession, test_environment: Environment) -> Variable:
    """Create a non-secret variable."""
    var = Variable(
        id=str(uuid.uuid4()),
        environment_id=test_environment.id,
        key="APP_NAME",
        encrypted_value="RW52U3luYw==",  # EnvSync in base64
        value_nonce="cHVibGljX25vbmNl",
        description="Application name",
        is_secret=False,
        category="config",
        version=1,
    )
    db_session.add(var)
    await db_session.commit()
    await db_session.refresh(var)
    return var


# =============================================================================
# Team Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_team(db_session: AsyncSession, test_user: User) -> Team:
    """Create a test team."""
    team = Team(
        id=str(uuid.uuid4()),
        name="Test Team",
        slug="test-team",
        description="A test team",
        subscription_tier="team",
        max_members=10,
    )
    db_session.add(team)

    # Add owner membership
    member = TeamMember(
        id=str(uuid.uuid4()),
        team_id=team.id,
        user_id=test_user.id,
        role=TeamRole.OWNER,
        is_active=True,
    )
    db_session.add(member)

    await db_session.commit()
    await db_session.refresh(team)
    return team


# =============================================================================
# API Key Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_api_key(db_session: AsyncSession, test_user: User) -> tuple[APIKey, str]:
    """
    Create a test API key.
    Returns tuple of (APIKey model, raw key string).
    """
    from app.core.security import generate_api_key, hash_api_key

    raw_key = generate_api_key()
    api_key = APIKey(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        name="Test API Key",
        key_hash=hash_api_key(raw_key),
        key_prefix=raw_key[:10],
        scopes="read,write",
        is_active=True,
    )
    db_session.add(api_key)
    await db_session.commit()
    await db_session.refresh(api_key)
    return api_key, raw_key


# =============================================================================
# Session Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def test_session(db_session: AsyncSession, test_user: User) -> UserSession:
    """Create a test user session."""
    from app.core.security import create_refresh_token, hash_api_key

    refresh_token = create_refresh_token({"sub": test_user.id})
    session = UserSession(
        id=str(uuid.uuid4()),
        user_id=test_user.id,
        refresh_token_hash=hash_api_key(refresh_token),
        device_info="pytest/test-client",
        ip_address="127.0.0.1",
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    # Store the raw token for testing
    session._refresh_token = refresh_token
    return session


# =============================================================================
# Utility Fixtures
# =============================================================================

@pytest.fixture
def sample_env_content() -> str:
    """Sample .env file content for import/export tests."""
    return """# Database configuration
DATABASE_URL=postgresql://user:pass@localhost/db
DATABASE_POOL_SIZE=10

# API Keys
API_KEY=sk_test_123456789
SECRET_TOKEN=super_secret_value

# Application
APP_NAME=EnvSync
DEBUG=false
"""


@pytest.fixture
def encrypted_env_content() -> str:
    """Sample encrypted .env file content."""
    return """DATABASE_URL=ZW5jcnlwdGVkX3ZhbHVl::dGVzdF9ub25jZQ==
API_KEY=ZW5jcnlwdGVkX2FwaQ==::YXBpX25vbmNl
APP_NAME=RW52U3luYw==::YXBwX25vbmNl
"""


# =============================================================================
# Factory Functions
# =============================================================================

class UserFactory:
    """Factory for creating test users."""

    @staticmethod
    async def create(
        db: AsyncSession,
        email: str = None,
        password: str = "TestPassword123!",
        is_admin: bool = False,
        is_active: bool = True,
        **kwargs
    ) -> User:
        """Create a user with custom attributes."""
        user = User(
            id=str(uuid.uuid4()),
            email=email or f"user-{uuid.uuid4().hex[:8]}@envsync.io",
            password_hash=hash_password(password),
            master_key_salt="dGVzdF9zYWx0",
            is_active=is_active,
            is_verified=True,
            is_admin=is_admin,
            subscription_tier="free",
            **kwargs
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


class ProjectFactory:
    """Factory for creating test projects."""

    @staticmethod
    async def create(
        db: AsyncSession,
        owner: User,
        name: str = None,
        with_environments: bool = True,
        **kwargs
    ) -> Project:
        """Create a project with optional environments."""
        project = Project(
            id=str(uuid.uuid4()),
            name=name or f"Project-{uuid.uuid4().hex[:8]}",
            owner_id=owner.id,
            key_salt="cHJvamVjdF9zYWx0",
            **kwargs
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)

        if with_environments:
            for env_name, order, color in [
                ("development", 0, "#22c55e"),
                ("staging", 1, "#f59e0b"),
                ("production", 2, "#ef4444"),
            ]:
                env = Environment(
                    id=str(uuid.uuid4()),
                    project_id=project.id,
                    name=env_name,
                    display_order=order,
                    color=color,
                )
                db.add(env)
            await db.commit()

        return project


class EnvironmentFactory:
    """Factory for creating test environments."""

    @staticmethod
    async def create(
        db: AsyncSession,
        project: Project,
        name: str = None,
        **kwargs
    ) -> Environment:
        """Create an environment."""
        env = Environment(
            id=str(uuid.uuid4()),
            project_id=project.id,
            name=name or f"env-{uuid.uuid4().hex[:8]}",
            display_order=kwargs.pop("display_order", 0),
            **kwargs
        )
        db.add(env)
        await db.commit()
        await db.refresh(env)
        return env


class VariableFactory:
    """Factory for creating test variables."""

    @staticmethod
    async def create(
        db: AsyncSession,
        environment: Environment,
        key: str = None,
        **kwargs
    ) -> Variable:
        """Create a variable."""
        var = Variable(
            id=str(uuid.uuid4()),
            environment_id=environment.id,
            key=key or f"VAR_{uuid.uuid4().hex[:8].upper()}",
            encrypted_value=kwargs.pop("encrypted_value", "ZW5jcnlwdGVk"),
            value_nonce=kwargs.pop("value_nonce", "bm9uY2U="),
            is_secret=kwargs.pop("is_secret", True),
            version=kwargs.pop("version", 1),
            **kwargs
        )
        db.add(var)
        await db.commit()
        await db.refresh(var)
        return var


@pytest.fixture
def user_factory() -> UserFactory:
    """Provide user factory."""
    return UserFactory


@pytest.fixture
def project_factory() -> ProjectFactory:
    """Provide project factory."""
    return ProjectFactory


@pytest.fixture
def environment_factory() -> EnvironmentFactory:
    """Provide environment factory."""
    return EnvironmentFactory


@pytest.fixture
def variable_factory() -> VariableFactory:
    """Provide variable factory."""
    return VariableFactory
