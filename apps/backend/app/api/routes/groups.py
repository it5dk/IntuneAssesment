""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\groups.py
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

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.models.monitor import Monitor
from app.models.template import Template
from app.services.graph_client import graph_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["groups"])

GROUP_SELECT = (
    "id,displayName,description,mail,mailEnabled,mailNickname,"
    "securityEnabled,groupTypes,membershipRule,membershipRuleProcessingState,"
    "onPremisesSyncEnabled,onPremisesDomainName,onPremisesLastSyncDateTime,"
    "onPremisesSamAccountName,createdDateTime,renewedDateTime"
)


def _classify_group_type(group: dict) -> str:
    """Determine the group type from Graph properties."""
    group_types = group.get("groupTypes", []) or []
    mail_enabled = group.get("mailEnabled", False)
    security_enabled = group.get("securityEnabled", False)

    if "Unified" in group_types:
        return "Microsoft 365"
    if "DynamicMembership" in group_types and security_enabled:
        return "Dynamic Security"
    if "DynamicMembership" in group_types and mail_enabled:
        return "Dynamic Distribution"
    if security_enabled and not mail_enabled:
        return "Security"
    if mail_enabled and security_enabled:
        return "Mail-enabled Security"
    if mail_enabled and not security_enabled:
        return "Distribution"
    return "Other"


async def _get_policy_usage(db: AsyncSession) -> dict[str, list[dict]]:
    """Get policy assessment usage for groups from snapshot data.

    Returns a dict: group_id -> list of {policy_name, policy_type, intent}
    """
    usage: dict[str, list[dict]] = {}

    # --- Group policy assignments (compliance + configuration policies) ---
    monitor_q = (
        select(Monitor.id)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type == "intune.groupAssignment")
    )
    monitor_ids = (await db.execute(monitor_q)).scalars().all()

    for mid in monitor_ids:
        snap = (await db.execute(
            select(Snapshot)
            .where(Snapshot.monitor_id == mid)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )).scalars().first()
        if not snap:
            continue
        items = (await db.execute(
            select(SnapshotItem).where(SnapshotItem.snapshot_id == snap.id)
        )).scalars().all()
        for item in items:
            gid = item.resource_id
            norm = item.normalized or {}
            for a in norm.get("assignments", []):
                usage.setdefault(gid, []).append({
                    "policy_name": a.get("policy_name", ""),
                    "policy_type": a.get("policy_type", ""),
                    "intent": a.get("intent", "apply"),
                    "source": "group_policy",
                })

    # --- App assignments ---
    app_monitor_q = (
        select(Monitor.id)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type == "microsoft.graph.mobileAppAssessment")
    )
    app_monitor_ids = (await db.execute(app_monitor_q)).scalars().all()

    for mid in app_monitor_ids:
        snap = (await db.execute(
            select(Snapshot)
            .where(Snapshot.monitor_id == mid)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )).scalars().first()
        if not snap:
            continue
        items = (await db.execute(
            select(SnapshotItem).where(SnapshotItem.snapshot_id == snap.id)
        )).scalars().all()
        for item in items:
            norm = item.normalized or {}
            app_name = norm.get("displayName", item.display_name)
            for a in norm.get("assignments", []):
                target = a.get("target", {})
                gid = target.get("groupId")
                if gid:
                    usage.setdefault(gid, []).append({
                        "policy_name": app_name,
                        "policy_type": "mobileApp",
                        "intent": a.get("intent", ""),
                        "source": "app_assignment",
                    })

    # --- Conditional Access policies ---
    ca_monitor_q = (
        select(Monitor.id)
        .join(Template, Monitor.template_id == Template.id)
        .where(Template.resource_type == "microsoft.graph.conditionalAccessPolicy")
    )
    ca_monitor_ids = (await db.execute(ca_monitor_q)).scalars().all()

    for mid in ca_monitor_ids:
        snap = (await db.execute(
            select(Snapshot)
            .where(Snapshot.monitor_id == mid)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )).scalars().first()
        if not snap:
            continue
        items = (await db.execute(
            select(SnapshotItem).where(SnapshotItem.snapshot_id == snap.id)
        )).scalars().all()
        for item in items:
            raw = item.raw_json or {}
            policy_name = raw.get("displayName", item.display_name)
            # Check includeGroups and excludeGroups in conditions.users
            conditions = raw.get("conditions", {})
            users = conditions.get("users", {})
            for gid in (users.get("includeGroups", []) or []):
                usage.setdefault(gid, []).append({
                    "policy_name": policy_name,
                    "policy_type": "conditionalAccess",
                    "intent": "include",
                    "source": "conditional_access",
                })
            for gid in (users.get("excludeGroups", []) or []):
                usage.setdefault(gid, []).append({
                    "policy_name": policy_name,
                    "policy_type": "conditionalAccess",
                    "intent": "exclude",
                    "source": "conditional_access",
                })

    return usage


