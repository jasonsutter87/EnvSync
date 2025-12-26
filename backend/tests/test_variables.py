"""
Variable API Tests
Comprehensive tests for variable CRUD, encryption/decryption, and secret handling
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project, Environment, Variable


# =============================================================================
# List Variables Tests
# =============================================================================

@pytest.mark.asyncio
async def test_list_variables_empty(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test listing variables when none exist."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_list_variables_single(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test listing variables with one variable."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == test_variable.id
    assert data[0]["key"] == "DATABASE_URL"


@pytest.mark.asyncio
async def test_list_variables_multiple(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
    api_key_variable: Variable,
    public_variable: Variable,
):
    """Test listing multiple variables."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Should be ordered by key
    keys = [v["key"] for v in data]
    assert keys == sorted(keys)


@pytest.mark.asyncio
async def test_list_variables_ordered_by_key(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_project: Project,
    test_environment: Environment,
    variable_factory,
):
    """Test that variables are ordered alphabetically by key."""
    # Create variables in random order
    await variable_factory.create(db_session, test_environment, key="ZEBRA")
    await variable_factory.create(db_session, test_environment, key="APPLE")
    await variable_factory.create(db_session, test_environment, key="MANGO")

    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["key"] == "APPLE"
    assert data[1]["key"] == "MANGO"
    assert data[2]["key"] == "ZEBRA"


@pytest.mark.asyncio
async def test_list_variables_environment_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
):
    """Test listing variables for non-existent environment."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{fake_id}/variables",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_variables_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
):
    """Test listing variables without authentication."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables"
    )
    assert response.status_code == 401


# =============================================================================
# Create Variable Tests
# =============================================================================

