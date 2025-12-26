"""
EnvSync FastAPI Backend
Zero-knowledge .env manager API for web and Docker deployments
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, projects, environments, variables, sync, teams, admin
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    await init_db()
    yield


app = FastAPI(
    title="EnvSync API",
    description="Zero-knowledge .env manager - Sync secrets, not trust.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(environments.router, prefix="/api/environments", tags=["Environments"])
app.include_router(variables.router, prefix="/api/variables", tags=["Variables"])
app.include_router(sync.router, prefix="/api/sync", tags=["Sync"])
app.include_router(teams.router, prefix="/api/teams", tags=["Teams"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/Kubernetes."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "EnvSync API",
        "tagline": "Sync secrets. Not trust.",
        "docs": "/docs",
        "health": "/health",
    }
