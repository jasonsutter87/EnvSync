"""
Variables API Routes
CRUD operations for encrypted environment variables
"""
import uuid
import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.project import Project, Environment, Variable
from app.models.audit import AuditLog
from app.schemas.project import (
    VariableCreate,
    VariableUpdate,
    VariableResponse,
    EnvFileImport,
    EnvFileExport,
)
from app.api.deps import get_current_active_user

router = APIRouter()


async def _get_environment_or_404(
    project_id: str, environment_id: str, user: User, db: AsyncSession
) -> Environment:
    """Get environment and verify ownership."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    result = await db.execute(
        select(Environment)
        .where(Environment.id == environment_id)
        .where(Environment.project_id == project_id)
    )
    environment = result.scalar_one_or_none()
    if not environment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")

    return environment


@router.get(
    "/{project_id}/environments/{environment_id}/variables",
    response_model=list[VariableResponse],
)
async def list_variables(
    project_id: str,
    environment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all variables in an environment."""
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    result = await db.execute(
        select(Variable)
        .where(Variable.environment_id == environment_id)
        .order_by(Variable.key)
    )
    variables = result.scalars().all()

    return [VariableResponse.model_validate(v) for v in variables]


@router.post(
    "/{project_id}/environments/{environment_id}/variables",
    response_model=VariableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_variable(
    project_id: str,
    environment_id: str,
    data: VariableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new variable."""
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    # Check for duplicate key
    result = await db.execute(
        select(Variable)
        .where(Variable.environment_id == environment_id)
        .where(Variable.key == data.key)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variable with this key already exists",
        )

    variable = Variable(
        id=str(uuid.uuid4()),
        environment_id=environment_id,
        key=data.key,
        encrypted_value=data.encrypted_value,
        value_nonce=data.value_nonce,
        description=data.description,
        is_secret=data.is_secret,
        category=data.category,
    )
    db.add(variable)

    await _log_action(
        db, current_user, "variable.create", project_id, environment_id, variable.id, data.key
    )
    await db.commit()
    await db.refresh(variable)

    return VariableResponse.model_validate(variable)


@router.post(
    "/{project_id}/environments/{environment_id}/variables/bulk",
    response_model=list[VariableResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_variables_bulk(
    project_id: str,
    environment_id: str,
    data: List[VariableCreate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create multiple variables at once."""
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    # Get existing keys
    result = await db.execute(
        select(Variable.key).where(Variable.environment_id == environment_id)
    )
    existing_keys = set(result.scalars().all())

    created = []
    for var_data in data:
        if var_data.key in existing_keys:
            continue  # Skip duplicates

        variable = Variable(
            id=str(uuid.uuid4()),
            environment_id=environment_id,
            key=var_data.key,
            encrypted_value=var_data.encrypted_value,
            value_nonce=var_data.value_nonce,
            description=var_data.description,
            is_secret=var_data.is_secret,
            category=var_data.category,
        )
        db.add(variable)
        created.append(variable)
        existing_keys.add(var_data.key)

    await _log_action(
        db, current_user, "variable.bulk_create", project_id, environment_id, None,
        f"{len(created)} variables"
    )
    await db.commit()

    return [VariableResponse.model_validate(v) for v in created]


@router.get(
    "/{project_id}/environments/{environment_id}/variables/{variable_id}",
    response_model=VariableResponse,
)
async def get_variable(
    project_id: str,
    environment_id: str,
    variable_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific variable."""
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    result = await db.execute(
        select(Variable)
        .where(Variable.id == variable_id)
        .where(Variable.environment_id == environment_id)
    )
    variable = result.scalar_one_or_none()

    if not variable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variable not found")

    await _log_action(
        db, current_user, "variable.read", project_id, environment_id, variable_id, variable.key
    )
    await db.commit()

    return VariableResponse.model_validate(variable)


@router.put(
    "/{project_id}/environments/{environment_id}/variables/{variable_id}",
    response_model=VariableResponse,
)
async def update_variable(
    project_id: str,
    environment_id: str,
    variable_id: str,
    data: VariableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a variable."""
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    result = await db.execute(
        select(Variable)
        .where(Variable.id == variable_id)
        .where(Variable.environment_id == environment_id)
    )
    variable = result.scalar_one_or_none()

    if not variable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variable not found")

    # Store previous value for history
    if data.encrypted_value is not None:
        variable.previous_value_encrypted = variable.encrypted_value
        variable.encrypted_value = data.encrypted_value
        variable.version += 1
    if data.value_nonce is not None:
        variable.value_nonce = data.value_nonce
    if data.description is not None:
        variable.description = data.description
    if data.is_secret is not None:
        variable.is_secret = data.is_secret
    if data.category is not None:
        variable.category = data.category

    await _log_action(
        db, current_user, "variable.update", project_id, environment_id, variable_id, variable.key
    )
    await db.commit()
    await db.refresh(variable)

    return VariableResponse.model_validate(variable)


@router.delete(
    "/{project_id}/environments/{environment_id}/variables/{variable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_variable(
    project_id: str,
    environment_id: str,
    variable_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a variable."""
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    result = await db.execute(
        select(Variable)
        .where(Variable.id == variable_id)
        .where(Variable.environment_id == environment_id)
    )
    variable = result.scalar_one_or_none()

    if not variable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variable not found")

    await _log_action(
        db, current_user, "variable.delete", project_id, environment_id, variable_id, variable.key
    )
    await db.delete(variable)
    await db.commit()


@router.post(
    "/{project_id}/environments/{environment_id}/import",
    response_model=list[VariableResponse],
)
async def import_env_file(
    project_id: str,
    environment_id: str,
    data: EnvFileImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Import variables from .env file content.
    Note: Values must be encrypted client-side before sending.
    This endpoint expects pre-encrypted content in a special format.
    """
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    # Parse env file (expects format: KEY=encrypted_value::nonce)
    lines = data.content.strip().split("\n")
    pattern = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)=(.+)::(.+)$')

    imported = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        match = pattern.match(line)
        if not match:
            continue

        key, encrypted_value, nonce = match.groups()

        # Check if variable exists
        result = await db.execute(
            select(Variable)
            .where(Variable.environment_id == environment_id)
            .where(Variable.key == key)
        )
        existing = result.scalar_one_or_none()

        if existing:
            if data.overwrite:
                existing.previous_value_encrypted = existing.encrypted_value
                existing.encrypted_value = encrypted_value
                existing.value_nonce = nonce
                existing.version += 1
                imported.append(existing)
        else:
            variable = Variable(
                id=str(uuid.uuid4()),
                environment_id=environment_id,
                key=key,
                encrypted_value=encrypted_value,
                value_nonce=nonce,
            )
            db.add(variable)
            imported.append(variable)

    await _log_action(
        db, current_user, "variable.import", project_id, environment_id, None,
        f"{len(imported)} variables"
    )
    await db.commit()

    return [VariableResponse.model_validate(v) for v in imported]


@router.post(
    "/{project_id}/environments/{environment_id}/export",
    response_model=dict,
)
async def export_env_file(
    project_id: str,
    environment_id: str,
    data: EnvFileExport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Export variables as .env format.
    Returns encrypted values that client must decrypt.
    """
    await _get_environment_or_404(project_id, environment_id, current_user, db)

    result = await db.execute(
        select(Variable)
        .where(Variable.environment_id == environment_id)
        .order_by(Variable.key)
    )
    variables = result.scalars().all()

    # Build export format (client will decrypt)
    lines = []
    if data.include_comments:
        lines.append("# EnvSync Export")
        lines.append("# Values are encrypted - decrypt client-side")
        lines.append("")

    for var in variables:
        if not data.include_empty and not var.encrypted_value:
            continue
        lines.append(f"{var.key}={var.encrypted_value}::{var.value_nonce}")

    await _log_action(
        db, current_user, "variable.export", project_id, environment_id, None,
        f"{len(variables)} variables"
    )
    await db.commit()

    return {"content": "\n".join(lines)}


async def _log_action(
    db: AsyncSession,
    user: User,
    action: str,
    project_id: str,
    environment_id: str,
    variable_id: str | None,
    variable_key: str,
):
    """Log variable action to audit trail."""
    from app.core.config import settings

    if not settings.AUDIT_LOG_ENABLED:
        return

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type="variable",
        resource_id=variable_id,
        resource_name=variable_key,
        project_id=project_id,
    )
    db.add(log)
