import logging
from app.services.graph_client import graph_client
from app.collectors.base import stable_hash, normalize_resource

logger = logging.getLogger(__name__)

GROUP_SELECT = "id,displayName,mailEnabled,securityEnabled,groupTypes,createdDateTime"
NORMALIZE_FIELDS = ["id", "displayName", "mailEnabled", "securityEnabled", "groupTypes", "members"]


async def collect_entra_groups() -> list[dict]:
    logger.info("Collecting Entra ID groups")
    raw_groups = await graph_client.get_all("/groups", params={"$select": GROUP_SELECT})

    items = []
    for group in raw_groups:
        # Fetch membership IDs
        members_data = await graph_client.get_all(f"/groups/{group['id']}/members", params={"$select": "id"})
        member_ids = sorted([m["id"] for m in members_data])

        group_with_members = {**group, "members": member_ids}
        normalized = normalize_resource(group_with_members, NORMALIZE_FIELDS)
        items.append({
            "resource_id": group["id"],
            "resource_type": "microsoft.graph.group",
            "display_name": group.get("displayName", ""),
            "raw_json": group_with_members,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d groups", len(items))
    return items
