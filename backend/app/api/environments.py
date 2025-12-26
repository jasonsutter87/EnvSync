"""
Environments API Routes
CRUD operations for environments within projects
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.project import Project, Environment, Variable
from app.models.audit import AuditLog
from app.schemas.project import (
    EnvironmentCreate,
    EnvironmentResponse,
    EnvironmentWithVariables,
)
from app.api.deps import get_current_active_user

router = APIRouter()


async def _get_project_or_404(
    project_id: str, user: User, db: AsyncSession
) -> Project:
    """Get project or raise 404."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/{project_id}/environments", response_model=list[EnvironmentWithVariables])
async def list_environments(
    project_id: str,
    include_variables: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all environments for a project."""
    await _get_project_or_404(project_id, current_user, db)

    query = (
        select(Environment)
        .where(Environment.project_id == project_id)
        .order_by(Environment.display_order)
    )

    if include_variables:
        query = query.options(selectinload(Environment.variables))

    result = await db.execute(query)
    environments = result.scalars().all()

    responses = []
    for env in environments:
        response = EnvironmentWithVariables.model_validate(env)
        response.variable_count = len(env.variables) if include_variables else 0
        responses.append(response)

    return responses


@router.post(
    "/{project_id}/environments",
    response_model=EnvironmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_environment(
    project_id: str,
    data: EnvironmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new environment in a project."""
    project = await _get_project_or_404(project_id, current_user, db)

    # Check for duplicate name
    result = await db.execute(
        select(Environment)
        .where(Environment.project_id == project_id)
        .where(Environment.name == data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment with this name already exists",
        )

    environment = Environment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=data.name,
        display_order=data.display_order,
        color=data.color,
    )
    db.add(environment)

    await _log_action(db, current_user, "environment.create", project_id, environment.id, data.name)
    await db.commit()
    await db.refresh(environment)

    return EnvironmentResponse.model_validate(environment)


@router.get(
    "/{project_id}/environments/{environment_id}",
    response_model=EnvironmentWithVariables,
)
async def get_environment(
    project_id: str,
    environment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get environment with all variables."""
    await _get_project_or_404(project_id, current_user, db)

    result = await db.execute(
        select(Environment)
        .where(Environment.id == environment_id)
        .where(Environment.project_id == project_id)
        .options(selectinload(Environment.variables))
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")

    response = EnvironmentWithVariables.model_validate(environment)
    response.variable_count = len(environment.variables)
    return response


@router.put(
    "/{project_id}/environments/{environment_id}",
    response_model=EnvironmentResponse,
)
async def update_environment(
    project_id: str,
    environment_id: str,
    data: EnvironmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update an environment."""
    await _get_project_or_404(project_id, current_user, db)

    result = await db.execute(
        select(Environment)
        .where(Environment.id == environment_id)
        .where(Environment.project_id == project_id)
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")

    # Check for duplicate name (excluding current)
    if data.name != environment.name:
        result = await db.execute(
            select(Environment)
            .where(Environment.project_id == project_id)
            .where(Environment.name == data.name)
            .where(Environment.id != environment_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Environment with this name already exists",
            )

    environment.name = data.name
    environment.display_order = data.display_order
    environment.color = data.color

    await _log_action(db, current_user, "environment.update", project_id, environment_id, data.name)
    await db.commit()
    await db.refresh(environment)

    return EnvironmentResponse.model_validate(environment)


@router.delete(
    "/{project_id}/environments/{environment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_environment(
    project_id: str,
    environment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete an environment and all its variables."""
    await _get_project_or_404(project_id, current_user, db)

    result = await db.execute(
        select(Environment)
        .where(Environment.id == environment_id)
        .where(Environment.project_id == project_id)
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")

    await _log_action(
        db, current_user, "environment.delete", project_id, environment_id, environment.name
    )
    await db.delete(environment)
    await db.commit()


@router.post(
    "/{project_id}/environments/{environment_id}/clone",
    response_model=EnvironmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def clone_environment(
    project_id: str,
    environment_id: str,
    new_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Clone an environment with all its variables."""
    await _get_project_or_404(project_id, current_user, db)

    # Get source environment with variables
    result = await db.execute(
        select(Environment)
        .where(Environment.id == environment_id)
        .where(Environment.project_id == project_id)
        .options(selectinload(Environment.variables))
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found")

    # Check for duplicate name
    result = await db.execute(
        select(Environment)
        .where(Environment.project_id == project_id)
        .where(Environment.name == new_name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment with this name already exists",
        )

    # Create new environment
    new_env = Environment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=new_name,
        display_order=source.display_order + 1,
        color=source.color,
    )
    db.add(new_env)

    # Clone variables
    for var in source.variables:
        new_var = Variable(
            id=str(uuid.uuid4()),
            environment_id=new_env.id,
            key=var.key,
            encrypted_value=var.encrypted_value,
            value_nonce=var.value_nonce,
            description=var.description,
            is_secret=var.is_secret,
            category=var.category,
        )
        db.add(new_var)

    await _log_action(db, current_user, "environment.clone", project_id, new_env.id, new_name)
    await db.commit()
    await db.refresh(new_env)

    response = EnvironmentResponse.model_validate(new_env)
    response.variable_count = len(source.variables)
    return response


async def _log_action(
    db: AsyncSession,
    user: User,
    action: str,
    project_id: str,
    environment_id: str,
    environment_name: str,
):
    """Log environment action to audit trail."""
    from app.core.config import settings

    if not settings.AUDIT_LOG_ENABLED:
        return

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type="environment",
        resource_id=environment_id,
        resource_name=environment_name,
        project_id=project_id,
        environment_name=environment_name,
    )
    db.add(log)
