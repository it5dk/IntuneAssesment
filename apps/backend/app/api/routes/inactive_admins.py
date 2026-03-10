import logging
from datetime import datetime, timezone
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["inactive-admins"])


def _days_since(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - dt
        return delta.days
    except Exception:
        return None


@router.get("/inactive-admins")
async def get_inactive_admins():
    """Find admin users who haven't signed in recently."""
    results: dict = {"inactive": [], "never_signed_in": [], "disabled_admins": []}
    errors: list[dict] = []

    try:
        # Fetch all directory roles and their members
        roles = await graph_client.get_all(
            "/directoryRoles",
            params={"$select": "id,displayName"},
        )

        admin_users: dict[str, dict] = {}  # user_id -> user info
        user_roles: dict[str, list[str]] = {}  # user_id -> list of role names

        for role in roles:
            role_name = role.get("displayName", "")
            role_id = role.get("id", "")
            try:
                members = await graph_client.get_all(
                    f"/directoryRoles/{role_id}/members",
                    params={"$select": "id,displayName,userPrincipalName,accountEnabled,signInActivity"},
                )
                for m in members:
                    uid = m.get("id", "")
                    if uid not in admin_users:
                        admin_users[uid] = m
                        user_roles[uid] = []
                    user_roles[uid].append(role_name)
            except Exception as e:
                logger.warning("Failed to fetch members for role %s: %s", role_name, e)

        # Now also fetch sign-in activity for each admin user
        for uid, user in admin_users.items():
            sign_in = user.get("signInActivity", {}) or {}
            last_signin = sign_in.get("lastSignInDateTime")
            last_non_interactive = sign_in.get("lastNonInteractiveSignInDateTime")

            # Use the most recent of interactive/non-interactive
            last_activity = last_signin or last_non_interactive
            if last_signin and last_non_interactive:
                last_activity = max(last_signin, last_non_interactive)

            days_inactive = _days_since(last_activity)
            enabled = user.get("accountEnabled", True)
            roles_list = user_roles.get(uid, [])

            entry = {
                "id": uid,
                "name": user.get("displayName", "Unknown"),
                "upn": user.get("userPrincipalName", ""),
                "enabled": enabled,
                "roles": roles_list,
                "last_signin": last_activity,
                "days_inactive": days_inactive,
            }

            if not enabled:
                results["disabled_admins"].append(entry)
            elif last_activity is None:
                results["never_signed_in"].append(entry)
            elif days_inactive is not None and days_inactive > 30:
                results["inactive"].append(entry)

        results["inactive"].sort(key=lambda x: x["days_inactive"] or 0, reverse=True)

    except Exception as e:
        logger.warning("Failed to fetch admin users: %s", e)
        errors.append({"source": "Admin Users", "error": str(e)})

    total_admins = len(set(
        [u["id"] for u in results["inactive"]] +
        [u["id"] for u in results["never_signed_in"]] +
        [u["id"] for u in results["disabled_admins"]]
    ))
    # Count all admin users including active ones
    all_admins = len(admin_users) if "admin_users" in dir() else total_admins

    summary = {
        "total_admins": all_admins,
        "inactive_30d": len(results["inactive"]),
        "never_signed_in": len(results["never_signed_in"]),
        "disabled_admins": len(results["disabled_admins"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
