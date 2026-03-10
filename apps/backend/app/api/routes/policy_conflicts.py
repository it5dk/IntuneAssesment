import logging
from collections import defaultdict
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["policy-conflicts"])


@router.get("/policy-conflicts")
async def get_policy_conflicts():
    """Detect potential policy conflicts by finding overlapping assignments."""
    results: dict = {"conflicts": [], "overlaps": [], "unassigned": []}
    errors: list[dict] = []

    # Build a map: group_id -> list of policies assigned to it
    group_policies: dict[str, list[dict]] = defaultdict(list)

    # 1. Compliance policies + assignments
    try:
        policies = await graph_client.get_all(
            "/deviceManagement/deviceCompliancePolicies",
            params={"$select": "id,displayName,assignments", "$expand": "assignments"},
        )
        for p in policies:
            policy_name = p.get("displayName", "Unknown")
            for assignment in p.get("assignments", []):
                target = assignment.get("target", {})
                group_id = target.get("groupId", target.get("@odata.type", "all"))
                group_policies[group_id].append({
                    "policy_id": p.get("id", ""),
                    "policy_name": policy_name,
                    "policy_type": "Compliance",
                })
            if not p.get("assignments"):
                results["unassigned"].append({
                    "id": p.get("id", ""),
                    "name": policy_name,
                    "type": "Compliance",
                })
    except Exception as e:
        logger.warning("Failed to fetch compliance policies: %s", e)
        errors.append({"source": "Compliance Policies", "error": str(e)})

    # 2. Device configuration profiles + assignments
    try:
        configs = await graph_client.get_all(
            "/deviceManagement/deviceConfigurations",
            params={"$select": "id,displayName,assignments", "$expand": "assignments"},
        )
        for c in configs:
            config_name = c.get("displayName", "Unknown")
            for assignment in c.get("assignments", []):
                target = assignment.get("target", {})
                group_id = target.get("groupId", target.get("@odata.type", "all"))
                group_policies[group_id].append({
                    "policy_id": c.get("id", ""),
                    "policy_name": config_name,
                    "policy_type": "Configuration",
                })
            if not c.get("assignments"):
                results["unassigned"].append({
                    "id": c.get("id", ""),
                    "name": config_name,
                    "type": "Configuration",
                })
    except Exception as e:
        logger.warning("Failed to fetch device configurations: %s", e)
        errors.append({"source": "Device Configurations", "error": str(e)})

    # 3. Detect overlaps (groups with multiple policies of the same type)
    conflict_id = 0
    for group_id, policies_list in group_policies.items():
        type_groups: dict[str, list[dict]] = defaultdict(list)
        for pol in policies_list:
            type_groups[pol["policy_type"]].append(pol)

        for policy_type, pols in type_groups.items():
            if len(pols) > 1:
                conflict_id += 1
                results["conflicts"].append({
                    "id": f"conflict-{conflict_id}",
                    "group_id": group_id,
                    "policy_type": policy_type,
                    "policy_count": len(pols),
                    "policies": [{"id": p["policy_id"], "name": p["policy_name"]} for p in pols],
                    "severity": "high" if len(pols) > 3 else "medium" if len(pols) > 2 else "low",
                })

        if len(policies_list) > 1:
            results["overlaps"].append({
                "id": f"overlap-{group_id}",
                "group_id": group_id,
                "total_policies": len(policies_list),
                "by_type": {t: len(ps) for t, ps in type_groups.items()},
                "policies": [{"id": p["policy_id"], "name": p["policy_name"], "type": p["policy_type"]} for p in policies_list],
            })

    results["conflicts"].sort(key=lambda x: x["policy_count"], reverse=True)
    results["overlaps"].sort(key=lambda x: x["total_policies"], reverse=True)

    summary = {
        "total_conflicts": len(results["conflicts"]),
        "high_severity": sum(1 for c in results["conflicts"] if c["severity"] == "high"),
        "medium_severity": sum(1 for c in results["conflicts"] if c["severity"] == "medium"),
        "total_overlaps": len(results["overlaps"]),
        "unassigned_policies": len(results["unassigned"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