@router.get("")
async def list_groups(
    search: str | None = Query(None),
    group_type: str | None = Query(None),
    has_members: str | None = Query(None, description="true/false/empty - filter by member presence"),
    synced: str | None = Query(None, description="true/false - filter by on-premises sync"),
    db: AsyncSession = Depends(get_db),
):
    """List all Entra ID groups with members, type, sync status, and policy usage."""
    logger.info("Fetching groups from Graph API")

    try:
        raw_groups = await graph_client.get_all("/groups", params={"$select": GROUP_SELECT, "$top": "999"})
    except Exception as e:
        logger.error("Failed to fetch groups: %s", e)
        return {"groups": [], "total": 0, "error": str(e)[:200]}

    # Get policy usage from snapshot data
    policy_usage = await _get_policy_usage(db)

    # Fetch member counts for all groups (batch)
    groups = []
    for g in raw_groups:
        gid = g["id"]

        # Get member count
        try:
            members_resp = await graph_client.get(f"/groups/{gid}/members/$count", params={"$top": "0"})
            # $count may not work directly, fall back to listing
            member_count = members_resp if isinstance(members_resp, int) else 0
        except Exception:
            member_count = 0

        # If count didn't work, try fetching members list
        if member_count == 0:
            try:
                members_data = await graph_client.get_all(f"/groups/{gid}/members", params={"$select": "id,displayName,userPrincipalName", "$top": "999"})
                member_count = len(members_data)
                member_list = [
                    {
                        "id": m.get("id", ""),
                        "displayName": m.get("displayName", ""),
                        "userPrincipalName": m.get("userPrincipalName", ""),
                    }
                    for m in members_data[:50]  # Cap at 50 for response size
                ]
            except Exception:
                member_list = []
        else:
            member_list = []

        group_type_label = _classify_group_type(g)
        is_synced = bool(g.get("onPremisesSyncEnabled"))
        display_name = g.get("displayName", "")
        description = g.get("description", "") or ""

        # Apply filters
        if search:
            search_lower = search.lower()
            if (search_lower not in display_name.lower()
                    and search_lower not in description.lower()
                    and search_lower not in gid.lower()):
                continue

        if group_type and group_type.lower() != group_type_label.lower():
            continue

        if has_members == "true" and member_count == 0:
            continue
        if has_members == "false" and member_count > 0:
            continue

        if synced == "true" and not is_synced:
            continue
        if synced == "false" and is_synced:
            continue

        # Get policy usage for this group
        used_in = policy_usage.get(gid, [])

        groups.append({
            "id": gid,
            "displayName": display_name,
            "description": description,
            "groupType": group_type_label,
            "mailEnabled": g.get("mailEnabled", False),
            "securityEnabled": g.get("securityEnabled", False),
            "groupTypes": g.get("groupTypes", []),
            "membershipRule": g.get("membershipRule"),
            "membershipRuleProcessingState": g.get("membershipRuleProcessingState"),
            "onPremisesSyncEnabled": is_synced,
            "onPremisesDomainName": g.get("onPremisesDomainName"),
            "onPremisesLastSyncDateTime": g.get("onPremisesLastSyncDateTime"),
            "onPremisesSamAccountName": g.get("onPremisesSamAccountName"),
            "createdDateTime": g.get("createdDateTime"),
            "memberCount": member_count,
            "members": member_list,
            "usedIn": used_in,
            "usedInCount": len(used_in),
        })

    # Sort by displayName
    groups.sort(key=lambda g: (g["displayName"] or "").lower())

    # Compute summary
    type_counts: dict[str, int] = {}
    synced_count = 0
    empty_count = 0
    for g in groups:
        type_counts[g["groupType"]] = type_counts.get(g["groupType"], 0) + 1
        if g["onPremisesSyncEnabled"]:
            synced_count += 1
        if g["memberCount"] == 0:
            empty_count += 1

    return {
        "groups": groups,
        "total": len(groups),
        "summary": {
            "by_type": type_counts,
            "synced": synced_count,
            "cloud_only": len(groups) - synced_count,
            "empty_groups": empty_count,
            "with_policies": sum(1 for g in groups if g["usedInCount"] > 0),
        },
    }


