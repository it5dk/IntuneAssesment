import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["privileged-access"])

GRAPH_BETA = "https://graph.microsoft.com/beta"


@router.get("/privileged-access")
async def get_privileged_access():
    results: dict = {"role_assignments": [], "pim_activations": [], "alerts": []}
    errors: list[dict] = []

    # 1. Directory role assignments
    try:
        roles = await graph_client.get_all(
            "/directoryRoles",
            params={"$select": "id,displayName,description"},
        )
        for role in roles:
            role_id = role.get("id", "")
            role_name = role.get("displayName", "Unknown Role")
            try:
                members = await graph_client.get_all(
                    f"/directoryRoles/{role_id}/members",
                    params={"$select": "id,displayName,userPrincipalName"},
                )
                for member in members:
                    results["role_assignments"].append({
                        "id": f"{role_id}_{member.get('id', '')}",
                        "role_name": role_name,
                        "role_id": role_id,
                        "member_name": member.get("displayName", "Unknown"),
                        "member_upn": member.get("userPrincipalName", ""),
                        "member_id": member.get("id", ""),
                    })
            except Exception as e:
                logger.warning("Failed to fetch members for role %s: %s", role_name, e)
    except Exception as e:
        logger.warning("Failed to fetch directory roles: %s", e)
        errors.append({"source": "Role Assignments", "error": str(e)})

    # 2. PIM role assignment schedule requests - use beta API
    try:
        pim_requests = await graph_client.get_all(
            f"{GRAPH_BETA}/roleManagement/directory/roleAssignmentScheduleRequests",
            params={
                "$select": "id,action,principalId,roleDefinitionId,status,createdDateTime",
                "$orderby": "createdDateTime desc",
                "$top": "50",
            },
        )
        for req in pim_requests:
            results["pim_activations"].append({
                "id": req.get("id", ""),
                "action": req.get("action", ""),
                "principal_id": req.get("principalId", ""),
                "role_definition_id": req.get("roleDefinitionId", ""),
                "status": req.get("status", ""),
                "created": req.get("createdDateTime"),
                "schedule": req.get("scheduleInfo"),
            })
    except Exception as e:
        logger.warning("Failed to fetch PIM activations: %s", e)
        errors.append({"source": "PIM Activations", "error": str(e)})

    # 3. Role eligibility schedules (standing privileged access) - use beta
    # Requires Azure AD P2 + RoleManagementPolicy.Read.All permission
    try:
        eligible = await graph_client.get_all(
            f"{GRAPH_BETA}/roleManagement/directory/roleEligibilityScheduleInstances",
            params={
                "$select": "id,principalId,roleDefinitionId,assignmentType,startDateTime",
                "$top": "100",
            },
        )
        for item in eligible:
            results["alerts"].append({
                "id": item.get("id", ""),
                "principal_id": item.get("principalId", ""),
                "role_definition_id": item.get("roleDefinitionId", ""),
                "status": item.get("assignmentType", ""),
                "created": item.get("startDateTime"),
                "type": "eligibility",
            })
    except Exception as e:
        logger.warning("Failed to fetch privileged alerts: %s", e)
        errors.append({"source": "Privileged Alerts", "error": str(e)})

    summary = {
        "total_roles": len({r["role_name"] for r in results["role_assignments"]}),
        "total_assignments": len(results["role_assignments"]),
        "active_pim": len(results["pim_activations"]),
        "alerts": len(results["alerts"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
