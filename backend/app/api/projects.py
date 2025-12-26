"""
Projects API Routes
CRUD operations for projects
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.project import Project, Environment, Variable
from app.models.audit import AuditLog
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectDetail,
    SearchRequest,
    SearchResponse,
    SearchResult,
)
from app.api.deps import get_current_active_user

router = APIRouter()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    archived: bool = Query(False, description="Include archived projects"),
    search: Optional[str] = Query(None, description="Search by name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all projects for current user."""
    query = (
        select(Project)
        .where(Project.owner_id == current_user.id)
        .order_by(Project.updated_at.desc())
    )

    if not archived:
        query = query.where(Project.is_archived == False)

    if search:
        query = query.where(Project.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Get paginated results
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    projects = result.scalars().all()

    # Get counts for each project
    project_responses = []
    for project in projects:
        env_count = await db.execute(
            select(func.count()).where(Environment.project_id == project.id)
        )
        var_count = await db.execute(
            select(func.count())
            .select_from(Variable)
            .join(Environment)
            .where(Environment.project_id == project.id)
        )

        response = ProjectResponse.model_validate(project)
        response.environment_count = env_count.scalar() or 0
        response.variable_count = var_count.scalar() or 0
        project_responses.append(response)

    return ProjectListResponse(projects=project_responses, total=total)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new project with environments."""
    # Create project
    project = Project(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        icon=data.icon,
        owner_id=current_user.id,
        key_salt=data.key_salt,
    )
    db.add(project)

    # Create default environments
    for env_data in data.environments:
        environment = Environment(
            id=str(uuid.uuid4()),
            project_id=project.id,
            name=env_data.name,
            display_order=env_data.display_order,
            color=env_data.color,
        )
        db.add(environment)

    # Audit log
    await _log_action(db, current_user, "project.create", project.id, project.name)

    await db.commit()
    await db.refresh(project)

    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get project details with environments and variables."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == current_user.id)
        .options(selectinload(Project.environments).selectinload(Environment.variables))
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return ProjectDetail.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update project details."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Update fields
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.icon is not None:
        project.icon = data.icon
    if data.is_archived is not None:
        project.is_archived = data.is_archived

    await _log_action(db, current_user, "project.update", project.id, project.name)
    await db.commit()
    await db.refresh(project)

    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a project and all its data."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    await _log_action(db, current_user, "project.delete", project.id, project.name)
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/archive", response_model=ProjectResponse)
async def archive_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Archive a project."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.is_archived = True
    await _log_action(db, current_user, "project.archive", project.id, project.name)
    await db.commit()
    await db.refresh(project)

    return ProjectResponse.model_validate(project)


@router.post("/{project_id}/unarchive", response_model=ProjectResponse)
async def unarchive_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Unarchive a project."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.is_archived = False
    await _log_action(db, current_user, "project.unarchive", project.id, project.name)
    await db.commit()
    await db.refresh(project)

    return ProjectResponse.model_validate(project)


@router.post("/search", response_model=SearchResponse)
async def search_variables(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Search variables across projects."""
    query = (
        select(Variable, Environment, Project)
        .join(Environment, Variable.environment_id == Environment.id)
        .join(Project, Environment.project_id == Project.id)
        .where(Project.owner_id == current_user.id)
        .where(Variable.key.ilike(f"%{data.query}%"))
    )

    if data.project_ids:
        query = query.where(Project.id.in_(data.project_ids))

    if data.environment_names:
        query = query.where(Environment.name.in_(data.environment_names))

    query = query.limit(100)
    result = await db.execute(query)
    rows = result.all()

    results = []
    for variable, environment, project in rows:
        from app.schemas.project import VariableResponse

        results.append(
            SearchResult(
                variable=VariableResponse.model_validate(variable),
                project_id=project.id,
                project_name=project.name,
                environment_id=environment.id,
                environment_name=environment.name,
            )
        )

    return SearchResponse(results=results, total=len(results))


async def _log_action(
    db: AsyncSession,
    user: User,
    action: str,
    resource_id: str,
    resource_name: str,
):
    """Log project action to audit trail."""
    from app.core.config import settings

    if not settings.AUDIT_LOG_ENABLED:
        return

    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type="project",
        resource_id=resource_id,
        resource_name=resource_name,
    )
    db.add(log)
