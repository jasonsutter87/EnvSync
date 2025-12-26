"""
Project Schemas
Request/response models for projects, environments, and variables
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class VariableCreate(BaseModel):
    """Create a new variable."""

    key: str = Field(max_length=255)
    encrypted_value: str = Field(description="Base64 encoded encrypted value")
    value_nonce: str = Field(description="Base64 encoded nonce")
    description: Optional[str] = None
    is_secret: bool = True
    category: Optional[str] = None


class VariableUpdate(BaseModel):
    """Update a variable."""

    encrypted_value: Optional[str] = None
    value_nonce: Optional[str] = None
    description: Optional[str] = None
    is_secret: Optional[bool] = None
    category: Optional[str] = None


class VariableResponse(BaseModel):
    """Variable response."""

    id: str
    key: str
    encrypted_value: str
    value_nonce: str
    description: Optional[str]
    is_secret: bool
    category: Optional[str]
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnvironmentCreate(BaseModel):
    """Create a new environment."""

    name: str = Field(max_length=50)
    display_order: int = 0
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#[0-9A-Fa-f]{6}$")


class EnvironmentResponse(BaseModel):
    """Environment response."""

    id: str
    name: str
    display_order: int
    color: Optional[str]
    variable_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EnvironmentWithVariables(EnvironmentResponse):
    """Environment with all variables."""

    variables: List[VariableResponse] = []


class ProjectCreate(BaseModel):
    """Create a new project."""

    name: str = Field(max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    key_salt: str = Field(description="Project-specific encryption salt")
    environments: List[EnvironmentCreate] = Field(
        default_factory=lambda: [
            EnvironmentCreate(name="development", display_order=0, color="#22c55e"),
            EnvironmentCreate(name="staging", display_order=1, color="#f59e0b"),
            EnvironmentCreate(name="production", display_order=2, color="#ef4444"),
        ]
    )


class ProjectUpdate(BaseModel):
    """Update a project."""

    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    is_archived: Optional[bool] = None


class ProjectResponse(BaseModel):
    """Project response."""

    id: str
    name: str
    description: Optional[str]
    icon: Optional[str]
    owner_id: str
    team_id: Optional[str]
    sync_enabled: bool
    last_synced_at: Optional[datetime]
    is_archived: bool
    environment_count: int = 0
    variable_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """List of projects response."""

    projects: List[ProjectResponse]
    total: int


class ProjectDetail(ProjectResponse):
    """Project with environments."""

    environments: List[EnvironmentWithVariables] = []


class EnvFileImport(BaseModel):
    """Import .env file content."""

    content: str = Field(description="Raw .env file content")
    environment_id: str
    overwrite: bool = False


class EnvFileExport(BaseModel):
    """Export options."""

    environment_id: str
    include_comments: bool = True
    include_empty: bool = False


class SearchRequest(BaseModel):
    """Search variables across projects."""

    query: str = Field(min_length=1, max_length=255)
    project_ids: Optional[List[str]] = None
    environment_names: Optional[List[str]] = None


class SearchResult(BaseModel):
    """Search result item."""

    variable: VariableResponse
    project_id: str
    project_name: str
    environment_id: str
    environment_name: str


class SearchResponse(BaseModel):
    """Search response."""

    results: List[SearchResult]
    total: int