@pytest.mark.asyncio
async def test_create_variable_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a variable successfully."""
    var_data = {
        "key": "NEW_VAR",
        "encrypted_value": "ZW5jcnlwdGVkX25ld192YXI=",
        "value_nonce": "bmV3X25vbmNl",
        "description": "A new variable",
        "is_secret": True,
        "category": "general",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["key"] == "NEW_VAR"
    assert data["encrypted_value"] == "ZW5jcnlwdGVkX25ld192YXI="
    assert data["description"] == "A new variable"
    assert data["is_secret"] is True
    assert data["category"] == "general"
    assert data["version"] == 1


@pytest.mark.asyncio
async def test_create_variable_minimal(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a variable with minimal data."""
    var_data = {
        "key": "MINIMAL",
        "encrypted_value": "dmFsdWU=",
        "value_nonce": "bm9uY2U=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["key"] == "MINIMAL"
    assert data["is_secret"] is True  # Default
    assert data["description"] is None
    assert data["category"] is None


@pytest.mark.asyncio
async def test_create_variable_public(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a non-secret variable."""
    var_data = {
        "key": "PUBLIC_VAR",
        "encrypted_value": "cHVibGlj",
        "value_nonce": "bm9uY2U=",
        "is_secret": False,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_secret"] is False


@pytest.mark.asyncio
async def test_create_variable_duplicate_key(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test creating a variable with duplicate key fails."""
    var_data = {
        "key": "DATABASE_URL",  # Already exists
        "encrypted_value": "ZHVwbGljYXRl",
        "value_nonce": "bm9uY2U=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_variable_missing_key(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a variable without key."""
    var_data = {
        "encrypted_value": "dmFsdWU=",
        "value_nonce": "bm9uY2U=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_variable_missing_encrypted_value(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a variable without encrypted value."""
    var_data = {
        "key": "NO_VALUE",
        "value_nonce": "bm9uY2U=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_variable_missing_nonce(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a variable without nonce."""
    var_data = {
        "key": "NO_NONCE",
        "encrypted_value": "dmFsdWU=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_variable_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a variable without authentication."""
    var_data = {
        "key": "UNAUTHORIZED",
        "encrypted_value": "dmFsdWU=",
        "value_nonce": "bm9uY2U=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
    )
    assert response.status_code == 401


# =============================================================================
# Bulk Create Variables Tests
# =============================================================================

@pytest.mark.asyncio
async def test_bulk_create_variables_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test bulk creating variables."""
    vars_data = [
        {
            "key": "VAR_1",
            "encrypted_value": "dmFyMQ==",
            "value_nonce": "bm9uY2Ux",
        },
        {
            "key": "VAR_2",
            "encrypted_value": "dmFyMg==",
            "value_nonce": "bm9uY2Uy",
        },
        {
            "key": "VAR_3",
            "encrypted_value": "dmFyMw==",
            "value_nonce": "bm9uY2Uz",
        },
    ]

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/bulk",
        json=vars_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 3
    assert data[0]["key"] == "VAR_1"
    assert data[1]["key"] == "VAR_2"
    assert data[2]["key"] == "VAR_3"


@pytest.mark.asyncio
async def test_bulk_create_variables_skip_duplicates(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test bulk create skips duplicate keys."""
    vars_data = [
        {
            "key": "DATABASE_URL",  # Already exists
            "encrypted_value": "ZHVwbGljYXRl",
            "value_nonce": "bm9uY2U=",
        },
        {
            "key": "NEW_VAR",
            "encrypted_value": "bmV3",
            "value_nonce": "bm9uY2U=",
        },
    ]

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/bulk",
        json=vars_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 1  # Only NEW_VAR created
    assert data[0]["key"] == "NEW_VAR"


@pytest.mark.asyncio
async def test_bulk_create_variables_empty_list(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test bulk create with empty list."""
    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/bulk",
        json=[],
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 0


# =============================================================================
# Get Variable Tests
# =============================================================================

@pytest.mark.asyncio
async def test_get_variable_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test getting a variable by ID."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_variable.id
    assert data["key"] == "DATABASE_URL"
    assert data["encrypted_value"] == test_variable.encrypted_value
    assert data["value_nonce"] == test_variable.value_nonce


@pytest.mark.asyncio
async def test_get_variable_includes_metadata(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test getting a variable includes all metadata."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "description" in data
    assert "is_secret" in data
    assert "category" in data
    assert "version" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_get_variable_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test getting a non-existent variable."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{fake_id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_variable_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test getting a variable without authentication."""
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}"
    )
    assert response.status_code == 401


# =============================================================================
# Update Variable Tests
# =============================================================================

@pytest.mark.asyncio
async def test_update_variable_value(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test updating variable value."""
    update_data = {
        "encrypted_value": "dXBkYXRlZF92YWx1ZQ==",
        "value_nonce": "dXBkYXRlZF9ub25jZQ==",
    }

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["encrypted_value"] == "dXBkYXRlZF92YWx1ZQ=="
    assert data["value_nonce"] == "dXBkYXRlZF9ub25jZQ=="
    assert data["version"] == 2  # Version incremented


@pytest.mark.asyncio
async def test_update_variable_description(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test updating variable description."""
    update_data = {"description": "Updated description"}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_variable_is_secret(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test updating variable is_secret flag."""
    update_data = {"is_secret": False}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_secret"] is False


@pytest.mark.asyncio
async def test_update_variable_category(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test updating variable category."""
    update_data = {"category": "api"}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "api"


@pytest.mark.asyncio
async def test_update_variable_multiple_fields(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test updating multiple variable fields."""
    update_data = {
        "encrypted_value": "bmV3X3ZhbHVl",
        "value_nonce": "bmV3X25vbmNl",
        "description": "Multi-update",
        "is_secret": False,
        "category": "config",
    }

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["encrypted_value"] == "bmV3X3ZhbHVl"
    assert data["description"] == "Multi-update"
    assert data["is_secret"] is False
    assert data["category"] == "config"


@pytest.mark.asyncio
async def test_update_variable_stores_previous_value(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test that updating stores previous value for history."""
    old_value = test_variable.encrypted_value

    update_data = {
        "encrypted_value": "bmV3X3ZhbHVl",
        "value_nonce": "bmV3X25vbmNl",
    }

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200

    # Refresh to get database state
    await db_session.refresh(test_variable)
    # Previous value should be stored (this is a database-level check)
    # The API doesn't expose previous_value_encrypted, but we verify version incremented
    data = response.json()
    assert data["version"] == 2


@pytest.mark.asyncio
async def test_update_variable_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test updating a non-existent variable."""
    fake_id = str(uuid.uuid4())
    update_data = {"description": "Updated"}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{fake_id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_variable_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test updating a variable without authentication."""
    update_data = {"description": "Hacked"}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
    )
    assert response.status_code == 401


# =============================================================================
# Delete Variable Tests
# =============================================================================

@pytest.mark.asyncio
async def test_delete_variable_success(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test deleting a variable."""
    response = await client.delete(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Verify it's deleted
    response = await client.get(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_variable_not_found(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test deleting a non-existent variable."""
    fake_id = str(uuid.uuid4())
    response = await client.delete(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{fake_id}",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_variable_unauthorized(
    client: AsyncClient,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test deleting a variable without authentication."""
    response = await client.delete(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}"
    )
    assert response.status_code == 401


# =============================================================================
# Import/Export Tests
# =============================================================================

@pytest.mark.asyncio
async def test_import_env_file(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    encrypted_env_content: str,
):
    """Test importing variables from .env file."""
    import_data = {
        "content": encrypted_env_content,
        "environment_id": test_environment.id,
        "overwrite": False,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/import",
        json=import_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    # Check that variables were created
    assert any(v["key"] == "DATABASE_URL" for v in data)


@pytest.mark.asyncio
async def test_import_env_file_overwrite(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test importing with overwrite flag."""
    # Create import data with existing key
    import_content = f"{test_variable.key}=bmV3X3ZhbHVl::bmV3X25vbmNl"
    import_data = {
        "content": import_content,
        "environment_id": test_environment.id,
        "overwrite": True,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/import",
        json=import_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # Variable should be updated
    updated = next(v for v in data if v["key"] == test_variable.key)
    assert updated["version"] == 2  # Version incremented


@pytest.mark.asyncio
async def test_import_env_file_skip_comments(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test that import skips comment lines."""
    import_content = """# This is a comment
VAR_1=dmFsdWUx::bm9uY2Ux
# Another comment
VAR_2=dmFsdWUy::bm9uY2Uy
"""
    import_data = {
        "content": import_content,
        "environment_id": test_environment.id,
        "overwrite": False,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/import",
        json=import_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2  # Only 2 variables, comments skipped


@pytest.mark.asyncio
async def test_export_env_file(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
    api_key_variable: Variable,
):
    """Test exporting variables as .env file."""
    export_data = {
        "environment_id": test_environment.id,
        "include_comments": True,
        "include_empty": False,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/export",
        json=export_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    content = data["content"]
    assert "DATABASE_URL=" in content
    assert "API_KEY=" in content
    assert "::" in content  # Format includes nonce separator


@pytest.mark.asyncio
async def test_export_env_file_without_comments(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test exporting without comments."""
    export_data = {
        "environment_id": test_environment.id,
        "include_comments": False,
        "include_empty": False,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/export",
        json=export_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    content = data["content"]
    assert "#" not in content  # No comments


@pytest.mark.asyncio
async def test_export_empty_environment(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test exporting an environment with no variables."""
    export_data = {
        "environment_id": test_environment.id,
        "include_comments": False,
        "include_empty": False,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/export",
        json=export_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # Should return empty or just comments
    content = data["content"].strip()
    assert len(content) == 0 or content.startswith("#")


# =============================================================================
# Secret Handling Tests
# =============================================================================

@pytest.mark.asyncio
async def test_create_secret_variable(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test creating a secret variable."""
    var_data = {
        "key": "SECRET_KEY",
        "encrypted_value": "c2VjcmV0X3ZhbHVl",
        "value_nonce": "bm9uY2U=",
        "is_secret": True,
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_secret"] is True
    # Value is still encrypted in response
    assert data["encrypted_value"] == "c2VjcmV0X3ZhbHVl"


@pytest.mark.asyncio
async def test_toggle_secret_flag(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test toggling is_secret flag."""
    # Make secret variable public
    update_data = {"is_secret": False}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["is_secret"] is False

    # Make it secret again
    update_data = {"is_secret": True}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["is_secret"] is True


# =============================================================================
# Encryption Format Tests
# =============================================================================

@pytest.mark.asyncio
async def test_variable_stores_encrypted_value(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
):
    """Test that variables store encrypted values."""
    var_data = {
        "key": "ENCRYPTED_VAR",
        "encrypted_value": "dGhpc19pc19lbmNyeXB0ZWQ=",
        "value_nonce": "MTIzNDU2Nzg=",
    }

    response = await client.post(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables",
        json=var_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    # Encrypted value and nonce are returned as-is
    assert data["encrypted_value"] == "dGhpc19pc19lbmNyeXB0ZWQ="
    assert data["value_nonce"] == "MTIzNDU2Nzg="


@pytest.mark.asyncio
async def test_variable_version_increments(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test that version increments on value update."""
    initial_version = test_variable.version

    # Update value
    update_data = {
        "encrypted_value": "bmV3X3ZhbHVl",
        "value_nonce": "bmV3X25vbmNl",
    }

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == initial_version + 1


@pytest.mark.asyncio
async def test_variable_version_not_incremented_on_metadata_update(
    client: AsyncClient,
    auth_headers: dict,
    test_project: Project,
    test_environment: Environment,
    test_variable: Variable,
):
    """Test that version doesn't increment when only updating metadata."""
    initial_version = test_variable.version

    # Update only description (not value)
    update_data = {"description": "Updated description only"}

    response = await client.put(
        f"/api/variables/{test_project.id}/environments/{test_environment.id}/variables/{test_variable.id}",
        json=update_data,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # Version should not increment for metadata-only updates
    assert data["version"] == initial_version
