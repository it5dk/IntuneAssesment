from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes import health, templates, monitors, snapshots, drifts, overview, devices, compare, configuration, assignments, groups, assessment_manager, zero_trust


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield


app = FastAPI(
    title="Drift Control",
    description="Configuration drift monitoring for Microsoft Entra ID and Intune",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(templates.router)
app.include_router(monitors.router)
app.include_router(snapshots.router)
app.include_router(drifts.router)
app.include_router(overview.router)
app.include_router(devices.router)
app.include_router(compare.router)
app.include_router(configuration.router)
app.include_router(assignments.router)
app.include_router(groups.router)
app.include_router(assessment_manager.router)
app.include_router(zero_trust.router)
