from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    except Exception as e:
        return {"status": "not_ready", "database": str(e)}


@router.get("/permissions")
async def check_permissions():
    """Check which Microsoft Graph permissions are granted to the app."""
    from app.services.graph_client import graph_client

    checks = [
        {"name": "User.Read.All", "endpoint": "/users?$top=1"},
        {"name": "Group.Read.All", "endpoint": "/groups?$top=1"},
        {"name": "Policy.Read.All", "endpoint": "/identity/conditionalAccess/policies"},
        {"name": "DeviceManagementRBAC.Read.All", "endpoint": "/deviceManagement/roleDefinitions"},
        {"name": "DeviceManagementConfiguration.Read.All", "endpoint": "/deviceManagement/deviceCompliancePolicies"},
        {"name": "DeviceManagementManagedDevices.Read.All", "endpoint": "/deviceManagement/managedDevices?$top=1"},
        {"name": "DeviceManagementApps.Read.All", "endpoint": "/deviceAppManagement/mobileApps?$top=1"},
    ]

    results = []
    for check in checks:
        try:
            await graph_client.get(check["endpoint"])
            results.append({
                "permission": check["name"],
                "status": "granted",
                "endpoint": check["endpoint"],
            })
        except Exception as e:
            status = "denied" if "403" in str(e) else "error"
            results.append({
                "permission": check["name"],
                "status": status,
                "endpoint": check["endpoint"],
                "error": str(e)[:200],
            })

    granted = sum(1 for r in results if r["status"] == "granted")
    return {
        "total": len(results),
        "granted": granted,
        "denied": len(results) - granted,
        "checks": results,
    }
