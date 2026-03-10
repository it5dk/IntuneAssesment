import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["endpoint-protection"])


@router.get("/endpoint-protection")
async def get_endpoint_protection():
    results: dict = {"antivirus": [], "firewall": [], "encryption": [], "asr": []}
    errors: list[dict] = []

    # 1. Windows malware information (antivirus detections) - beta API
    try:
        malware = await graph_client.get_all(
            "https://graph.microsoft.com/beta/deviceManagement/windowsMalwareInformation",
            params={
                "$select": "id,displayName,category,severity,executionState,lastStateChangeDateTime,deviceCount",
                "$top": "100",
            },
        )
        for m in malware:
            results["antivirus"].append({
                "id": m.get("id", ""),
                "name": m.get("displayName", "Unknown"),
                "category": m.get("category", ""),
                "severity": m.get("severity", ""),
                "state": m.get("executionState", ""),
                "last_change": m.get("lastStateChangeDateTime"),
                "device_count": m.get("deviceCount", 0),
            })
    except Exception as e:
        logger.warning("Failed to fetch malware information: %s", e)
        errors.append({"source": "Antivirus / Malware", "error": str(e)})

    # 2. Device configurations for firewall policies
    try:
        configs = await graph_client.get_all(
            "/deviceManagement/deviceConfigurations",
            params={
                "$select": "id,displayName,description,lastModifiedDateTime,version",
            },
        )
        for c in configs:
            name = c.get("displayName", "").lower()
            config_entry = {
                "id": c.get("id", ""),
                "name": c.get("displayName", ""),
                "description": c.get("description", ""),
                "last_modified": c.get("lastModifiedDateTime"),
                "version": c.get("version"),
            }
            if "firewall" in name:
                results["firewall"].append(config_entry)
            elif "encrypt" in name or "bitlocker" in name or "filevault" in name:
                results["encryption"].append(config_entry)
            elif "asr" in name or "attack surface" in name:
                results["asr"].append(config_entry)
    except Exception as e:
        logger.warning("Failed to fetch device configurations: %s", e)
        errors.append({"source": "Device Configurations", "error": str(e)})

    # 3. Managed devices with encryption status
    encryption_ok = 0
    encryption_not = 0
    try:
        devices = await graph_client.get_all(
            "/deviceManagement/managedDevices",
            params={
                "$select": "id,isEncrypted",
                "$top": "999",
            },
        )
        for d in devices:
            if d.get("isEncrypted"):
                encryption_ok += 1
            else:
                encryption_not += 1
    except Exception as e:
        logger.warning("Failed to fetch device encryption status: %s", e)
        errors.append({"source": "Encryption Status", "error": str(e)})

    summary = {
        "malware_detections": len(results["antivirus"]),
        "firewall_policies": len(results["firewall"]),
        "encryption_policies": len(results["encryption"]),
        "encrypted_devices": encryption_ok,
        "unencrypted_devices": encryption_not,
        "asr_policies": len(results["asr"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
