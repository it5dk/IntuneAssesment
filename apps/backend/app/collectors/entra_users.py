""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\entra_users.py
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
from app.collectors.base import stable_hash, normalize_resource

logger = logging.getLogger(__name__)

USER_SELECT = "id,displayName,userPrincipalName,accountEnabled,createdDateTime,assignedLicenses,onPremisesSyncEnabled"
NORMALIZE_FIELDS = ["id", "displayName", "userPrincipalName", "accountEnabled", "assignedLicenses", "onPremisesSyncEnabled"]


async def collect_entra_users() -> list[dict]:
    logger.info("Collecting Entra ID users")
    raw_users = await graph_client.get_all("/users", params={"$select": USER_SELECT})
    items = []
    for user in raw_users:
        normalized = normalize_resource(user, NORMALIZE_FIELDS)
        items.append({
            "resource_id": user["id"],
            "resource_type": "microsoft.graph.user",
            "display_name": user.get("displayName", ""),
            "raw_json": user,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d users", len(items))
    return items


