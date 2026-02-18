""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\assessment_manager.py
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

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.assessment_change import AssessmentChange
from app.services.graph_client import graph_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assessment-manager", tags=["assessment-manager"])

# ── Graph path mapping ──────────────────────────────────────────────────────
COLLECTION_MAP = {
    "apps": {
        "list": "/deviceAppManagement/mobileApps",
        "select": "id,displayName,lastModifiedDateTime,notes",
        "assignments": "/deviceAppManagement/mobileApps/{id}/assignments",
        "patch": "/deviceAppManagement/mobileApps/{id}",
        "stamp_field": "notes",
    },
    "deviceConfigurations": {
        "list": "/deviceManagement/deviceConfigurations",
        "select": "id,displayName,lastModifiedDateTime,description",
        "assignments": "/deviceManagement/deviceConfigurations/{id}/assignments",
        "patch": "/deviceManagement/deviceConfigurations/{id}",
        "stamp_field": "description",
    },
    "deviceCompliancePolicies": {
        "list": "/deviceManagement/deviceCompliancePolicies",
        "select": "id,displayName,lastModifiedDateTime,description",
        "assignments": "/deviceManagement/deviceCompliancePolicies/{id}/assignments",
        "patch": "/deviceManagement/deviceCompliancePolicies/{id}",
        "stamp_field": "description",
    },
}


# ── Pydantic models ─────────────────────────────────────────────────────────
class AssessmentTarget(BaseModel):
    group_id: str
    intent: str = "required"  # required | available | uninstall | apply


class ValidateRequest(BaseModel):
    object_id: str
    collection: str
    targets: list[AssessmentTarget]


class AssignRequest(BaseModel):
    tenant_id: str
    operator_id: str
    object_id: str
    object_name: str = ""
    collection: str
    targets: list[AssessmentTarget]
    ticket_id: str | None = None
    stamp_operator: bool = False


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/objects")
async def list_objects(
    collection: str = Query(..., description="apps | deviceConfigurations | deviceCompliancePolicies"),
    search: str | None = Query(None),
):
    """List objects from Graph API for the selected collection."""
    cfg = COLLECTION_MAP.get(collection)
    if not cfg:
        return {"error": f"Unknown collection: {collection}", "objects": [], "total": 0}

    try:
        items = await graph_client.get_all(cfg["list"], params={"$select": cfg["select"], "$top": "200"})
    except Exception as e:
        logger.error("Failed to list objects for %s: %s", collection, e)
        return {"objects": [], "total": 0, "error": str(e)[:300]}

    # Apply search filter
    if search:
        search_lower = search.lower()
        items = [i for i in items if search_lower in (i.get("displayName", "") or "").lower()]

    objects = []
    for item in items:
        objects.append({
            "id": item.get("id"),
            "displayName": item.get("displayName", ""),
            "lastModifiedDateTime": item.get("lastModifiedDateTime"),
            "notes": item.get("notes"),
            "description": item.get("description"),
        })

    objects.sort(key=lambda o: (o["displayName"] or "").lower())
    return {"objects": objects, "total": len(objects)}


@router.get("/objects/{object_id}/assignments")
async def get_object_assignments(
    object_id: str,
    collection: str = Query(...),
):
    """Fetch current assignments for a specific object."""
    cfg = COLLECTION_MAP.get(collection)
    if not cfg:
        return {"error": f"Unknown collection: {collection}", "assignments": [], "total": 0}

    path = cfg["assignments"].format(id=object_id)
    try:
        raw = await graph_client.get_all(path)
    except Exception as e:
        logger.error("Failed to get assignments for %s/%s: %s", collection, object_id, e)
        return {"assignments": [], "total": 0, "error": str(e)[:300]}

    assignments = []
    for a in raw:
        target = a.get("target", {})
        assignments.append({
            "id": a.get("id"),
            "intent": a.get("intent", ""),
            "target_type": target.get("@odata.type", ""),
            "group_id": target.get("groupId"),
            "settings": a.get("settings"),
        })

    return {"assignments": assignments, "total": len(assignments)}


@router.post("/validate")
async def validate_assignment(req: ValidateRequest):
    """Pre-check: verify groups exist, detect duplicates/conflicts."""
    cfg = COLLECTION_MAP.get(req.collection)
    if not cfg:
        return {"valid": False, "error": f"Unknown collection: {req.collection}"}

    # 1. Check each target group exists
    group_checks = []
    for t in req.targets:
        try:
            g = await graph_client.get(f"/groups/{t.group_id}", params={"$select": "id,displayName"})
            group_checks.append({
                "group_id": t.group_id,
                "exists": True,
                "displayName": g.get("displayName", ""),
            })
        except Exception as e:
            err_str = str(e)
            exists = "404" not in err_str
            group_checks.append({
                "group_id": t.group_id,
                "exists": exists,
                "error": err_str[:200] if not exists else None,
            })

    # 2. Fetch current assignments to detect duplicates and conflicts
    path = cfg["assignments"].format(id=req.object_id)
    try:
        current = await graph_client.get_all(path)
    except Exception:
        current = []

    current_by_group: dict[str, str] = {}
    for a in current:
        target = a.get("target", {})
        gid = target.get("groupId")
        if gid:
            current_by_group[gid] = a.get("intent", "")

    duplicates = []
    conflicts = []
    for t in req.targets:
        if t.group_id in current_by_group:
            existing_intent = current_by_group[t.group_id]
            if existing_intent == t.intent:
                duplicates.append({
                    "group_id": t.group_id,
                    "intent": t.intent,
                    "message": f"Group already assigned with same intent '{t.intent}'",
                })
            else:
                conflicts.append({
                    "group_id": t.group_id,
                    "existing_intent": existing_intent,
                    "requested_intent": t.intent,
                    "message": f"Group already assigned with intent '{existing_intent}', requested '{t.intent}'",
                })

    missing_groups = [gc for gc in group_checks if not gc.get("exists")]
    valid = len(missing_groups) == 0 and len(conflicts) == 0

    return {
        "valid": valid,
        "group_checks": group_checks,
        "duplicates": duplicates,
        "conflicts": conflicts,
        "current_assignment_count": len(current),
    }


