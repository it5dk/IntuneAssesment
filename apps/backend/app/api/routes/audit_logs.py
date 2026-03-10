import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["audit-logs"])


def _parse_audit_entry(entry: dict) -> dict:
    target = {}
    targets = entry.get("targetResources", [])
    if targets:
        t = targets[0]
        target = {
            "name": t.get("displayName", ""),
            "type": t.get("type", ""),
            "id": t.get("id", ""),
        }

    initiated_by = entry.get("initiatedBy", {})
    actor = ""
    if initiated_by.get("user"):
        actor = initiated_by["user"].get("displayName") or initiated_by["user"].get("userPrincipalName", "")
    elif initiated_by.get("app"):
        actor = initiated_by["app"].get("displayName", "")

    return {
        "id": entry.get("id", ""),
        "activity": entry.get("activityDisplayName", ""),
        "category": entry.get("category", ""),
        "result": entry.get("result", ""),
        "actor": actor,
        "target": target,
        "timestamp": entry.get("activityDateTime"),
    }


@router.get("/audit-logs")
async def get_audit_logs():
    results: dict = {"directory": [], "policy": [], "device": [], "admin": []}
    errors: list[dict] = []

    # 1. Directory changes (User & Group management)
    try:
        entries = await graph_client.get_all(
            "/auditLogs/directoryAudits",
            params={
                "$filter": "category eq 'UserManagement' or category eq 'GroupManagement'",
                "$orderby": "activityDateTime desc",
                "$top": "100",
                "$select": "id,activityDisplayName,category,result,activityDateTime,initiatedBy,targetResources",
            },
        )
        results["directory"] = [_parse_audit_entry(e) for e in entries]
    except Exception as e:
        logger.warning("Failed to fetch directory audit logs: %s", e)
        errors.append({"source": "Directory Changes", "error": str(e)})

    # 2. Policy changes
    try:
        entries = await graph_client.get_all(
            "/auditLogs/directoryAudits",
            params={
                "$filter": "category eq 'Policy'",
                "$orderby": "activityDateTime desc",
                "$top": "100",
                "$select": "id,activityDisplayName,category,result,activityDateTime,initiatedBy,targetResources",
            },
        )
        results["policy"] = [_parse_audit_entry(e) for e in entries]
    except Exception as e:
        logger.warning("Failed to fetch policy audit logs: %s", e)
        errors.append({"source": "Policy Changes", "error": str(e)})

    # 3. Device actions
    try:
        entries = await graph_client.get_all(
            "/auditLogs/directoryAudits",
            params={
                "$filter": "category eq 'Device'",
                "$orderby": "activityDateTime desc",
                "$top": "100",
                "$select": "id,activityDisplayName,category,result,activityDateTime,initiatedBy,targetResources",
            },
        )
        results["device"] = [_parse_audit_entry(e) for e in entries]
    except Exception as e:
        logger.warning("Failed to fetch device audit logs: %s", e)
        errors.append({"source": "Device Actions", "error": str(e)})

    # 4. Admin / Role management activity
    try:
        entries = await graph_client.get_all(
            "/auditLogs/directoryAudits",
            params={
                "$filter": "category eq 'RoleManagement'",
                "$orderby": "activityDateTime desc",
                "$top": "100",
                "$select": "id,activityDisplayName,category,result,activityDateTime,initiatedBy,targetResources",
            },
        )
        results["admin"] = [_parse_audit_entry(e) for e in entries]
    except Exception as e:
        logger.warning("Failed to fetch admin audit logs: %s", e)
        errors.append({"source": "Admin Activity", "error": str(e)})

    summary = {
        "total_events": sum(len(v) for v in results.values()),
        "directory_changes": len(results["directory"]),
        "policy_changes": len(results["policy"]),
        "device_actions": len(results["device"]),
        "admin_activity": len(results["admin"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
