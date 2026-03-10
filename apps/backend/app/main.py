""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\main.py
#  Description: (edit inside USER NOTES below)
# 
#  BEGIN AUTODOC META
#  Version: 0.0.0.3
#  Last-Updated: 2026-02-19 00:30:35
#  Managed-By: autosave.ps1
#  END AUTODOC META
# 
#  BEGIN USER NOTES
#  Your notes here. We will NEVER change this block.
#  END USER NOTES
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes import health, templates, monitors, snapshots, drifts, overview, devices, compare, configuration, assignments, groups, assessment_manager, zero_trust, identity, certificates, device_compliance, privileged_access, endpoint_protection, security_alerts, threat_analytics, audit_logs, automation, drift_detection, security_score, policy_conflicts, tenant_risk, expiring_permissions, inactive_admins, shadow_apps


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
app.include_router(identity.router)
app.include_router(certificates.router)
app.include_router(device_compliance.router)
app.include_router(privileged_access.router)
app.include_router(endpoint_protection.router)
app.include_router(security_alerts.router)
app.include_router(threat_analytics.router)
app.include_router(audit_logs.router)
app.include_router(automation.router)
app.include_router(drift_detection.router)
app.include_router(security_score.router)
app.include_router(policy_conflicts.router)
app.include_router(tenant_risk.router)
app.include_router(expiring_permissions.router)
app.include_router(inactive_admins.router)
app.include_router(shadow_apps.router)


