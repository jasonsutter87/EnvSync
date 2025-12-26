"""
Environment API Tests
Comprehensive tests for environment CRUD operations and project relationships
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project, Environment, Variable


# =============================================================================
# List Environments Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_environments_empty(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test listing environments when none exist."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_list_environments_single(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test listing environments with one environment."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == test_environment.id
    assert data[0]["name"] == "development"


@pytest.mark.asyncio
async def test_list_environments_multiple(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    staging_environment: Environment,
    production_environment: Environment,
):
    """Test listing multiple environments."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Should be ordered by display_order
    assert data[0]["name"] == "development"
    assert data[1]["name"] == "staging"
    assert data[2]["name"] == "production"


@pytest.mark.asyncio
async def test_list_environments_with_variables(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test listing environments includes variables."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments?include_variables=true",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["variables"]) >= 1
    assert data[0]["variable_count"] >= 1


@pytest.mark.asyncio
async def test_list_environments_without_variables(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test listing environments without loading variables."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments?include_variables=false",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    # Variables should not be populated
    assert data[0]["variables"] == []


@pytest.mark.asyncio
async def test_list_environments_project_not_found(
    client: AsyncClient, auth_headers: dict
):
    """Test listing environments for non-existent project."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/environments/{fake_id}/environments",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_environments_unauthorized(
    client: AsyncClient, test_project: Project
):
    """Test listing environments without authentication."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_environments_forbidden(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    user_factory,
    project_factory,
):
    """Test listing environments for another user's project."""
    other_user = await user_factory.create(db_session)
    other_project = await project_factory.create(db_session, other_user)

    response = await client.get(
        f"/api/environments/{other_project.id}/environments",
        headers=auth_headers,
    )
    assert response.status_code == 404


