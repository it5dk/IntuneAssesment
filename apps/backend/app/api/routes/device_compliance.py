import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["device-compliance"])


@router.get("/device-compliance")
async def get_device_compliance():
    results: dict = {"noncompliant": [], "policies": [], "jailbroken": []}
    errors: list[dict] = []

    # 1. Non-compliant devices
    try:
        devices = await graph_client.get_all(
            "/deviceManagement/managedDevices",
            params={
                "$filter": "complianceState eq 'noncompliant'",
                "$select": "id,deviceName,complianceState,osVersion,operatingSystem,userDisplayName,lastSyncDateTime,model,manufacturer",
            },
        )
        for d in devices:
            results["noncompliant"].append({
                "id": d.get("id", ""),
                "device_name": d.get("deviceName", "Unknown"),
                "os": d.get("operatingSystem", ""),
                "os_version": d.get("osVersion", ""),
                "user": d.get("userDisplayName", ""),
                "last_sync": d.get("lastSyncDateTime"),
                "model": d.get("model", ""),
                "manufacturer": d.get("manufacturer", ""),
            })
    except Exception as e:
        logger.warning("Failed to fetch non-compliant devices: %s", e)
        errors.append({"source": "Non-Compliant Devices", "error": str(e)})

    # 2. Compliance policies
    try:
        policies = await graph_client.get_all(
            "/deviceManagement/deviceCompliancePolicies",
            params={"$select": "id,displayName,description,lastModifiedDateTime,version"},
        )
        for p in policies:
            results["policies"].append({
                "id": p.get("id", ""),
                "name": p.get("displayName", "Unknown"),
                "description": p.get("description", ""),
                "last_modified": p.get("lastModifiedDateTime"),
                "version": p.get("version"),
            })
    except Exception as e:
        logger.warning("Failed to fetch compliance policies: %s", e)
        errors.append({"source": "Compliance Policies", "error": str(e)})

    # 3. Jailbroken / Rooted devices
    try:
        jailbroken = await graph_client.get_all(
            "/deviceManagement/managedDevices",
            params={
                "$filter": "jailBroken eq 'True'",
                "$select": "id,deviceName,operatingSystem,osVersion,userDisplayName,lastSyncDateTime,jailBroken",
            },
        )
        for d in jailbroken:
            results["jailbroken"].append({
                "id": d.get("id", ""),
                "device_name": d.get("deviceName", "Unknown"),
                "os": d.get("operatingSystem", ""),
                "os_version": d.get("osVersion", ""),
                "user": d.get("userDisplayName", ""),
                "last_sync": d.get("lastSyncDateTime"),
            })
    except Exception as e:
        logger.warning("Failed to fetch jailbroken devices: %s", e)
        errors.append({"source": "Jailbroken Devices", "error": str(e)})

    # Also fetch compliant count for summary
    compliant_count = 0
    try:
        compliant = await graph_client.get_all(
            "/deviceManagement/managedDevices",
            params={
                "$filter": "complianceState eq 'compliant'",
                "$select": "id",
                "$top": "999",
            },
        )
        compliant_count = len(compliant)
    except Exception:
        pass

    summary = {
        "noncompliant": len(results["noncompliant"]),
        "compliant": compliant_count,
        "jailbroken": len(results["jailbroken"]),
        "total_policies": len(results["policies"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
