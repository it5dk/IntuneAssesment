""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\group_assignments.py
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


async def collect_group_policy_assignments() -> list[dict]:
    """Collect all policy assignments grouped by target group.

    Aggregates assignments from:
    - deviceCompliancePolicies
    - deviceConfigurations
    - configurationPolicies (Settings Catalog)

    This gives a group-centric view of what is assigned to each group.
    """
    logger.info("Collecting group policy assignments")

    # Collect assignments from compliance policies
    compliance_policies = await graph_client.get_all("/deviceManagement/deviceCompliancePolicies")
    config_policies = await graph_client.get_all("/deviceManagement/deviceConfigurations")

    group_map: dict[str, dict] = {}  # group_id -> {group_id, assignments: [...]}

    async def _collect_assignments(policies: list[dict], policy_type: str):
        for policy in policies:
            try:
                assignments = await graph_client.get_all(
                    f"/deviceManagement/{policy_type}/{policy['id']}/assignments"
                )
            except Exception:
                continue

            for a in assignments:
                target = a.get("target", {})
                group_id = target.get("groupId", "all_users_or_devices")
                target_type = target.get("@odata.type", "")

                if group_id not in group_map:
                    group_map[group_id] = {
                        "group_id": group_id,
                        "assignments": [],
                    }

                group_map[group_id]["assignments"].append({
                    "policy_id": policy["id"],
                    "policy_name": policy.get("displayName", ""),
                    "policy_type": policy_type,
                    "target_type": target_type,
                    "intent": a.get("intent", "apply"),
                })

    await _collect_assignments(compliance_policies, "deviceCompliancePolicies")
    await _collect_assignments(config_policies, "deviceConfigurations")

    items = []
    for gid, data in group_map.items():
        data["assignments"] = sorted(data["assignments"], key=lambda x: x["policy_id"])
        normalized = {
            "group_id": gid,
            "assignment_count": len(data["assignments"]),
            "assignments": data["assignments"],
        }
        items.append({
            "resource_id": gid,
            "resource_type": "intune.groupAssignment",
            "display_name": f"Group {gid[:8]}..." if len(gid) > 8 else gid,
            "raw_json": data,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })

    logger.info("Collected assignments for %d groups", len(items))
    return items


