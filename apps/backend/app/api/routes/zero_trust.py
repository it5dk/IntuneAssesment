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
            "$select": "id,displayName,userPrincipalName,accountEnabled,createdDateTime,signInActivity,userType",
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
                {"userId": uid, "roles": all_admin_users[uid], "roleCount": len(all_admin_users[uid])}
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

        if factors:
            user_scores.append({
                "id": uid,
                "displayName": user.get("displayName", ""),
                "userPrincipalName": user.get("userPrincipalName", ""),
                "accountEnabled": user.get("accountEnabled", True),
                "userType": user.get("userType", "Member"),
                "risk_score": min(100, score),
                "risk_factors": factors,
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


# ── Main Endpoint ────────────────────────────────────────────────────────────

@router.get("/assessment")
async def get_assessment(top_users: int = Query(50, le=200)):
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
    top_risk_users = _compute_user_risk_scores(users, pillars)[:top_users]

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
