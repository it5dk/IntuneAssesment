import logging
from datetime import datetime, timezone
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["expiring-permissions"])


def _days_until(expiry_str: str | None) -> int | None:
    if not expiry_str:
        return None
    try:
        exp = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
        delta = exp - datetime.now(timezone.utc)
        return delta.days
    except Exception:
        return None


def _status(days: int | None) -> str:
    if days is None:
        return "unknown"
    if days < 0:
        return "expired"
    if days <= 30:
        return "critical"
    if days <= 90:
        return "warning"
    return "healthy"


@router.get("/expiring-permissions")
async def get_expiring_permissions():
    """Find OAuth2 permission grants and app role assignments that may need renewal."""
    results: dict = {"oauth_grants": [], "app_role_assignments": [], "expiring_secrets": []}
    errors: list[dict] = []

    # 1. OAuth2 permission grants (delegated permissions)
    try:
        grants = await graph_client.get_all(
            "/oauth2PermissionGrants",
            params={
                "$select": "id,clientId,consentType,principalId,resourceId,scope",
                "$top": "200",
            },
        )
        for g in grants:
            expiry = g.get("expiryTime")  # may be absent in v1.0
            days = _days_until(expiry)
            results["oauth_grants"].append({
                "id": g.get("id", ""),
                "client_id": g.get("clientId", ""),
                "consent_type": g.get("consentType", ""),
                "principal_id": g.get("principalId"),
                "resource_id": g.get("resourceId", ""),
                "scope": g.get("scope", ""),
                "expires": expiry,
                "days_remaining": days,
                "status": _status(days),
            })
    except Exception as e:
        logger.warning("Failed to fetch OAuth2 permission grants: %s", e)
        errors.append({"source": "OAuth2 Grants", "error": str(e)})

    # 2. App registrations with expiring secrets/certificates
    try:
        apps = await graph_client.get_all(
            "/applications",
            params={"$select": "id,displayName,appId,passwordCredentials,keyCredentials"},
        )
        for app in apps:
            app_name = app.get("displayName", "Unknown")
            app_id = app.get("appId", "")

            for cred in app.get("passwordCredentials", []):
                end = cred.get("endDateTime")
                days = _days_until(end)
                if days is not None and days <= 90:
                    results["expiring_secrets"].append({
                        "id": cred.get("keyId", ""),
                        "app_name": app_name,
                        "app_id": app_id,
                        "type": "Client Secret",
                        "hint": cred.get("displayName") or cred.get("hint", ""),
                        "expires": end,
                        "days_remaining": days,
                        "status": _status(days),
                    })

            for cred in app.get("keyCredentials", []):
                end = cred.get("endDateTime")
                days = _days_until(end)
                if days is not None and days <= 90:
                    results["expiring_secrets"].append({
                        "id": cred.get("keyId", ""),
                        "app_name": app_name,
                        "app_id": app_id,
                        "type": "Certificate",
                        "hint": cred.get("displayName", ""),
                        "expires": end,
                        "days_remaining": days,
                        "status": _status(days),
                    })
    except Exception as e:
        logger.warning("Failed to fetch app credentials: %s", e)
        errors.append({"source": "App Credentials", "error": str(e)})

    # 3. Service principal app role assignments
    try:
        sps = await graph_client.get_all(
            "/servicePrincipals",
            params={
                "$select": "id,displayName,appRoleAssignedTo",
                "$expand": "appRoleAssignedTo($select=id,principalDisplayName,principalId,resourceDisplayName,createdDateTime)",
                "$top": "100",
            },
        )
        for sp in sps:
            for assignment in sp.get("appRoleAssignedTo", []):
                results["app_role_assignments"].append({
                    "id": assignment.get("id", ""),
                    "principal_name": assignment.get("principalDisplayName", "Unknown"),
                    "principal_id": assignment.get("principalId", ""),
                    "resource_name": sp.get("displayName", "Unknown"),
                    "created": assignment.get("createdDateTime"),
                })
    except Exception as e:
        logger.warning("Failed to fetch app role assignments: %s", e)
        errors.append({"source": "App Role Assignments", "error": str(e)})

    results["oauth_grants"].sort(key=lambda x: x["days_remaining"] if x["days_remaining"] is not None else 9999)
    results["expiring_secrets"].sort(key=lambda x: x["days_remaining"] if x["days_remaining"] is not None else 9999)

    expiring_grants = sum(1 for g in results["oauth_grants"] if g["status"] in ("expired", "critical", "warning"))
    summary = {
        "total_grants": len(results["oauth_grants"]),
        "expiring_grants": expiring_grants,
        "expiring_secrets": len(results["expiring_secrets"]),
        "app_role_assignments": len(results["app_role_assignments"]),
        "expired": sum(1 for s in results["expiring_secrets"] if s["status"] == "expired"),
        "critical": sum(1 for s in results["expiring_secrets"] if s["status"] == "critical"),
    }

    return {"data": results, "summary": summary, "errors": errors}
