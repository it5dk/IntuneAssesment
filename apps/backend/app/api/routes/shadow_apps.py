import logging
from datetime import datetime, timezone
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["shadow-apps"])


def _days_since(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - dt
        return delta.days
    except Exception:
        return None


@router.get("/shadow-apps")
async def get_shadow_apps():
    """Discover shadow apps: third-party apps with consent grants, unmanaged service principals."""
    results: dict = {"user_consented": [], "high_privilege": [], "stale_apps": []}
    errors: list[dict] = []

    # 1. OAuth2 permission grants with user consent (not admin consent)
    try:
        grants = await graph_client.get_all(
            "/oauth2PermissionGrants",
            params={
                "$filter": "consentType eq 'Principal'",
                "$select": "id,clientId,principalId,scope,consentType",
                "$top": "200",
            },
        )
        # Group by clientId
        client_grants: dict[str, dict] = {}
        for g in grants:
            cid = g.get("clientId", "")
            if cid not in client_grants:
                client_grants[cid] = {"scopes": set(), "user_count": 0, "users": set()}
            for scope in (g.get("scope", "") or "").split():
                client_grants[cid]["scopes"].add(scope)
            pid = g.get("principalId", "")
            if pid and pid not in client_grants[cid]["users"]:
                client_grants[cid]["users"].add(pid)
                client_grants[cid]["user_count"] += 1

        # Resolve client app names
        for cid, info in client_grants.items():
            try:
                sp = await graph_client.get(f"/servicePrincipals(appId='{cid}')")
                app_name = sp.get("displayName", cid) if sp else cid
            except Exception:
                app_name = cid

            results["user_consented"].append({
                "id": cid,
                "app_name": app_name,
                "user_count": info["user_count"],
                "scopes": sorted(info["scopes"]),
                "scope_count": len(info["scopes"]),
            })

        results["user_consented"].sort(key=lambda x: x["user_count"], reverse=True)
    except Exception as e:
        logger.warning("Failed to fetch user-consented apps: %s", e)
        errors.append({"source": "User Consented Apps", "error": str(e)})

    # 2. Third-party service principals with high-privilege app roles
    try:
        sps = await graph_client.get_all(
            "/servicePrincipals",
            params={
                "$filter": "tags/any(t: t eq 'WindowsAzureActiveDirectoryIntegratedApp')",
                "$select": "id,displayName,appId,appOwnerOrganizationId,publisherName,verifiedPublisher,createdDateTime",
                "$top": "200",
            },
        )
        # Check which are NOT Microsoft first-party
        ms_tenant = None
        for sp in sps:
            owner = sp.get("appOwnerOrganizationId", "")
            # Microsoft tenant IDs are well-known
            if owner and owner not in (
                "f8cdef31-a31e-4b4a-93e4-5f571e91255a",  # Microsoft
                "72f988bf-86f1-41af-91ab-2d7cd011db47",  # Microsoft Corp
            ):
                verified = sp.get("verifiedPublisher", {})
                days_old = _days_since(sp.get("createdDateTime"))
                results["high_privilege"].append({
                    "id": sp.get("id", ""),
                    "app_name": sp.get("displayName", "Unknown"),
                    "app_id": sp.get("appId", ""),
                    "publisher": sp.get("publisherName", "Unknown"),
                    "verified": bool(verified and verified.get("displayName")),
                    "owner_tenant": owner,
                    "created": sp.get("createdDateTime"),
                    "days_old": days_old,
                })
    except Exception as e:
        logger.warning("Failed to fetch third-party apps: %s", e)
        errors.append({"source": "Third-Party Apps", "error": str(e)})

    # 3. Stale apps (service principals not used recently)
    try:
        all_sps = await graph_client.get_all(
            "/servicePrincipals",
            params={
                "$select": "id,displayName,appId,createdDateTime,info",
                "$top": "200",
            },
        )
        for sp in all_sps:
            days_old = _days_since(sp.get("createdDateTime"))
            if days_old is not None and days_old > 180:
                results["stale_apps"].append({
                    "id": sp.get("id", ""),
                    "app_name": sp.get("displayName", "Unknown"),
                    "app_id": sp.get("appId", ""),
                    "created": sp.get("createdDateTime"),
                    "days_old": days_old,
                })

        results["stale_apps"].sort(key=lambda x: x["days_old"] or 0, reverse=True)
    except Exception as e:
        logger.warning("Failed to fetch stale apps: %s", e)
        errors.append({"source": "Stale Apps", "error": str(e)})

    summary = {
        "user_consented_apps": len(results["user_consented"]),
        "third_party_apps": len(results["high_privilege"]),
        "stale_apps": len(results["stale_apps"]),
        "total_shadow": len(results["user_consented"]) + len(results["high_privilege"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
