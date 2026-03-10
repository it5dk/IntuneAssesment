import logging
from datetime import datetime, timezone
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["certificates"])


def _days_until(expiry_str: str | None) -> int | None:
    if not expiry_str:
        return None
    try:
        exp = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
        delta = exp - datetime.now(timezone.utc)
        return delta.days
    except Exception:
        return None


def _status_from_days(days: int | None) -> str:
    if days is None:
        return "unknown"
    if days < 0:
        return "expired"
    if days <= 30:
        return "critical"
    if days <= 90:
        return "warning"
    return "healthy"


@router.get("/certificates")
async def get_certificates():
    results: list[dict] = []
    errors: list[dict] = []

    # 1. App Registration secrets & certificates
    try:
        apps = await graph_client.get_all(
            "/applications",
            params={"$select": "id,displayName,appId,passwordCredentials,keyCredentials"},
        )
        for app in apps:
            app_name = app.get("displayName", "Unknown App")
            app_id = app.get("appId", app.get("id", ""))

            for cred in app.get("passwordCredentials", []):
                end = cred.get("endDateTime")
                days = _days_until(end)
                results.append({
                    "id": cred.get("keyId", ""),
                    "category": "App Registration",
                    "type": "Client Secret",
                    "name": f"{app_name}",
                    "detail": cred.get("displayName") or cred.get("hint", ""),
                    "app_id": app_id,
                    "expires": end,
                    "days_remaining": days,
                    "status": _status_from_days(days),
                })

            for cred in app.get("keyCredentials", []):
                end = cred.get("endDateTime")
                days = _days_until(end)
                results.append({
                    "id": cred.get("keyId", ""),
                    "category": "App Registration",
                    "type": "Certificate",
                    "name": f"{app_name}",
                    "detail": cred.get("displayName", ""),
                    "app_id": app_id,
                    "expires": end,
                    "days_remaining": days,
                    "status": _status_from_days(days),
                })
    except Exception as e:
        logger.warning("Failed to fetch app registrations: %s", e)
        errors.append({"source": "App Registrations", "error": str(e)})

    # 2. Apple Push Notification Certificate (APNS)
    try:
        apns = await graph_client.get("/deviceManagement/applePushNotificationCertificate")
        if apns and apns.get("expirationDateTime"):
            end = apns.get("expirationDateTime")
            days = _days_until(end)
            results.append({
                "id": "apns-cert",
                "category": "Intune",
                "type": "Apple Push (APNS)",
                "name": "Apple MDM Push Certificate",
                "detail": apns.get("appleIdentifier", ""),
                "app_id": None,
                "expires": end,
                "days_remaining": days,
                "status": _status_from_days(days),
            })
    except Exception as e:
        logger.warning("Failed to fetch APNS certificate: %s", e)
        errors.append({"source": "Apple Push Certificate", "error": str(e)})

    # 3. VPP Tokens (Apple Volume Purchase Program)
    try:
        tokens = await graph_client.get_all("/deviceAppManagement/vppTokens")
        for token in tokens:
            end = token.get("expirationDateTime")
            days = _days_until(end)
            results.append({
                "id": token.get("id", ""),
                "category": "Intune",
                "type": "VPP Token",
                "name": token.get("organizationName", "VPP Token"),
                "detail": token.get("appleId", ""),
                "app_id": None,
                "expires": end,
                "days_remaining": days,
                "status": _status_from_days(days),
            })
    except Exception as e:
        logger.warning("Failed to fetch VPP tokens: %s", e)
        errors.append({"source": "VPP Tokens", "error": str(e)})

    # 4. DEP / Apple Enrollment Program Tokens
    try:
        dep_tokens = await graph_client.get_all(
            "/deviceManagement/depOnboardingSettings"
        )
        for token in dep_tokens:
            end = token.get("tokenExpirationDateTime")
            days = _days_until(end)
            results.append({
                "id": token.get("id", ""),
                "category": "Intune",
                "type": "DEP Token",
                "name": token.get("tokenName") or token.get("appleIdentifier", "DEP Token"),
                "detail": token.get("appleIdentifier", ""),
                "app_id": None,
                "expires": end,
                "days_remaining": days,
                "status": _status_from_days(days),
            })
    except Exception as e:
        logger.warning("Failed to fetch DEP tokens: %s", e)
        errors.append({"source": "DEP Tokens", "error": str(e)})

    # 5. SAML/Federation certificates from service principals
    try:
        sps = await graph_client.get_all(
            "/servicePrincipals",
            params={
                "$filter": "preferredSingleSignOnMode eq 'saml'",
                "$select": "id,displayName,appId,keyCredentials,passwordCredentials",
            },
        )
        for sp in sps:
            sp_name = sp.get("displayName", "Unknown SP")
            for cred in sp.get("keyCredentials", []):
                end = cred.get("endDateTime")
                days = _days_until(end)
                results.append({
                    "id": cred.get("keyId", ""),
                    "category": "SAML / SSO",
                    "type": "Signing Certificate",
                    "name": sp_name,
                    "detail": cred.get("displayName", ""),
                    "app_id": sp.get("appId"),
                    "expires": end,
                    "days_remaining": days,
                    "status": _status_from_days(days),
                })
    except Exception as e:
        logger.warning("Failed to fetch SAML service principals: %s", e)
        errors.append({"source": "SAML Certificates", "error": str(e)})

    # Sort: expired first, then by days remaining
    results.sort(key=lambda x: (x["days_remaining"] if x["days_remaining"] is not None else 9999))

    summary = {
        "total": len(results),
        "expired": sum(1 for r in results if r["status"] == "expired"),
        "critical": sum(1 for r in results if r["status"] == "critical"),
        "warning": sum(1 for r in results if r["status"] == "warning"),
        "healthy": sum(1 for r in results if r["status"] == "healthy"),
    }

    return {"certificates": results, "summary": summary, "errors": errors}


