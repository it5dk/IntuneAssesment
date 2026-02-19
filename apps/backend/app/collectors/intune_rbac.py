""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\intune_rbac.py
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


async def collect_intune_role_assignments() -> list[dict]:
    """Collect Intune RBAC role assignments from deviceManagement.

    Endpoints used:
    - GET /deviceManagement/roleDefinitions
    - GET /deviceManagement/roleAssignments
    """
    logger.info("Collecting Intune RBAC role assignments")

    # Collect role definitions for context
    role_defs = await graph_client.get_all("/deviceManagement/roleDefinitions")
    role_def_map = {rd["id"]: rd.get("displayName", "") for rd in role_defs}

    # Collect role assignments
    assignments = await graph_client.get_all("/deviceManagement/roleAssignments")

    items = []
    for ra in assignments:
        normalized = {
            "id": ra.get("id"),
            "displayName": ra.get("displayName", ""),
            "roleDefinitionId": ra.get("roleDefinition", {}).get("id") if isinstance(ra.get("roleDefinition"), dict) else ra.get("roleDefinitionId"),
            "roleDefinitionName": role_def_map.get(
                ra.get("roleDefinition", {}).get("id") if isinstance(ra.get("roleDefinition"), dict) else ra.get("roleDefinitionId", ""),
                ""
            ),
            "resourceScopes": sorted(ra.get("resourceScopes", [])),
        }
        items.append({
            "resource_id": ra["id"],
            "resource_type": "intune.rbac.roleAssignment",
            "display_name": ra.get("displayName", ""),
            "raw_json": ra,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d Intune role assignments", len(items))
    return items


