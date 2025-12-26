"""
Project API Tests
Comprehensive tests for project CRUD operations, validation, and authorization
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project, Environment


# =============================================================================
# List Projects Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_projects_empty(client: AsyncClient, auth_headers: dict):
    """Test listing projects when none exist."""
    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["projects"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_projects_single(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test listing projects with one project."""
    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 1
    assert data["total"] == 1
    assert data["projects"][0]["id"] == test_project.id
    assert data["projects"][0]["name"] == test_project.name


@pytest.mark.asyncio
async def test_list_projects_multiple(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_user: User,
    project_factory,
):
    """Test listing multiple projects."""
    # Create multiple projects
    projects = []
    for i in range(5):
        project = await project_factory.create(
            db_session, test_user, name=f"Project {i}"
        )
        projects.append(project)

    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 5
    assert data["total"] == 5


@pytest.mark.asyncio
async def test_list_projects_exclude_archived(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    archived_project: Project,
):
    """Test that archived projects are excluded by default."""
    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 1
    assert data["projects"][0]["id"] == test_project.id


@pytest.mark.asyncio
async def test_list_projects_include_archived(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    archived_project: Project,
):
    """Test including archived projects with query parameter."""
    response = await client.get(
        "/api/projects?archived=true", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 2


@pytest.mark.asyncio
async def test_list_projects_search(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_user: User,
    project_factory,
):
    """Test searching projects by name."""
    await project_factory.create(db_session, test_user, name="Frontend App")
    await project_factory.create(db_session, test_user, name="Backend API")
    await project_factory.create(db_session, test_user, name="Mobile App")

    response = await client.get(
        "/api/projects?search=App", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 2
    assert all("App" in p["name"] for p in data["projects"])


@pytest.mark.asyncio
async def test_list_projects_pagination(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_user: User,
    project_factory,
):
    """Test project pagination."""
    # Create 10 projects
    for i in range(10):
        await project_factory.create(db_session, test_user, name=f"Project {i}")

    # First page
    response = await client.get(
        "/api/projects?limit=5&offset=0", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 5
    assert data["total"] == 10

    # Second page
    response = await client.get(
        "/api/projects?limit=5&offset=5", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 5


@pytest.mark.asyncio
async def test_list_projects_unauthorized(client: AsyncClient):
    """Test listing projects without authentication."""
    response = await client.get("/api/projects")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_projects_only_own(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_user: User,
    user_factory,
    project_factory,
):
    """Test that users only see their own projects."""
    # Create another user with projects
    other_user = await user_factory.create(db_session)
    await project_factory.create(db_session, other_user, name="Other Project")

    # Create project for test user
    await project_factory.create(db_session, test_user, name="My Project")

    response = await client.get("/api/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 1
    assert data["projects"][0]["name"] == "My Project"


# =============================================================================
# Create Project Tests
# =============================================================================

@pytest.mark.asyncio
async def test_create_project_success(
    client: AsyncClient, auth_headers: dict
):
    """Test creating a project successfully."""
    project_data = {
        "name": "New Project",
        "description": "A new test project",
        "icon": "🚀",
        "key_salt": "bmV3X3Byb2plY3Rfc2FsdA==",
        "environments": [
            {"name": "development", "display_order": 0, "color": "#22c55e"},
            {"name": "production", "display_order": 1, "color": "#ef4444"},
        ],
    }

    response = await client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Project"
    assert data["description"] == "A new test project"
    assert data["icon"] == "🚀"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_project_minimal(
    client: AsyncClient, auth_headers: dict
):
    """Test creating a project with minimal data."""
    project_data = {
        "name": "Minimal Project",
        "key_salt": "bWluaW1hbF9zYWx0",
    }

    response = await client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Minimal Project"
    assert data["description"] is None
    assert data["icon"] is None


@pytest.mark.asyncio
async def test_create_project_with_custom_environments(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """Test creating a project with custom environments."""
    project_data = {
        "name": "Custom Env Project",
        "key_salt": "Y3VzdG9tX3NhbHQ=",
        "environments": [
            {"name": "local", "display_order": 0, "color": "#3b82f6"},
            {"name": "dev", "display_order": 1, "color": "#22c55e"},
            {"name": "qa", "display_order": 2, "color": "#f59e0b"},
            {"name": "prod", "display_order": 3, "color": "#ef4444"},
        ],
    }

    response = await client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert response.status_code == 201

    # Verify environments were created
    project_id = response.json()["id"]
    response = await client.get(
        f"/api/projects/{project_id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["environments"]) == 4


@pytest.mark.asyncio
async def test_create_project_missing_name(
    client: AsyncClient, auth_headers: dict
):
    """Test creating a project without a name."""
    project_data = {"key_salt": "dGVzdF9zYWx0"}

    response = await client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_create_project_empty_name(
    client: AsyncClient, auth_headers: dict
):
    """Test creating a project with empty name."""
    project_data = {"name": "", "key_salt": "dGVzdF9zYWx0"}

    response = await client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_project_name_too_long(
    client: AsyncClient, auth_headers: dict
):
    """Test creating a project with name exceeding max length."""
    project_data = {
        "name": "A" * 101,  # Max is 100
        "key_salt": "dGVzdF9zYWx0",
    }

    response = await client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_project_unauthorized(client: AsyncClient):
    """Test creating a project without authentication."""
    project_data = {
        "name": "Unauthorized Project",
        "key_salt": "dGVzdF9zYWx0",
    }

    response = await client.post("/api/projects", json=project_data)
    assert response.status_code == 401


# =============================================================================
# Get Project Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_project_success(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test getting a project by ID."""
    response = await client.get(
        f"/api/projects/{test_project.id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_project.id
    assert data["name"] == test_project.name
    assert "environments" in data


@pytest.mark.asyncio
async def test_get_project_with_environments(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test getting a project includes its environments."""
    response = await client.get(
        f"/api/projects/{test_project.id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["environments"]) >= 1
    env_ids = [e["id"] for e in data["environments"]]
    assert test_environment.id in env_ids


@pytest.mark.asyncio
async def test_get_project_not_found(
    client: AsyncClient, auth_headers: dict
):
    """Test getting a non-existent project."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/projects/{fake_id}", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_project_unauthorized(
    client: AsyncClient, test_project: Project
):
    """Test getting a project without authentication."""
    response = await client.get(f"/api/projects/{test_project.id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_project_forbidden(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    user_factory,
    project_factory,
):
    """Test getting another user's project."""
    other_user = await user_factory.create(db_session)
    other_project = await project_factory.create(db_session, other_user)

    response = await client.get(
        f"/api/projects/{other_project.id}", headers=auth_headers
    )
    assert response.status_code == 404  # Should not reveal existence


# =============================================================================
# Update Project Tests
# =============================================================================

@pytest.mark.asyncio
async def test_update_project_name(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test updating project name."""
    update_data = {"name": "Updated Project Name"}

    response = await client.put(
        f"/api/projects/{test_project.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Project Name"


@pytest.mark.asyncio
async def test_update_project_description(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test updating project description."""
    update_data = {"description": "New description"}

    response = await client.put(
        f"/api/projects/{test_project.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "New description"


@pytest.mark.asyncio
async def test_update_project_icon(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test updating project icon."""
    update_data = {"icon": "🎯"}

    response = await client.put(
        f"/api/projects/{test_project.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["icon"] == "🎯"


@pytest.mark.asyncio
async def test_update_project_multiple_fields(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test updating multiple project fields."""
    update_data = {
        "name": "Multi Update",
        "description": "Multiple fields updated",
        "icon": "✨",
    }

    response = await client.put(
        f"/api/projects/{test_project.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Multi Update"
    assert data["description"] == "Multiple fields updated"
    assert data["icon"] == "✨"


@pytest.mark.asyncio
async def test_update_project_not_found(
    client: AsyncClient, auth_headers: dict
):
    """Test updating a non-existent project."""
    fake_id = str(uuid.uuid4())
    update_data = {"name": "Updated"}

    response = await client.put(
        f"/api/projects/{fake_id}", json=update_data, headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_project_unauthorized(
    client: AsyncClient, test_project: Project
):
    """Test updating a project without authentication."""
    update_data = {"name": "Updated"}

    response = await client.put(
        f"/api/projects/{test_project.id}", json=update_data
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_project_forbidden(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    user_factory,
    project_factory,
):
    """Test updating another user's project."""
    other_user = await user_factory.create(db_session)
    other_project = await project_factory.create(db_session, other_user)

    update_data = {"name": "Hacked"}

    response = await client.put(
        f"/api/projects/{other_project.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 404


# =============================================================================
# Delete Project Tests
# =============================================================================

@pytest.mark.asyncio
async def test_delete_project_success(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test deleting a project."""
    response = await client.delete(
        f"/api/projects/{test_project.id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Verify it's deleted
    response = await client.get(
        f"/api/projects/{test_project.id}", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_cascades_to_environments(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test that deleting a project deletes its environments."""
    # Delete project
    response = await client.delete(
        f"/api/projects/{test_project.id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Verify environment is also deleted (can't access it)
    response = await client.get(
        f"/api/environments/{test_project.id}/environments/{test_environment.id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_not_found(
    client: AsyncClient, auth_headers: dict
):
    """Test deleting a non-existent project."""
    fake_id = str(uuid.uuid4())
    response = await client.delete(
        f"/api/projects/{fake_id}", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_unauthorized(
    client: AsyncClient, test_project: Project
):
    """Test deleting a project without authentication."""
    response = await client.delete(f"/api/projects/{test_project.id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_project_forbidden(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    user_factory,
    project_factory,
):
    """Test deleting another user's project."""
    other_user = await user_factory.create(db_session)
    other_project = await project_factory.create(db_session, other_user)

    response = await client.delete(
        f"/api/projects/{other_project.id}", headers=auth_headers
    )
    assert response.status_code == 404


# =============================================================================
# Archive/Unarchive Tests
# =============================================================================

@pytest.mark.asyncio
async def test_archive_project(
    client: AsyncClient, auth_headers: dict, test_project: Project
):
    """Test archiving a project."""
    response = await client.post(
        f"/api/projects/{test_project.id}/archive", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_archived"] is True


@pytest.mark.asyncio
async def test_unarchive_project(
    client: AsyncClient, auth_headers: dict, archived_project: Project
):
    """Test unarchiving a project."""
    response = await client.post(
        f"/api/projects/{archived_project.id}/unarchive", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_archived"] is False


@pytest.mark.asyncio
async def test_archive_already_archived(
    client: AsyncClient, auth_headers: dict, archived_project: Project
):
    """Test archiving an already archived project."""
    response = await client.post(
        f"/api/projects/{archived_project.id}/archive", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_archived"] is True


@pytest.mark.asyncio
async def test_archive_project_unauthorized(
    client: AsyncClient, test_project: Project
):
    """Test archiving without authentication."""
    response = await client.post(
        f"/api/projects/{test_project.id}/archive"
    )
    assert response.status_code == 401


# =============================================================================
# Search Tests
# =============================================================================

@pytest.mark.asyncio
async def test_search_variables_across_projects(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable,
):
    """Test searching variables across projects."""
    search_data = {"query": "DATABASE"}

    response = await client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) >= 1
    assert data["results"][0]["variable"]["key"] == "DATABASE_URL"


@pytest.mark.asyncio
async def test_search_variables_by_project(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_user: User,
    project_factory,
    environment_factory,
    variable_factory,
):
    """Test searching variables filtered by project."""
    # Create two projects with variables
    project1 = await project_factory.create(db_session, test_user, name="P1")
    env1 = await environment_factory.create(db_session, project1)
    await variable_factory.create(db_session, env1, key="API_KEY")

    project2 = await project_factory.create(db_session, test_user, name="P2")
    env2 = await environment_factory.create(db_session, project2)
    await variable_factory.create(db_session, env2, key="API_SECRET")

    # Search only in project1
    search_data = {"query": "API", "project_ids": [project1.id]}

    response = await client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1
    assert data["results"][0]["variable"]["key"] == "API_KEY"


@pytest.mark.asyncio
async def test_search_variables_no_results(
    client: AsyncClient, auth_headers: dict
):
    """Test searching with no matches."""
    search_data = {"query": "NONEXISTENT_VAR"}

    response = await client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 0
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_search_variables_case_insensitive(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable,
):
    """Test that search is case-insensitive."""
    search_data = {"query": "database"}  # lowercase

    response = await client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) >= 1