@router.get("/certificates/access-policies")
async def get_access_policies():
    results: list[dict] = []
    errors: list[dict] = []

    # Fetch app registrations with their API permissions
    try:
        apps = await graph_client.get_all(
            "/applications",
            params={"$select": "id,displayName,appId,requiredResourceAccess"},
        )

        # Build a cache of resource app display names
        resource_names: dict[str, str] = {}

        for app in apps:
            app_name = app.get("displayName", "Unknown App")
            app_id = app.get("appId", app.get("id", ""))
            required = app.get("requiredResourceAccess", [])

            for resource in required:
                resource_app_id = resource.get("resourceAppId", "")

                # Resolve resource name
                if resource_app_id not in resource_names:
                    if resource_app_id == "00000003-0000-0000-c000-000000000000":
                        resource_names[resource_app_id] = "Microsoft Graph"
                    elif resource_app_id == "00000002-0000-0000-c000-000000000000":
                        resource_names[resource_app_id] = "Azure AD Graph"
                    else:
                        resource_names[resource_app_id] = resource_app_id

                resource_name = resource_names[resource_app_id]
                accesses = resource.get("resourceAccess", [])
                app_permissions = [a for a in accesses if a.get("type") == "Role"]
                delegated_permissions = [a for a in accesses if a.get("type") == "Scope"]

                results.append({
                    "id": f"{app_id}_{resource_app_id}",
                    "app_name": app_name,
                    "app_id": app_id,
                    "resource_name": resource_name,
                    "resource_app_id": resource_app_id,
                    "application_permissions": len(app_permissions),
                    "delegated_permissions": len(delegated_permissions),
                    "total_permissions": len(accesses),
                    "permission_ids": [a.get("id", "") for a in accesses],
                })
    except Exception as e:
        logger.warning("Failed to fetch access policies: %s", e)
        errors.append({"source": "Access Policies", "error": str(e)})

    results.sort(key=lambda x: x["total_permissions"], reverse=True)

    return {
        "policies": results,
        "total": len(results),
        "errors": errors,
    }
