""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\zero_trust.py
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

"""
Zero Trust Identity Assessment Engine
Fetches data from 9+ Graph API endpoints in parallel, scores 7 pillars, and computes per-user risk.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query
from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/zero-trust", tags=["zero-trust"])

# ── Constants ────────────────────────────────────────────────────────────────

PILLAR_WEIGHTS = {
    "user_risk": 20,
    "mfa_coverage": 20,
    "privilege_exposure": 20,
    "ca_coverage": 15,
    "access_footprint": 10,
    "account_lifecycle": 10,
    "group_risk": 5,
}

HIGH_PRIV_SCOPES = {
    "Directory.ReadWrite.All", "Mail.ReadWrite", "Mail.Send", "Files.ReadWrite.All",
    "Sites.ReadWrite.All", "User.ReadWrite.All", "Group.ReadWrite.All",
    "RoleManagement.ReadWrite.Directory", "AppRoleAssignment.ReadWrite.All",
    "Application.ReadWrite.All", "MailboxSettings.ReadWrite",
}

CRITICAL_ADMIN_ROLES = {
    "Global Administrator", "Privileged Role Administrator",
    "Privileged Authentication Administrator", "Security Administrator",
    "Exchange Administrator", "SharePoint Administrator",
    "Conditional Access Administrator", "User Administrator",
    "Application Administrator", "Cloud Application Administrator",
}
HIGH_RISK_OAUTH_SCOPES = {
    "Directory.ReadWrite.All", "RoleManagement.ReadWrite.Directory", "AppRoleAssignment.ReadWrite.All",
    "Application.ReadWrite.All", "User.ReadWrite.All", "Group.ReadWrite.All", "Files.ReadWrite.All",
    "Sites.ReadWrite.All", "Mail.ReadWrite", "MailboxSettings.ReadWrite",
}


def _score_to_grade(score: int) -> str:
    if score <= 20:
        return "A"
    if score <= 40:
        return "B"
    if score <= 60:
        return "C"
    if score <= 80:
        return "D"
    return "F"


# ── Data Fetchers ────────────────────────────────────────────────────────────

async def _fetch_users() -> list[dict]:
    return await graph_client.get_all(
        "/users",
        params={
            "$select": "id,displayName,userPrincipalName,accountEnabled,createdDateTime,signInActivity,userType,onPremisesSyncEnabled,assignedLicenses,passwordPolicies,lastPasswordChangeDateTime",
            "$top": "999",
        },
    )


async def _fetch_risky_users() -> list[dict]:
    return await graph_client.get_all(
        "/identityProtection/riskyUsers",
        params={
            "$select": "id,userDisplayName,userPrincipalName,riskLevel,riskState,riskLastUpdatedDateTime,riskDetail",
            "$top": "500",
        },
    )


async def _fetch_risk_detections() -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        data = await graph_client.get(
            "/identityProtection/riskDetections",
            params={
                "$top": "200",
                "$orderby": "activityDateTime desc",
                "$filter": f"activityDateTime ge {cutoff}",
            },
        )
        return data.get("value", [])
    except Exception:
        # Some tenants don't support $filter on this endpoint
        data = await graph_client.get(
            "/identityProtection/riskDetections",
            params={"$top": "200", "$orderby": "activityDateTime desc"},
        )
        return data.get("value", [])


async def _fetch_ca_policies() -> list[dict]:
    return await graph_client.get_all("/identity/conditionalAccess/policies")


async def _fetch_directory_roles() -> list[dict]:
    return await graph_client.get_all(
        "/directoryRoles",
        params={"$select": "id,displayName,roleTemplateId"},
    )


async def _fetch_role_members(role_id: str) -> list[dict]:
    try:
        return await graph_client.get_all(
            f"/directoryRoles/{role_id}/members",
            params={"$select": "id,displayName,userPrincipalName"},
        )
    except Exception:
        return []


async def _fetch_directory_roles_with_members() -> list[dict]:
    roles = await _fetch_directory_roles()
    # Fetch members in parallel for all roles
    member_tasks = [_fetch_role_members(r["id"]) for r in roles]
    member_results = await asyncio.gather(*member_tasks, return_exceptions=True)
    for i, role in enumerate(roles):
        members = member_results[i] if not isinstance(member_results[i], Exception) else []
        role["members"] = members
    return roles


async def _fetch_role_assignments() -> list[dict]:
    try:
        return await graph_client.get_all(
            "/roleManagement/directory/roleAssignments",
            params={"$top": "999"},
        )
    except Exception:
        return []


async def _fetch_role_definitions() -> list[dict]:
    try:
        return await graph_client.get_all(
            "/roleManagement/directory/roleDefinitions",
            params={"$select": "id,displayName,isBuiltIn"},
        )
    except Exception:
        return []


async def _fetch_oauth_grants() -> list[dict]:
    return await graph_client.get_all(
        "/oauth2PermissionGrants",
        params={"$top": "999"},
    )


async def _fetch_service_principals() -> list[dict]:
    return await graph_client.get_all(
        "/servicePrincipals",
        params={
            "$select": "id,displayName,appId,servicePrincipalType,accountEnabled",
            "$top": "999",
        },
    )


async def _fetch_groups() -> list[dict]:
    return await graph_client.get_all(
        "/groups",
        params={
            "$select": "id,displayName,securityEnabled,groupTypes,membershipRule,mail",
            "$top": "999",
        },
    )


async def _fetch_subscribed_skus() -> list[dict]:
    try:
        return await graph_client.get_all(
            "/subscribedSkus",
            params={"$select": "skuId,skuPartNumber"},
        )
    except Exception:
        return []


# ── Pillar Scorers ───────────────────────────────────────────────────────────

def _assess_user_risk(risky_users: list[dict] | None, risk_detections: list[dict] | None, total_users: int) -> dict:
    if risky_users is None:
        return {"score": -1, "grade": "-", "available": False, "error": "IdentityRiskyUser.Read.All permission required", "summary": {}, "details": {}}

    high = [u for u in risky_users if u.get("riskLevel") == "high"]
    medium = [u for u in risky_users if u.get("riskLevel") == "medium"]
    low = [u for u in risky_users if u.get("riskLevel") == "low"]

    risk_points = len(high) * 10 + len(medium) * 5 + len(low) * 2
    score = min(100, int(risk_points / max(total_users, 1) * 100)) if total_users > 0 else 0

    detection_count = len(risk_detections) if risk_detections else 0
    if detection_count > 20:
        score = min(100, score + 15)
    elif detection_count > 10:
        score = min(100, score + 8)

    # Top risk detections for details
    top_detections = []
    if risk_detections:
        for d in risk_detections[:20]:
            top_detections.append({
                "riskEventType": d.get("riskEventType", d.get("riskType", "")),
                "riskLevel": d.get("riskLevel", ""),
                "userDisplayName": d.get("userDisplayName", ""),
                "userId": d.get("userId", ""),
                "activityDateTime": d.get("activityDateTime", ""),
                "ipAddress": d.get("ipAddress", ""),
                "location": d.get("location", {}),
            })

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "risky_users_count": len(risky_users),
            "high_risk": len(high),
            "medium_risk": len(medium),
            "low_risk": len(low),
            "recent_detections_30d": detection_count,
        },
        "details": {
            "risky_users": [
                {
                    "id": u.get("id"),
                    "displayName": u.get("userDisplayName", ""),
                    "userPrincipalName": u.get("userPrincipalName", ""),
                    "riskLevel": u.get("riskLevel"),
                    "riskState": u.get("riskState"),
                    "riskDetail": u.get("riskDetail", ""),
                    "riskLastUpdatedDateTime": u.get("riskLastUpdatedDateTime"),
                }
                for u in risky_users[:50]
            ],
            "recent_risk_detections": top_detections,
        },
    }


def _assess_mfa_coverage(users: list[dict], ca_policies: list[dict] | None) -> dict:
    if ca_policies is None:
        return {"score": -1, "grade": "-", "available": False, "error": "Policy.Read.All permission required", "summary": {}, "details": {}}

    all_user_ids = {u["id"] for u in users}
    total = len(all_user_ids)

    mfa_policies = []
    has_phishing_resistant = False

    for policy in ca_policies:
        if policy.get("state") != "enabled":
            continue
        grants = policy.get("grantControls") or {}
        built_in = grants.get("builtInControls") or []
        auth_strength = grants.get("authenticationStrength")

        requires_mfa = "mfa" in built_in
        is_phishing_resistant = False

        if auth_strength:
            allowed = auth_strength.get("allowedCombinations") or []
            phishing_methods = {"windowsHelloForBusiness", "fido2", "x509Certificate"}
            if any(m in str(allowed) for m in phishing_methods):
                is_phishing_resistant = True
                has_phishing_resistant = True
            requires_mfa = True

        if requires_mfa:
            mfa_policies.append({
                "id": policy.get("id"),
                "displayName": policy.get("displayName", ""),
                "phishing_resistant": is_phishing_resistant,
                "conditions": policy.get("conditions", {}),
            })

    # Determine covered users
    covered_users: set[str] = set()
    for mp in mfa_policies:
        user_cond = mp["conditions"].get("users") or {}
        include_users = user_cond.get("includeUsers") or []
        exclude_users = user_cond.get("excludeUsers") or []

        if "All" in include_users:
            policy_covered = all_user_ids.copy()
        else:
            policy_covered = set(include_users) & all_user_ids

        policy_covered -= set(exclude_users)
        covered_users |= policy_covered

    uncovered_count = total - len(covered_users)
    uncovered_pct = (uncovered_count / max(total, 1)) * 100

    score = int(uncovered_pct)
    if has_phishing_resistant:
        score = max(0, score - 10)
    score = min(100, score)

    # Find uncovered users
    uncovered_ids = all_user_ids - covered_users
    uncovered_users = [
        {"id": u["id"], "displayName": u.get("displayName", ""), "userPrincipalName": u.get("userPrincipalName", "")}
        for u in users if u["id"] in uncovered_ids
    ][:50]

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "users_covered_by_mfa_policy": len(covered_users),
            "users_not_covered": uncovered_count,
            "coverage_percentage": round(len(covered_users) / max(total, 1) * 100, 1),
            "mfa_policies_count": len(mfa_policies),
            "has_phishing_resistant_policy": has_phishing_resistant,
        },
        "details": {
            "uncovered_users": uncovered_users,
            "mfa_policies": [
                {"id": mp["id"], "displayName": mp["displayName"], "phishing_resistant": mp["phishing_resistant"]}
                for mp in mfa_policies
            ],
        },
    }


def _assess_ca_coverage(users: list[dict], ca_policies: list[dict] | None, groups: list[dict] | None) -> dict:
    if ca_policies is None:
        return {"score": -1, "grade": "-", "available": False, "error": "Policy.Read.All permission required", "summary": {}, "details": {}}

    total_users = len(users)
    all_user_ids = {u["id"] for u in users}
    enabled_policies = [p for p in ca_policies if p.get("state") == "enabled"]
    report_only = [p for p in ca_policies if p.get("state") == "enabledForReportingButNotEnforced"]
    disabled = [p for p in ca_policies if p.get("state") == "disabled"]

    # Track which users are covered by any enabled policy
    covered_users: set[str] = set()
    policies_with_exclusions = 0
    total_excluded_users: set[str] = set()
    all_users_targeting_count = 0

    policy_details = []
    for policy in enabled_policies:
        conditions = policy.get("conditions") or {}
        user_cond = conditions.get("users") or {}
        include_users = user_cond.get("includeUsers") or []
        exclude_users = user_cond.get("excludeUsers") or []
        exclude_groups = user_cond.get("excludeGroups") or []

        targets_all = "All" in include_users
        if targets_all:
            all_users_targeting_count += 1
            policy_covered = all_user_ids.copy()
        else:
            policy_covered = set(include_users) & all_user_ids

        excluded = set(exclude_users) & all_user_ids
        policy_covered -= excluded
        covered_users |= policy_covered

        has_exclusions = bool(exclude_users or exclude_groups)
        if has_exclusions:
            policies_with_exclusions += 1
            total_excluded_users |= excluded

        grants = policy.get("grantControls") or {}
        built_in = grants.get("builtInControls") or []

        policy_details.append({
            "id": policy.get("id"),
            "displayName": policy.get("displayName", ""),
            "targets_all_users": targets_all,
            "excluded_user_count": len(excluded),
            "excluded_group_count": len(exclude_groups),
            "controls": built_in,
        })

    uncovered_count = total_users - len(covered_users)

    # Score calculation
    gap_score = int((uncovered_count / max(total_users, 1)) * 50)
    exclusion_score = min(30, policies_with_exclusions * 5)
    policy_score = max(0, 20 - len(enabled_policies) * 2)
    score = min(100, gap_score + exclusion_score + policy_score)

    # Uncovered users
    uncovered_ids = all_user_ids - covered_users
    uncovered_users = [
        {"id": u["id"], "displayName": u.get("displayName", ""), "userPrincipalName": u.get("userPrincipalName", "")}
        for u in users if u["id"] in uncovered_ids
    ][:50]

    # Heavily excluded users (excluded from 2+ policies)
    excluded_users = [
        {"id": u["id"], "displayName": u.get("displayName", ""), "userPrincipalName": u.get("userPrincipalName", "")}
        for u in users if u["id"] in total_excluded_users
    ][:50]

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "total_policies": len(ca_policies),
            "enabled_policies": len(enabled_policies),
            "report_only_policies": len(report_only),
            "disabled_policies": len(disabled),
            "users_with_no_ca_coverage": uncovered_count,
            "policies_targeting_all_users": all_users_targeting_count,
            "policies_with_exclusions": policies_with_exclusions,
            "total_excluded_users": len(total_excluded_users),
        },
        "details": {
            "policies": policy_details[:30],
            "uncovered_users": uncovered_users,
            "excluded_users": excluded_users,
        },
    }


def _assess_privilege(
    roles_with_members: list[dict] | None,
    role_assignments: list[dict] | None,
    role_definitions: list[dict] | None,
    total_users: int,
) -> dict:
    if roles_with_members is None:
        return {"score": -1, "grade": "-", "available": False, "error": "RoleManagement.Read.All or Directory.Read.All permission required", "summary": {}, "details": {}}

    # Build role breakdown
    role_breakdown = []
    all_admin_users: dict[str, list[str]] = {}  # user_id -> list of role names
    admin_user_profile: dict[str, dict[str, str]] = {}  # user_id -> profile
    global_admin_count = 0

    for role in roles_with_members:
        name = role.get("displayName", "")
        members = role.get("members", [])
        user_members = [m for m in members if "@" in m.get("userPrincipalName", "")]

        if name == "Global Administrator":
            global_admin_count = len(user_members)

        for m in user_members:
            uid = m.get("id", "")
            if uid not in all_admin_users:
                all_admin_users[uid] = []
            if uid:
                admin_user_profile[uid] = {
                    "displayName": m.get("displayName", ""),
                    "userPrincipalName": m.get("userPrincipalName", ""),
                }
            all_admin_users[uid].append(name)

        if user_members:
            role_breakdown.append({
                "roleName": name,
                "memberCount": len(user_members),
                "isCritical": name in CRITICAL_ADMIN_ROLES,
                "members": [
                    {"id": m.get("id"), "displayName": m.get("displayName", ""), "userPrincipalName": m.get("userPrincipalName", "")}
                    for m in user_members[:20]
                ],
            })

    role_breakdown.sort(key=lambda r: (-int(r["isCritical"]), -r["memberCount"]))

    total_role_holders = len(all_admin_users)
    multi_role_users = [uid for uid, roles in all_admin_users.items() if len(roles) > 1]

    # PIM analysis from role assignments
    standing_count = 0
    eligible_count = 0
    if role_assignments:
        # Build role def map
        role_def_map = {}
        if role_definitions:
            for rd in role_definitions:
                role_def_map[rd.get("id", "")] = rd.get("displayName", "")

    # Score calculation
    score = 0
    if total_users > 0:
        admin_ratio = global_admin_count / total_users
        score += min(40, int(admin_ratio * 1000))
    if global_admin_count > 5:
        score += 20
    elif global_admin_count > 2:
        score += 10
    if total_role_holders > 20:
        score += 10
    elif total_role_holders > 10:
        score += 5
    score += min(20, len(multi_role_users) * 3)
    score = min(100, score)

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "global_admins": global_admin_count,
            "total_role_holders": total_role_holders,
            "distinct_roles_with_members": len(role_breakdown),
            "users_with_multiple_roles": len(multi_role_users),
        },
        "details": {
            "role_breakdown": role_breakdown[:20],
            "users_with_multiple_roles": [
                {
                    "userId": uid,
                    "displayName": admin_user_profile.get(uid, {}).get("displayName", ""),
                    "userPrincipalName": admin_user_profile.get(uid, {}).get("userPrincipalName", ""),
                    "roles": all_admin_users[uid],
                    "roleCount": len(all_admin_users[uid]),
                }
                for uid in multi_role_users[:30]
            ],
        },
        "_admin_user_map": all_admin_users,  # internal, used for per-user scoring
    }


def _assess_access_footprint(
    oauth_grants: list[dict] | None,
    service_principals: list[dict] | None,
) -> dict:
    if oauth_grants is None:
        return {"score": -1, "grade": "-", "available": False, "error": "Application.Read.All permission required", "summary": {}, "details": {}}

    sp_map = {}
    if service_principals:
        for sp in service_principals:
            sp_map[sp.get("id", "")] = sp.get("displayName", "")

    total_grants = len(oauth_grants)
    high_priv_grants = []
    user_consented = 0

    for grant in oauth_grants:
        scope = grant.get("scope", "") or ""
        scopes = set(scope.split())
        consent_type = grant.get("consentType", "")

        if consent_type == "Principal":
            user_consented += 1

        risky_scopes = scopes & HIGH_PRIV_SCOPES
        if risky_scopes:
            resource_id = grant.get("resourceId", "")
            high_priv_grants.append({
                "clientId": grant.get("clientId"),
                "resourceId": resource_id,
                "resourceName": sp_map.get(resource_id, resource_id),
                "consentType": consent_type,
                "risky_scopes": list(risky_scopes),
                "all_scopes": scope,
            })

    score = min(40, len(high_priv_grants) * 5)
    score += min(30, user_consented // 3)
    if total_grants > 100:
        score += 15
    elif total_grants > 50:
        score += 10
    score = min(100, score)

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "total_oauth_grants": total_grants,
            "high_privilege_grants": len(high_priv_grants),
            "user_consented_apps": user_consented,
            "service_principals_count": len(service_principals) if service_principals else 0,
        },
        "details": {
            "high_privilege_grants": high_priv_grants[:30],
        },
    }


def _assess_account_lifecycle(users: list[dict]) -> dict:
    total = len(users)
    now = datetime.now(timezone.utc)
    threshold_90d = now - timedelta(days=90)
    threshold_180d = now - timedelta(days=180)

    disabled = 0
    stale_90d = 0
    stale_180d = 0
    never_signed_in = 0
    guests = 0
    enabled_users = 0

    stale_users = []
    never_signed_in_users = []

    for u in users:
        is_enabled = u.get("accountEnabled", True)
        user_type = u.get("userType", "Member")

        if not is_enabled:
            disabled += 1
        else:
            enabled_users += 1

        if user_type == "Guest":
            guests += 1

        sign_in_activity = u.get("signInActivity") or {}
        last_sign_in = sign_in_activity.get("lastSignInDateTime")

        if last_sign_in:
            try:
                last_dt = datetime.fromisoformat(last_sign_in.replace("Z", "+00:00"))
                if last_dt < threshold_180d:
                    stale_180d += 1
                    stale_90d += 1
                    if is_enabled:
                        stale_users.append({
                            "id": u["id"],
                            "displayName": u.get("displayName", ""),
                            "userPrincipalName": u.get("userPrincipalName", ""),
                            "lastSignIn": last_sign_in,
                            "daysSinceSignIn": (now - last_dt).days,
                            "accountEnabled": is_enabled,
                        })
                elif last_dt < threshold_90d:
                    stale_90d += 1
                    if is_enabled:
                        stale_users.append({
                            "id": u["id"],
                            "displayName": u.get("displayName", ""),
                            "userPrincipalName": u.get("userPrincipalName", ""),
                            "lastSignIn": last_sign_in,
                            "daysSinceSignIn": (now - last_dt).days,
                            "accountEnabled": is_enabled,
                        })
            except (ValueError, TypeError):
                pass
        else:
            # Never signed in or signInActivity not available
            if is_enabled:
                never_signed_in += 1
                never_signed_in_users.append({
                    "id": u["id"],
                    "displayName": u.get("displayName", ""),
                    "userPrincipalName": u.get("userPrincipalName", ""),
                    "createdDateTime": u.get("createdDateTime", ""),
                    "accountEnabled": is_enabled,
                })

    # Score
    if total == 0:
        score = 0
    else:
        stale_pct = (stale_90d / total) * 100
        disabled_pct = (disabled / total) * 100
        never_pct = (never_signed_in / total) * 100
        score = int(stale_pct * 0.5 + never_pct * 0.3 + disabled_pct * 0.1)
        if guests > total * 0.3:
            score += 15
    score = min(100, score)

    stale_users.sort(key=lambda u: u.get("daysSinceSignIn", 0), reverse=True)

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "total_users": total,
            "enabled_users": enabled_users,
            "disabled_accounts": disabled,
            "stale_accounts_90d": stale_90d,
            "stale_accounts_180d": stale_180d,
            "never_signed_in": never_signed_in,
            "guest_accounts": guests,
        },
        "details": {
            "stale_users": stale_users[:50],
            "never_signed_in_users": never_signed_in_users[:50],
        },
    }


def _assess_group_risk(groups: list[dict] | None, ca_policies: list[dict] | None) -> dict:
    if groups is None:
        return {"score": -1, "grade": "-", "available": False, "error": "Group.Read.All permission required", "summary": {}, "details": {}}

    total_groups = len(groups)
    security_groups = [g for g in groups if g.get("securityEnabled")]
    dynamic_groups = [g for g in groups if "DynamicMembership" in (g.get("groupTypes") or [])]
    m365_groups = [g for g in groups if "Unified" in (g.get("groupTypes") or [])]

    # Find groups used in CA exclusions
    ca_exclusion_group_ids: set[str] = set()
    ca_inclusion_group_ids: set[str] = set()
    if ca_policies:
        for policy in ca_policies:
            if policy.get("state") != "enabled":
                continue
            conditions = policy.get("conditions") or {}
            user_cond = conditions.get("users") or {}
            exclude_groups = user_cond.get("excludeGroups") or []
            include_groups = user_cond.get("includeGroups") or []
            ca_exclusion_group_ids.update(exclude_groups)
            ca_inclusion_group_ids.update(include_groups)

    # Map group IDs to names
    group_map = {g["id"]: g.get("displayName", "") for g in groups}
    ca_exclusion_groups = [
        {"id": gid, "displayName": group_map.get(gid, gid)}
        for gid in ca_exclusion_group_ids if gid in group_map
    ]

    # Score
    score = 0
    score += min(30, len(ca_exclusion_groups) * 5)
    if total_groups > 0:
        score += min(20, int((len(m365_groups) / total_groups) * 20))
    score = min(100, score)

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "available": True,
        "error": None,
        "summary": {
            "total_groups": total_groups,
            "security_groups": len(security_groups),
            "dynamic_groups": len(dynamic_groups),
            "m365_groups": len(m365_groups),
            "groups_used_in_ca_exclusions": len(ca_exclusion_groups),
            "groups_used_in_ca_inclusions": len(ca_inclusion_group_ids & set(group_map.keys())),
        },
        "details": {
            "ca_exclusion_groups": ca_exclusion_groups,
        },
    }


# ── Per-User Risk Aggregation ────────────────────────────────────────────────

def _compute_user_risk_scores(
    users: list[dict],
    pillars: dict,
    sku_map: dict[str, str] | None = None,
) -> list[dict]:
    # Build lookup sets from pillar data
    risky_user_map: dict[str, str] = {}  # user_id -> risk_level
    if pillars.get("user_risk", {}).get("available"):
        for ru in pillars["user_risk"].get("details", {}).get("risky_users", []):
            risky_user_map[ru["id"]] = ru.get("riskLevel", "low")

    admin_user_map: dict[str, list[str]] = pillars.get("privilege_exposure", {}).get("_admin_user_map", {})

    uncovered_mfa_ids: set[str] = set()
    if pillars.get("mfa_coverage", {}).get("available"):
        for u in pillars["mfa_coverage"].get("details", {}).get("uncovered_users", []):
            uncovered_mfa_ids.add(u["id"])

    stale_ids: set[str] = set()
    if pillars.get("account_lifecycle", {}).get("available"):
        for u in pillars["account_lifecycle"].get("details", {}).get("stale_users", []):
            stale_ids.add(u["id"])

    user_scores = []
    for user in users:
        uid = user["id"]
        factors = []
        score = 0

        # Factor 1: Identity risk
        if uid in risky_user_map:
            level = risky_user_map[uid]
            if level == "high":
                score += 30
                factors.append({"pillar": "user_risk", "factor": "High risk level", "severity": "critical"})
            elif level == "medium":
                score += 15
                factors.append({"pillar": "user_risk", "factor": "Medium risk level", "severity": "high"})
            else:
                score += 5
                factors.append({"pillar": "user_risk", "factor": "Low risk level", "severity": "medium"})

        # Factor 2: Admin role
        if uid in admin_user_map:
            roles = admin_user_map[uid]
            if any(r in CRITICAL_ADMIN_ROLES for r in roles):
                score += 25
                factors.append({"pillar": "privilege_exposure", "factor": f"Critical admin: {', '.join(roles[:3])}", "severity": "high"})
            else:
                score += 10
                factors.append({"pillar": "privilege_exposure", "factor": f"Admin: {', '.join(roles[:3])}", "severity": "medium"})

        # Factor 3: MFA gap
        if uid in uncovered_mfa_ids:
            score += 20
            factors.append({"pillar": "mfa_coverage", "factor": "Not covered by MFA policy", "severity": "high"})

        # Factor 4: Stale account
        if uid in stale_ids:
            score += 15
            factors.append({"pillar": "account_lifecycle", "factor": "Stale account (90+ days inactive)", "severity": "medium"})

        # Factor 5: Disabled but has admin roles
        if not user.get("accountEnabled") and uid in admin_user_map:
            score += 20
            factors.append({"pillar": "account_lifecycle", "factor": "Disabled account with admin roles", "severity": "critical"})

        # Factor 6: Guest with access
        if user.get("userType") == "Guest":
            score += 5
            factors.append({"pillar": "access_footprint", "factor": "External guest account", "severity": "low"})

        assigned_licenses = user.get("assignedLicenses") or []
        license_names = []
        for lic in assigned_licenses:
            sku_id = str(lic.get("skuId", ""))
            if not sku_id:
                continue
            license_names.append((sku_map or {}).get(sku_id, sku_id))

        user_type = user.get("userType", "Member")
        onprem_synced = bool(user.get("onPremisesSyncEnabled", False))
        pwd_policies = str(user.get("passwordPolicies", "") or "")
        last_pwd_change = str(user.get("lastPasswordChangeDateTime", "") or "")
        sign_in_activity = user.get("signInActivity") or {}
        last_sign_in = str(sign_in_activity.get("lastSignInDateTime", "") or "")

        if user_type == "Guest":
            password_expires_on = "N/A"
            password_length_set = "N/A"
        elif onprem_synced:
            password_expires_on = "On-prem policy"
            password_length_set = "On-prem policy"
        elif "DisablePasswordExpiration" in pwd_policies:
            password_expires_on = "Never"
            password_length_set = "Strong (min 8)"
        elif last_pwd_change:
            try:
                pwd_change_dt = datetime.fromisoformat(last_pwd_change.replace("Z", "+00:00"))
                expires_dt = pwd_change_dt + timedelta(days=90)
                password_expires_on = expires_dt.isoformat()
            except Exception:
                password_expires_on = "Policy-based"
            password_length_set = "Strong (min 8)"
        else:
            password_expires_on = "Policy-based"
            password_length_set = "Strong (min 8)"

        if "DisableStrongPassword" in pwd_policies:
            password_length_set = "Weak policy"

        user_scores.append({
            "id": uid,
            "displayName": user.get("displayName", ""),
            "userPrincipalName": user.get("userPrincipalName", ""),
            "accountEnabled": user.get("accountEnabled", True),
            "userType": user_type,
            "risk_score": min(100, score),
            "risk_factors": factors,
            "created_date_time": user.get("createdDateTime", ""),
            "source": "synced" if onprem_synced else "cloud",
            "licenses": license_names,
            "password_expires_on": password_expires_on,
            "password_length_set": password_length_set,
            "last_sign_in": last_sign_in,
            "risk_factor_count": len(factors),
        })

    user_scores.sort(key=lambda u: u["risk_score"], reverse=True)
    return user_scores


# ── Permission Check ─────────────────────────────────────────────────────────

async def _check_permissions() -> list[dict]:
    checks = [
        ("User.Read.All", "/users?$top=1&$select=id"),
        ("IdentityRiskyUser.Read.All", "/identityProtection/riskyUsers?$top=1"),
        ("IdentityRiskEvent.Read.All", "/identityProtection/riskDetections?$top=1"),
        ("Policy.Read.All", "/identity/conditionalAccess/policies?$top=1"),
        ("RoleManagement.Read.All", "/directoryRoles?$top=1"),
        ("Application.Read.All", "/servicePrincipals?$top=1"),
        ("Group.Read.All", "/groups?$top=1&$select=id"),
    ]

    async def _check_one(name: str, endpoint: str) -> dict:
        try:
            await graph_client.get(endpoint)
            return {"permission": name, "status": "granted"}
        except Exception as e:
            status = "denied" if "403" in str(e) or "401" in str(e) else "error"
            return {"permission": name, "status": status}

    results = await asyncio.gather(*[_check_one(n, e) for n, e in checks])
    return list(results)


def _is_guid(value: str) -> bool:
    chunks = value.split("-")
    sizes = [8, 4, 4, 4, 12]
    if len(chunks) != 5:
        return False
    for c, s in zip(chunks, sizes):
        if len(c) != s:
            return False
        if any(ch not in "0123456789abcdefABCDEF" for ch in c):
            return False
    return True


def _as_list(data: dict | None) -> list[dict]:
    if not data:
        return []
    return data.get("value", []) if isinstance(data, dict) else []


@router.get("/user-assessment")
async def get_user_assessment(
    user_key: str = Query(..., description="User ID or UPN"),
    lookback_days: int = Query(30, ge=1, le=180),
):
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%SZ")

    # A) Resolve user
    user_select = "id,displayName,userPrincipalName,accountEnabled,createdDateTime,userType,mail,jobTitle,department,onPremisesSyncEnabled"
    user_path = f"/users/{user_key}" if _is_guid(user_key) else f"/users/{user_key}"
    user = await graph_client.get(user_path, params={"$select": user_select})
    user_id = user.get("id", "")

    # B) Group + role exposure
    group_membership: list[dict] = []
    role_assignments: list[dict] = []
    role_fallback_memberof: list[dict] = []
    role_assignment_error = None
    try:
        group_membership = await graph_client.get_all(
            f"/users/{user_id}/transitiveMemberOf",
            params={"$select": "id,displayName"},
        )
    except Exception:
        group_membership = []

    try:
        ra = await graph_client.get(
            "/roleManagement/directory/roleAssignments",
            params={
                "$filter": f"principalId eq '{user_id}'",
                "$expand": "roleDefinition($select=displayName)",
            },
        )
        role_assignments = _as_list(ra)
    except Exception as e:
        role_assignment_error = str(e)
        try:
            role_fallback_memberof = await graph_client.get_all(
                f"/users/{user_id}/memberOf",
                params={"$select": "id,displayName"},
            )
        except Exception:
            role_fallback_memberof = []

    # C) Authentication strength
    auth_methods: list[dict] = []
    auth_requirements: dict | None = None
    try:
        methods = await graph_client.get(f"/users/{user_id}/authentication/methods")
        auth_methods = _as_list(methods)
    except Exception:
        auth_methods = []
    try:
        auth_requirements = await graph_client.get(f"/users/{user_id}/authentication/requirements")
    except Exception:
        auth_requirements = None

    # D) Risk signals
    risky_users: list[dict] = []
    risky_signins: list[dict] = []
    risk_errors: list[str] = []
    try:
        ru = await graph_client.get(
            "/identityProtection/riskyUsers",
            params={"$filter": f"userId eq '{user_id}'"},
        )
        risky_users = _as_list(ru)
    except Exception as e:
        risk_errors.append(f"riskyUsers unavailable: {e}")
    try:
        rs = await graph_client.get(
            "/identityProtection/riskySignIns",
            params={"$filter": f"userId eq '{user_id}' and riskLastUpdatedDateTime ge {cutoff}"},
        )
        risky_signins = _as_list(rs)
    except Exception as e:
        risk_errors.append(f"riskySignIns unavailable: {e}")

    # E) Sign-in behavior
    sign_ins: list[dict] = []
    try:
        si = await graph_client.get(
            "/auditLogs/signIns",
            params={
                "$filter": f"userId eq '{user_id}' and createdDateTime ge {cutoff}",
                "$top": "50",
            },
        )
        sign_ins = _as_list(si)
    except Exception:
        sign_ins = []

    # F) Conditional Access coverage
    ca_policies: list[dict] = []
    applicable_policies: list[dict] = []
    excluded_policies: list[dict] = []
    try:
        ca_policies = await graph_client.get_all("/identity/conditionalAccess/policies")
        group_ids = {g.get("id", "") for g in group_membership if g.get("id")}
        for p in ca_policies:
            if p.get("state") not in {"enabled", "enabledForReportingButNotEnforced"}:
                continue
            users_cond = (p.get("conditions") or {}).get("users") or {}
            include_users = set(users_cond.get("includeUsers") or [])
            exclude_users = set(users_cond.get("excludeUsers") or [])
            include_groups = set(users_cond.get("includeGroups") or [])
            exclude_groups = set(users_cond.get("excludeGroups") or [])

            included = ("All" in include_users) or (user_id in include_users) or bool(group_ids & include_groups)
            excluded = (user_id in exclude_users) or bool(group_ids & exclude_groups)
            entry = {
                "id": p.get("id", ""),
                "displayName": p.get("displayName", ""),
                "state": p.get("state", ""),
            }
            if excluded:
                excluded_policies.append(entry)
            if included and not excluded:
                applicable_policies.append(entry)
    except Exception:
        ca_policies = []

    # G) App access + consent risk
    app_role_assignments: list[dict] = []
    oauth_grants: list[dict] = []
    try:
        ara = await graph_client.get(
            f"/users/{user_id}/appRoleAssignments",
            params={"$expand": "resource($select=displayName,appId)"},
        )
        app_role_assignments = _as_list(ara)
    except Exception:
        app_role_assignments = []
    try:
        og = await graph_client.get(
            "/oauth2PermissionGrants",
            params={"$filter": f"principalId eq '{user_id}'"},
        )
        oauth_grants = _as_list(og)
    except Exception:
        oauth_grants = []

    # Analysis
    auth_types = [str(m.get("@odata.type", "")).lower() for m in auth_methods]
    strong_hits = sum(1 for t in auth_types if any(s in t for s in ["fido2", "windowshello", "certificate"]))
    weak_hits = sum(1 for t in auth_types if any(w in t for w in ["phone", "sms", "voice"]))
    method_count = len(auth_methods)
    no_mfa_methods = method_count == 0
    only_weak_methods = method_count > 0 and strong_hits == 0 and weak_hits > 0
    excessive_method_sprawl = method_count >= 6

    auth_score = 0
    if no_mfa_methods:
        auth_score += 25
    elif only_weak_methods:
        auth_score += 18
    elif strong_hits == 0:
        auth_score += 10
    if excessive_method_sprawl:
        auth_score += 4
    auth_score = min(25, auth_score)

    success_count = sum(1 for s in sign_ins if str((s.get("status") or {}).get("errorCode", 0)) == "0")
    failure_count = max(0, len(sign_ins) - success_count)
    countries = {
        str(((s.get("location") or {}).get("countryOrRegion", "") or "")).strip()
        for s in sign_ins
        if ((s.get("location") or {}).get("countryOrRegion"))
    }
    repeated_mfa_prompts = sum(
        1 for s in sign_ins
        if "mfa" in str((s.get("status") or {}).get("failureReason", "")).lower()
    )
    risk_state_high = any((r.get("riskLevel") or "").lower() == "high" for r in risky_users)
    sign_in_risk_score = 0
    sign_in_risk_score += min(10, failure_count // 3)
    sign_in_risk_score += min(6, max(0, len(countries) - 1) * 2)
    sign_in_risk_score += min(5, repeated_mfa_prompts // 2)
    sign_in_risk_score += min(10, len(risky_signins) * 3)
    if risk_state_high:
        sign_in_risk_score += 8
    sign_in_risk_score = min(25, sign_in_risk_score)

    ca_score = 0
    if not applicable_policies:
        ca_score += 12
    ca_score += min(12, len(excluded_policies) * 3)
    ca_score = min(20, ca_score)

    privileged_role_names = []
    for ra in role_assignments:
        rd = ra.get("roleDefinition") or {}
        name = rd.get("displayName")
        if name:
            privileged_role_names.append(str(name))
    has_privileged_role = any(r in CRITICAL_ADMIN_ROLES for r in privileged_role_names)
    privilege_score = 0
    if has_privileged_role:
        privilege_score += 14
    privilege_score += min(6, max(0, len(privileged_role_names) - 1) * 2)
    privilege_score = min(20, privilege_score)

    risky_grants = []
    for g in oauth_grants:
        scopes = set(str(g.get("scope", "")).split())
        hit = list(scopes & HIGH_RISK_OAUTH_SCOPES)
        if hit:
            risky_grants.append({
                "id": g.get("id"),
                "consentType": g.get("consentType", ""),
                "scopes": hit,
            })
    consent_score = min(10, len(risky_grants) * 3 + (3 if len(oauth_grants) > 8 else 0))

    weighted_total = min(100, auth_score + sign_in_risk_score + ca_score + privilege_score + consent_score)

    latest_signin_dt = None
    for s in sign_ins:
        ts = s.get("createdDateTime")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if latest_signin_dt is None or dt > latest_signin_dt:
                latest_signin_dt = dt
        except Exception:
            continue
    stale_but_enabled = bool(
        user.get("accountEnabled", True)
        and latest_signin_dt is not None
        and latest_signin_dt < (now - timedelta(days=90))
    )
    high_risk_conditions = []
    if has_privileged_role and strong_hits == 0:
        high_risk_conditions.append("User has privileged role and lacks phishing-resistant MFA.")
    if excluded_policies:
        high_risk_conditions.append("User is excluded from one or more Conditional Access baseline policies.")
    if risk_state_high or len(risky_signins) >= 3:
        high_risk_conditions.append("User has high or repeated risky sign-in signals.")
    if risky_grants:
        high_risk_conditions.append("User has broad OAuth grants to potentially risky apps/scopes.")
    if stale_but_enabled and has_privileged_role:
        high_risk_conditions.append("Account appears stale but enabled and retains privileged exposure.")

    checklist = []
    if no_mfa_methods or only_weak_methods:
        checklist.append({"priority": "high", "action": "Enforce phishing-resistant MFA (FIDO2/WHfB/cert) and remove weak methods."})
    if excluded_policies or not applicable_policies:
        checklist.append({"priority": "high", "action": "Review and remove risky CA exclusions; ensure baseline CA applies to this user."})
    if has_privileged_role:
        checklist.append({"priority": "high", "action": "Move privileged access to JIT/PIM and require approval + alerts."})
    if risky_grants:
        checklist.append({"priority": "medium", "action": "Review OAuth grants and revoke broad/high-privilege consents."})
    if failure_count > 10 or repeated_mfa_prompts > 3:
        checklist.append({"priority": "medium", "action": "Investigate sign-in anomalies and tune policy controls."})
    if not checklist:
        checklist.append({"priority": "low", "action": "Maintain current controls and monitor weekly for drift."})

    return {
        "generated_at": now.isoformat(),
        "lookback_days": lookback_days,
        "user": {
            "id": user.get("id"),
            "displayName": user.get("displayName"),
            "userPrincipalName": user.get("userPrincipalName"),
            "accountEnabled": user.get("accountEnabled"),
            "userType": user.get("userType"),
            "department": user.get("department"),
            "jobTitle": user.get("jobTitle"),
            "onPremisesSyncEnabled": user.get("onPremisesSyncEnabled"),
        },
        "goals": [
            "Identify risky behavior and risk state for this user.",
            "Verify authentication strength and MFA coverage.",
            "Determine Conditional Access coverage and exclusions affecting this user.",
            "Identify privileged roles/admin exposure and governance risks.",
            "Identify risky app consents (OAuth) and app access paths.",
            "Produce a clear remediation checklist and a 0-100 risk score with explanation.",
        ],
        "risk_score": weighted_total,
        "pillars": {
            "authentication_strength": {"score": auth_score, "max": 25, "notes": {"methods_total": method_count, "strong_methods": strong_hits, "weak_methods": weak_hits}},
            "signin_risk_anomalies": {"score": sign_in_risk_score, "max": 25, "notes": {"successes": success_count, "failures": failure_count, "countries_seen": len(countries), "risky_signins": len(risky_signins)}},
            "conditional_access_gaps": {"score": ca_score, "max": 20, "notes": {"applicable_policies": len(applicable_policies), "excluded_policies": len(excluded_policies)}},
            "privilege_exposure": {"score": privilege_score, "max": 20, "notes": {"roles": privileged_role_names}},
            "consent_app_grants_risk": {"score": consent_score, "max": 10, "notes": {"oauth_grants": len(oauth_grants), "risky_grants": len(risky_grants)}},
        },
        "high_risk_conditions": high_risk_conditions,
        "remediation_checklist": checklist,
        "data_collection": {
            "groups_transitive_memberof_count": len(group_membership),
            "role_assignments_count": len(role_assignments),
            "role_assignment_error": role_assignment_error,
            "role_fallback_memberof_count": len(role_fallback_memberof),
            "authentication_methods_count": len(auth_methods),
            "auth_requirements_available": auth_requirements is not None,
            "risky_users_count": len(risky_users),
            "risky_signins_count": len(risky_signins),
            "risk_signal_errors": risk_errors,
            "signins_count": len(sign_ins),
            "ca_policies_total": len(ca_policies),
            "ca_applicable_count": len(applicable_policies),
            "ca_excluded_count": len(excluded_policies),
            "app_role_assignments_count": len(app_role_assignments),
            "oauth_grants_count": len(oauth_grants),
        },
        "raw_samples": {
            "applicable_policies": applicable_policies[:20],
            "excluded_policies": excluded_policies[:20],
            "risky_grants": risky_grants[:20],
            "recent_signins": sign_ins[:20],
            "risky_users": risky_users[:10],
            "risky_signins": risky_signins[:20],
            "privileged_roles": privileged_role_names,
        },
    }


# ── Main Endpoint ────────────────────────────────────────────────────────────

@router.get("/assessment")
async def get_assessment(top_users: int = Query(50, le=5000)):
    """Run a full Zero Trust identity assessment across 7 pillars."""
    start = datetime.now(timezone.utc)

    # Phase 1: Parallel data fetch
    results = await asyncio.gather(
        _fetch_users(),                         # 0
        _fetch_risky_users(),                   # 1
        _fetch_risk_detections(),               # 2
        _fetch_ca_policies(),                   # 3
        _fetch_directory_roles_with_members(),  # 4
        _fetch_role_assignments(),              # 5
        _fetch_role_definitions(),              # 6
        _fetch_oauth_grants(),                  # 7
        _fetch_service_principals(),            # 8
        _fetch_groups(),                        # 9
        _fetch_subscribed_skus(),               # 10
        return_exceptions=True,
    )

    def _safe(idx: int) -> list[dict] | None:
        r = results[idx]
        if isinstance(r, Exception):
            logger.warning("Zero Trust fetch %d failed: %s", idx, r)
            return None
        return r

    users = _safe(0) or []
    risky_users = _safe(1)
    risk_detections = _safe(2)
    ca_policies = _safe(3)
    roles_with_members = _safe(4)
    role_assignments = _safe(5)
    role_definitions = _safe(6)
    oauth_grants = _safe(7)
    service_principals = _safe(8)
    groups = _safe(9)
    subscribed_skus = _safe(10) or []

    sku_map = {}
    for sku in subscribed_skus:
        sku_id = str(sku.get("skuId", ""))
        sku_part = str(sku.get("skuPartNumber", ""))
        if sku_id:
            sku_map[sku_id] = sku_part or sku_id

    total_users = len(users)

    # Phase 2: Score each pillar
    pillars = {}
    pillars["user_risk"] = _assess_user_risk(risky_users, risk_detections, total_users)
    pillars["mfa_coverage"] = _assess_mfa_coverage(users, ca_policies)
    pillars["ca_coverage"] = _assess_ca_coverage(users, ca_policies, groups)
    pillars["privilege_exposure"] = _assess_privilege(roles_with_members, role_assignments, role_definitions, total_users)
    pillars["access_footprint"] = _assess_access_footprint(oauth_grants, service_principals)
    pillars["account_lifecycle"] = _assess_account_lifecycle(users)
    pillars["group_risk"] = _assess_group_risk(groups, ca_policies)

    # Phase 3: Composite score
    available_pillars = {k: v for k, v in pillars.items() if v.get("available")}
    total_weight = sum(PILLAR_WEIGHTS.get(k, 0) for k in available_pillars)
    if total_weight > 0:
        composite = sum(v["score"] * PILLAR_WEIGHTS.get(k, 0) for k, v in available_pillars.items()) // total_weight
    else:
        composite = -1

    # Phase 4: Per-user risk ranking
    top_risk_users = _compute_user_risk_scores(users, pillars, sku_map)[:top_users]

    # Phase 5: Permission status
    perm_checks = await _check_permissions()
    missing = [c["permission"] for c in perm_checks if c["status"] != "granted"]

    # Clean internal keys from pillar data
    for p in pillars.values():
        p.pop("_admin_user_map", None)

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()

    return {
        "assessment_time": start.isoformat(),
        "assessment_duration_seconds": round(elapsed, 1),
        "tenant_user_count": total_users,
        "composite_score": composite,
        "composite_grade": _score_to_grade(composite) if composite >= 0 else "-",
        "pillars": pillars,
        "top_risk_users": top_risk_users,
        "permissions_status": {
            "all_granted": len(missing) == 0,
            "missing": missing,
            "checks": perm_checks,
        },
    }


