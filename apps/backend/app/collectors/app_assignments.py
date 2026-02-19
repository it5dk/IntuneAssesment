""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\app_assignments.py
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


async def collect_app_assignments() -> list[dict]:
    """Collect Intune mobile app assignments.
    GET /deviceAppManagement/mobileApps (with assignments expanded)
    """
    logger.info("Collecting app assignments")
    # Get all mobile apps
    raw_apps = await graph_client.get_all(
        "/deviceAppManagement/mobileApps",
        params={"$select": "id,displayName,publisher,createdDateTime,lastModifiedDateTime"},
    )

    items = []
    for app in raw_apps:
        # Get assignments for each app
        try:
            assignments = await graph_client.get_all(
                f"/deviceAppManagement/mobileApps/{app['id']}/assignments"
            )
        except Exception:
            assignments = []

        assignment_data = []
        for a in assignments:
            assignment_data.append({
                "id": a.get("id"),
                "intent": a.get("intent"),  # required, available, uninstall
                "target": a.get("target", {}),
                "settings": a.get("settings"),
            })

        normalized = {
            "id": app.get("id"),
            "displayName": app.get("displayName", ""),
            "publisher": app.get("publisher", ""),
            "assignments": sorted(assignment_data, key=lambda x: x.get("id", "")),
        }

        items.append({
            "resource_id": app["id"],
            "resource_type": "microsoft.graph.mobileAppAssessment",
            "display_name": app.get("displayName", ""),
            "raw_json": {**app, "assignments": assignments},
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d app assignments", len(items))
    return items


