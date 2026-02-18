""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\conditional_access.py
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
    "id", "displayName", "state", "conditions", "grantControls",
    "sessionControls", "createdDateTime", "modifiedDateTime",
]


async def collect_conditional_access_policies() -> list[dict]:
    logger.info("Collecting Conditional Access Policies")
    raw = await graph_client.get_all("/identity/conditionalAccess/policies")
    items = []
    for policy in raw:
        normalized = {k: policy.get(k) for k in NORMALIZE_FIELDS if k in policy}
        items.append({
            "resource_id": policy["id"],
            "resource_type": "microsoft.graph.conditionalAccessPolicy",
            "display_name": policy.get("displayName", ""),
            "raw_json": policy,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d conditional access policies", len(items))
    return items