# =============================================================================
# Create Environment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_create_environment_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test creating an environment successfully."""
    env_data = {
        "name": "qa",
        "display_order": 3,
        "color": "#8b5cf6",
    }

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "qa"
    assert data["display_order"] == 3
    assert data["color"] == "#8b5cf6"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_environment_minimal(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test creating an environment with minimal data."""
    env_data = {"name": "test"}

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test"
    assert data["display_order"] == 0  # Default
    assert data["color"] is None


@pytest.mark.asyncio
async def test_create_environment_with_color(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test creating an environment with custom color."""
    env_data = {
        "name": "custom",
        "display_order": 0,
        "color": "#ff00ff",
    }

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["color"] == "#ff00ff"


@pytest.mark.asyncio
async def test_create_environment_duplicate_name(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating an environment with duplicate name fails."""
    env_data = {"name": "development"}  # Already exists

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_environment_missing_name(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test creating an environment without name."""
    env_data = {"display_order": 0}

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_environment_invalid_color(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test creating an environment with invalid color format."""
    env_data = {
        "name": "invalid",
        "color": "not-a-color",  # Invalid format
    }

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_environment_project_not_found(
    client: AsyncClient, auth_headers: dict
):
    """Test creating environment for non-existent project."""
    fake_id = str(uuid.uuid4())
    env_data = {"name": "test"}

    response = await client.post(
        f"/api/environments/{fake_id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_environment_unauthorized(
    client: AsyncClient, test_project: Project
):
    """Test creating an environment without authentication."""
    env_data = {"name": "unauthorized"}

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
    )
    assert response.status_code == 401


# =============================================================================
# Get Environment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_environment_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test getting an environment by ID."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_environment.id
    assert data["name"] == "development"


@pytest.mark.asyncio
async def test_get_environment_with_variables(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test getting an environment includes variables."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["variables"]) >= 1
    assert data["variable_count"] >= 1


@pytest.mark.asyncio
async def test_get_environment_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test getting a non-existent environment."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/environments/{test_project.id}/environments/{fake_id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_environment_wrong_project(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_user: User,
    test_environment: Environment,
    project_factory,
):
    """Test getting environment with wrong project ID."""
    # Create another project
    other_project = await project_factory.create(db_session, test_user)

    # Try to get test_environment using other_project's ID
    response = await client.get(
        f"/api/environments/{other_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_environment_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
):
    """Test getting an environment without authentication."""
    response = await client.get(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}"
    )
    assert response.status_code == 401


# =============================================================================
# Update Environment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_update_environment_name(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test updating environment name."""
    update_data = {"name": "dev", "display_order": 0}

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "dev"


@pytest.mark.asyncio
async def test_update_environment_display_order(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test updating environment display order."""
    update_data = {"name": "development", "display_order": 5}

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_order"] == 5


@pytest.mark.asyncio
async def test_update_environment_color(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test updating environment color."""
    update_data = {
        "name": "development",
        "display_order": 0,
        "color": "#ff0000",
    }

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["color"] == "#ff0000"


@pytest.mark.asyncio
async def test_update_environment_duplicate_name(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    staging_environment: Environment,
):
    """Test updating to duplicate name fails."""
    update_data = {
        "name": "staging",  # Already exists
        "display_order": 0,
    }

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_environment_same_name(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test updating environment keeping same name."""
    update_data = {
        "name": "development",  # Same as current
        "display_order": 10,
    }

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_order"] == 10


@pytest.mark.asyncio
async def test_update_environment_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test updating a non-existent environment."""
    fake_id = str(uuid.uuid4())
    update_data = {"name": "updated", "display_order": 0}

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{fake_id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_environment_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
):
    """Test updating an environment without authentication."""
    update_data = {"name": "unauthorized", "display_order": 0}

    response = await client.put(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        json=update_data,
    )
    assert response.status_code == 401


# =============================================================================
# Delete Environment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_delete_environment_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test deleting an environment."""
    response = await client.delete(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Verify it's deleted
    response = await client.get(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_environment_cascades_to_variables(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test that deleting an environment deletes its variables."""
    # Delete environment
    response = await client.delete(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Verify variable is also deleted (can't access it)
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_environment_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test deleting a non-existent environment."""
    fake_id = str(uuid.uuid4())
    response = await client.delete(
        f"/api/environments/{test_project.id}/environments/{fake_id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_environment_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
):
    """Test deleting an environment without authentication."""
    response = await client.delete(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}"
    )
    assert response.status_code == 401


# =============================================================================
# Clone Environment Tests
# =============================================================================

@pytest.mark.asyncio
async def test_clone_environment_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test cloning an environment."""
    response = await client.post(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}/clone?new_name=development-copy",
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "development-copy"
    assert data["id"] != test_environment.id  # Different ID
    assert data["variable_count"] >= 1  # Variables were copied


@pytest.mark.asyncio
async def test_clone_environment_with_variables(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_project: Project,
    test_environment: Environment,
    variable_factory,
):
    """Test cloning environment copies all variables."""
    # Create multiple variables
    for i in range(3):
        await variable_factory.create(
            db_session, test_environment, key=f"VAR_{i}"
        )

    response = await client.post(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}/clone?new_name=clone",
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["variable_count"] == 3


@pytest.mark.asyncio
async def test_clone_environment_duplicate_name(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    staging_environment: Environment,
):
    """Test cloning with duplicate name fails."""
    response = await client.post(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}/clone?new_name=staging",
        headers=auth_headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_clone_environment_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test cloning a non-existent environment."""
    fake_id = str(uuid.uuid4())
    response = await client.post(
        f"/api/environments/{test_project.id}/environments/{fake_id}/clone?new_name=clone",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_clone_environment_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
):
    """Test cloning an environment without authentication."""
    response = await client.post(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}/clone?new_name=clone"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_clone_environment_preserves_attributes(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test that cloning preserves environment attributes."""
    response = await client.post(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}/clone?new_name=clone",
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["color"] == test_environment.color
    assert data["display_order"] == test_environment.display_order + 1


# =============================================================================
# Environment Ordering Tests
# =============================================================================

@pytest.mark.asyncio
async def test_environments_ordered_by_display_order(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_project: Project,
    environment_factory,
):
    """Test that environments are returned in display_order."""
    # Create environments in random order
    await environment_factory.create(
        db_session, test_project, name="prod", display_order=3
    )
    await environment_factory.create(
        db_session, test_project, name="dev", display_order=1
    )
    await environment_factory.create(
        db_session, test_project, name="staging", display_order=2
    )

    response = await client.get(
        f"/api/environments/{test_project.id}/environments",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["name"] == "dev"
    assert data[1]["name"] == "staging"
    assert data[2]["name"] == "prod"


# =============================================================================
# Edge Cases
# =============================================================================

@pytest.mark.asyncio
async def test_environment_name_max_length(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test environment name max length validation."""
    env_data = {
        "name": "a" * 51,  # Max is 50
        "display_order": 0,
    }

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_environment_negative_display_order(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test that negative display order is allowed."""
    env_data = {
        "name": "negative",
        "display_order": -1,
    }

    response = await client.post(
        f"/api/environments/{test_project.id}/environments",
        json=env_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["display_order"] == -1
