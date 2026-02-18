""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\devices.py
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
""" END AUTODOC HEADER

import logging
from app.services.graph_client import graph_client
from app.collectors.base import stable_hash

logger = logging.getLogger(__name__)

NORMALIZE_FIELDS = [
    "id", "deviceName", "managedDeviceOwnerType", "operatingSystem",
    "osVersion", "complianceState", "isEncrypted", "model", "manufacturer",
    "serialNumber", "userPrincipalName", "enrolledDateTime",
    "lastSyncDateTime", "managementAgent", "deviceEnrollmentType",
]


async def collect_managed_devices() -> list[dict]:
    """Collect Intune managed devices.
    GET /deviceManagement/managedDevices
    """
    logger.info("Collecting managed devices")
    raw = await graph_client.get_all(
        "/deviceManagement/managedDevices",
        params={
            "$select": ",".join(NORMALIZE_FIELDS),
        },
    )

    items = []
    for device in raw:
        normalized = {k: device.get(k) for k in NORMALIZE_FIELDS if k in device}
        items.append({
            "resource_id": device["id"],
            "resource_type": "microsoft.graph.managedDevice",
            "display_name": device.get("deviceName", ""),
            "raw_json": device,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d managed devices", len(items))
    return items

