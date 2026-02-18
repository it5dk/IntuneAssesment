import logging
from app.services.graph_client import graph_client
from app.collectors.base import stable_hash

logger = logging.getLogger(__name__)


async def collect_device_configurations() -> list[dict]:
    """Collect Intune device configuration profiles.
    GET /deviceManagement/deviceConfigurations
    """
    logger.info("Collecting device configuration profiles")
    raw = await graph_client.get_all("/deviceManagement/deviceConfigurations")

    items = []
    for profile in raw:
        normalized = {
            "id": profile.get("id"),
            "displayName": profile.get("displayName", ""),
            "description": profile.get("description", ""),
            "platform": profile.get("@odata.type", ""),
            "lastModifiedDateTime": profile.get("lastModifiedDateTime"),
            "version": profile.get("version"),
            "roleScopeTagIds": profile.get("roleScopeTagIds", []),
        }
        items.append({
            "resource_id": profile["id"],
            "resource_type": "microsoft.graph.deviceConfiguration",
            "display_name": profile.get("displayName", ""),
            "raw_json": profile,
            "normalized": normalized,
            "hash": stable_hash(normalized),
        })
    logger.info("Collected %d device configuration profiles", len(items))
    return items
