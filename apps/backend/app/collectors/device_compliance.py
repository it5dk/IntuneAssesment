""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\device_compliance.py
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

import logging
from app.services.graph_client import graph_client
from app.collectors.base import stable_hash

logger = logging.getLogger(__name__)

NORMALIZE_FIELDS = [
    "id", "displayName", "description", "lastModifiedDateTime",
    "createdDateTime", "version", "roleScopeTagIds",
]


async def collect_device_compliance_policies() -> list[dict]:
    logger.info("Collecting Device Compliance Policies")
    raw = await graph_client.get_all("/deviceManagement/deviceCompliancePolicies")

    items = []
    for policy in raw:
        normalized = {k: policy.get(k) for k in NORMALIZE_FIELDS if k in policy}
        # Include @odata.type for platform identification
        if "@odata.type" in policy:
            normalized["platform"] = policy["@odata.type"]
        items.append({
            "resource_id": policy["id"],
            "resource_type": "microsoft.graph.deviceCompliancePolicy",
            "display_name": policy.get("displayName", ""),
            "raw_json": policy,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d device compliance policies", len(items))
    return items