@router.post("/assign")
async def create_assignment(req: AssignRequest, db: AsyncSession = Depends(get_db)):
    """Create/update assignments on a Graph object and log the change."""
    cfg = COLLECTION_MAP.get(req.collection)
    if not cfg:
        return {"success": False, "error": f"Unknown collection: {req.collection}"}

    # 1. Validate first
    val_req = ValidateRequest(object_id=req.object_id, collection=req.collection, targets=req.targets)
    validation = await validate_assignment(val_req)

    if not validation["valid"]:
        return {
            "success": False,
            "error": "Validation failed",
            "conflicts": validation.get("conflicts", []),
            "group_checks": validation.get("group_checks", []),
        }

    # 2. POST assignments to Graph
    assignments_created = 0
    errors = []
    path = cfg["assignments"].format(id=req.object_id)

    for t in req.targets:
        # Skip duplicates (already assigned with same intent)
        is_dup = any(d["group_id"] == t.group_id for d in validation.get("duplicates", []))
        if is_dup:
            continue

        body = {
            "target": {
                "@odata.type": "#microsoft.graph.groupAssessmentTarget",
                "groupId": t.group_id,
            },
        }

        # Apps use intent at assessment level
        if req.collection == "apps":
            body["intent"] = t.intent

        try:
            await graph_client.post(path, json_body=body)
            assignments_created += 1
        except Exception as e:
            logger.error("Failed to create assessment for group %s: %s", t.group_id, e)
            errors.append({"group_id": t.group_id, "error": str(e)[:300]})

    # 3. Stamp operator ID if requested
    stamp_result = None
    if req.stamp_operator and assignments_created > 0:
        try:
            patch_path = cfg["patch"].format(id=req.object_id)
            field = cfg["stamp_field"]

            # Get current value
            obj = await graph_client.get(patch_path, params={"$select": f"id,{field}"})
            current_value = obj.get(field, "") or ""

            stamp_tag = f"[AssignedBy:{req.operator_id}"
            if req.ticket_id:
                stamp_tag += f"|Ticket:{req.ticket_id}"
            stamp_tag += "]"

            if stamp_tag not in current_value:
                new_value = f"{current_value}\n{stamp_tag}".strip()
                await graph_client.patch(patch_path, json_body={field: new_value})
                stamp_result = f"Stamped {field} with operator ID"
            else:
                stamp_result = "Operator stamp already present"
        except Exception as e:
            stamp_result = f"Stamp failed: {str(e)[:200]}"
            logger.error("Failed to stamp object %s: %s", req.object_id, e)

    # 4. Write audit log
    log_entry = AssessmentChange(
        tenant_id=req.tenant_id,
        operator_id=req.operator_id,
        object_id=req.object_id,
        object_name=req.object_name,
        collection=req.collection,
        action="create",
        targets=[t.model_dump() for t in req.targets],
        conflicts_detected=validation.get("conflicts"),
        stamp_result=stamp_result,
        ticket_id=req.ticket_id,
    )
    db.add(log_entry)
    await db.flush()

    return {
        "success": assignments_created > 0 or len(validation.get("duplicates", [])) > 0,
        "assignments_created": assignments_created,
        "duplicates_skipped": len(validation.get("duplicates", [])),
        "stamp_result": stamp_result,
        "conflicts": validation.get("conflicts", []),
        "errors": errors,
        "log_id": str(log_entry.id),
    }


@router.get("/logs")
async def get_assignment_logs(
    object_id: str | None = Query(None),
    operator_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve assessment change audit logs."""
    from sqlalchemy import select

    q = select(AssessmentChange).order_by(AssessmentChange.created_at.desc()).limit(limit)
    if object_id:
        q = q.where(AssessmentChange.object_id == object_id)
    if operator_id:
        q = q.where(AssessmentChange.operator_id == operator_id)

    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": str(log.id),
                "tenant_id": log.tenant_id,
                "operator_id": log.operator_id,
                "object_id": log.object_id,
                "object_name": log.object_name,
                "collection": log.collection,
                "action": log.action,
                "targets": log.targets,
                "conflicts_detected": log.conflicts_detected,
                "stamp_result": log.stamp_result,
                "ticket_id": log.ticket_id,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": len(logs),
    }

