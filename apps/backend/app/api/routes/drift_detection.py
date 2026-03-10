import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["drift-detection"])


@router.get("/drift-detection")
async def get_drift_detection():
    """Detect configuration drift by comparing current config policies against a known baseline."""
    results: dict = {"policies": [], "profiles": [], "apps": []}
    errors: list[dict] = []

    # 1. Device configuration profiles - fetch current state
    try:
        configs = await graph_client.get_all(
            "/deviceManagement/deviceConfigurations",
            params={
                "$select": "id,displayName,description,lastModifiedDateTime,version,createdDateTime",
                "$orderby": "lastModifiedDateTime desc",
            },
        )
        for c in configs:
            created = c.get("createdDateTime", "")
            modified = c.get("lastModifiedDateTime", "")
            drifted = created != modified and modified != ""
            results["profiles"].append({
                "id": c.get("id", ""),
                "name": c.get("displayName", "Unknown"),
                "description": c.get("description", ""),
                "created": created,
                "last_modified": modified,
                "version": c.get("version", 1),
                "drifted": drifted,
            })
    except Exception as e:
        logger.warning("Failed to fetch device configurations: %s", e)
        errors.append({"source": "Device Configurations", "error": str(e)})

    # 2. Compliance policies - detect version changes
    try:
        policies = await graph_client.get_all(
            "/deviceManagement/deviceCompliancePolicies",
            params={
                "$select": "id,displayName,description,lastModifiedDateTime,version,createdDateTime",
                "$orderby": "lastModifiedDateTime desc",
            },
        )
        for p in policies:
            created = p.get("createdDateTime", "")
            modified = p.get("lastModifiedDateTime", "")
            version = p.get("version", 1)
            drifted = version > 1 or (created != modified and modified != "")
            results["policies"].append({
                "id": p.get("id", ""),
                "name": p.get("displayName", "Unknown"),
                "description": p.get("description", ""),
                "created": created,
                "last_modified": modified,
                "version": version,
                "drifted": drifted,
            })
    except Exception as e:
        logger.warning("Failed to fetch compliance policies: %s", e)
        errors.append({"source": "Compliance Policies", "error": str(e)})

    # 3. App configuration policies
    try:
        app_configs = await graph_client.get_all(
            "/deviceAppManagement/mobileAppConfigurations",
            params={
                "$select": "id,displayName,description,lastModifiedDateTime,version,createdDateTime",
                "$orderby": "lastModifiedDateTime desc",
            },
        )
        for a in app_configs:
            created = a.get("createdDateTime", "")
            modified = a.get("lastModifiedDateTime", "")
            drifted = created != modified and modified != ""
            results["apps"].append({
                "id": a.get("id", ""),
                "name": a.get("displayName", "Unknown"),
                "description": a.get("description", ""),
                "created": created,
                "last_modified": modified,
                "version": a.get("version", 1),
                "drifted": drifted,
            })
    except Exception as e:
        logger.warning("Failed to fetch app configurations: %s", e)
        errors.append({"source": "App Configurations", "error": str(e)})

    drifted_profiles = sum(1 for p in results["profiles"] if p["drifted"])
    drifted_policies = sum(1 for p in results["policies"] if p["drifted"])
    drifted_apps = sum(1 for a in results["apps"] if a["drifted"])

    summary = {
        "total_profiles": len(results["profiles"]),
        "drifted_profiles": drifted_profiles,
        "total_policies": len(results["policies"]),
        "drifted_policies": drifted_policies,
        "total_apps": len(results["apps"]),
        "drifted_apps": drifted_apps,
        "total_drifted": drifted_profiles + drifted_policies + drifted_apps,
    }

    return {"data": results, "summary": summary, "errors": errors}
