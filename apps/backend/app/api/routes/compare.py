""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\compare.py
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

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
import json
from app.core.database import get_db
from app.models.snapshot import Snapshot
from app.models.snapshot_item import SnapshotItem
from app.services.drift_engine import _diff_dicts

router = APIRouter(prefix="/compare", tags=["compare"])


class CompareRequest(BaseModel):
    snapshot_a_id: UUID
    snapshot_b_id: UUID
    resource_id: str | None = None  # Optional: compare specific resource


class TenantConnection(BaseModel):
    tenant_id: str
    client_id: str
    client_secret: str
    label: str | None = None


class CompareTenantsRequest(BaseModel):
    tenant_a: TenantConnection
    tenant_b: TenantConnection


TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_BASE_V1 = "https://graph.microsoft.com/v1.0"
GRAPH_BASE_BETA = "https://graph.microsoft.com/beta"
TENANT_COMPARE_REQUIRED_PERMISSIONS = [
    "Policy.Read.ConditionalAccess",
    "Policy.Read.All",
    "Organization.Read.All",
    "DeviceManagementConfiguration.Read.All",
    "DeviceManagementApps.Read.All",
]
TENANT_POLICY_SOURCES = [
    {
        "policy_type": "Conditional Access",
        "resource_type": "microsoft.graph.conditionalAccessPolicy",
        "paths": [
            f"{GRAPH_BASE_V1}/identity/conditionalAccess/policies?$select=id,displayName,state,conditions,grantControls,sessionControls",
        ],
    },
    {
        "policy_type": "Intune Device Configuration",
        "resource_type": "microsoft.graph.deviceConfiguration",
        "paths": [
            f"{GRAPH_BASE_V1}/deviceManagement/deviceConfigurations?$select=id,displayName,description,lastModifiedDateTime",
            f"{GRAPH_BASE_BETA}/deviceManagement/deviceConfigurations?$select=id,displayName,description,lastModifiedDateTime",
        ],
    },
    {
        "policy_type": "Intune Compliance",
        "resource_type": "microsoft.graph.deviceCompliancePolicy",
        "paths": [
            f"{GRAPH_BASE_V1}/deviceManagement/deviceCompliancePolicies?$select=id,displayName,description,lastModifiedDateTime",
            f"{GRAPH_BASE_BETA}/deviceManagement/deviceCompliancePolicies?$select=id,displayName,description,lastModifiedDateTime",
        ],
    },
    {
        "policy_type": "Settings Catalog",
        "resource_type": "microsoft.graph.deviceManagementConfigurationPolicy",
        "paths": [
            f"{GRAPH_BASE_V1}/deviceManagement/configurationPolicies?$select=id,name,description,lastModifiedDateTime,platforms,technologies",
            f"{GRAPH_BASE_BETA}/deviceManagement/configurationPolicies?$select=id,name,description,lastModifiedDateTime,platforms,technologies",
        ],
    },
    {
        "policy_type": "Group Policy Configuration",
        "resource_type": "microsoft.graph.groupPolicyConfiguration",
        "paths": [
            f"{GRAPH_BASE_V1}/deviceManagement/groupPolicyConfigurations?$select=id,displayName,description,lastModifiedDateTime",
            f"{GRAPH_BASE_BETA}/deviceManagement/groupPolicyConfigurations?$select=id,displayName,description,lastModifiedDateTime",
        ],
    },
    {
        "policy_type": "App Configuration",
        "resource_type": "microsoft.graph.managedDeviceMobileAppConfiguration",
        "paths": [
            f"{GRAPH_BASE_V1}/deviceAppManagement/mobileAppConfigurations?$select=id,displayName,description,lastModifiedDateTime",
            f"{GRAPH_BASE_BETA}/deviceAppManagement/mobileAppConfigurations?$select=id,displayName,description,lastModifiedDateTime",
        ],
    },
]


async def _get_token(client: httpx.AsyncClient, conn: TenantConnection) -> str:
    resp = await client.post(
        TOKEN_URL.format(tenant=conn.tenant_id),
        data={
            "grant_type": "client_credentials",
            "client_id": conn.client_id,
            "client_secret": conn.client_secret,
            "scope": "https://graph.microsoft.com/.default",
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    body = resp.json()
    return body["access_token"]


async def _graph_get_all(client: httpx.AsyncClient, token: str, url: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"}
    out: list[dict] = []
    while url:
        resp = await client.get(url, headers=headers, timeout=30.0)
        resp.raise_for_status()
        body = resp.json()
        out.extend(body.get("value", []))
        url = body.get("@odata.nextLink")
    return out


async def _graph_get_one(client: httpx.AsyncClient, token: str, path: str) -> dict:
    url = f"{GRAPH_BASE_V1}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(url, headers=headers, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def _normalize_policy(policy: dict) -> dict:
    ignore_keys = {
        "id",
        "displayName",
        "name",
        "description",
        "createdDateTime",
        "modifiedDateTime",
        "lastModifiedDateTime",
        "version",
        "supportsScopeTags",
        "roleScopeTagIds",
        "isAssigned",
    }

    def _sanitize(value):
        if isinstance(value, dict):
            out = {}
            for k, v in value.items():
                if k in ignore_keys or str(k).startswith("@odata."):
                    continue
                out[k] = _sanitize(v)
            return out
        if isinstance(value, list):
            return [_sanitize(v) for v in value]
        return value

    return _sanitize(dict(policy))


def _policy_key(policy: dict) -> str:
    name = str(policy.get("displayName") or policy.get("name") or "").strip().lower()
    if name:
        return name
    return str(policy.get("id") or "")


def _policy_display_name(policy: dict) -> str:
    return str(policy.get("displayName") or policy.get("name") or policy.get("id") or "Unnamed policy")


def _group_by_key(policies: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for policy in policies:
        grouped.setdefault(_policy_key(policy), []).append(policy)
    return grouped


def _format_http_error(e: httpx.HTTPStatusError) -> str:
    status = e.response.status_code if e.response else "unknown"
    endpoint = str(e.request.url) if e.request else "unknown"
    body = ""
    if e.response is not None:
        text = e.response.text.strip().replace("\n", " ")
        if text:
            body = f" Response: {text[:220]}"
    return f"HTTP {status} on {endpoint}.{body}"


async def _graph_get_one_url(client: httpx.AsyncClient, token: str, url: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(url, headers=headers, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


async def _enrich_policy_details(client: httpx.AsyncClient, token: str, list_url: str, policies: list[dict]) -> list[dict]:
    base_url = list_url.split("?")[0]
    out: list[dict] = []
    for policy in policies:
        pid = policy.get("id")
        if not pid:
            out.append(policy)
            continue
        detail_url = f"{base_url}/{pid}"
        try:
            detail = await _graph_get_one_url(client, token, detail_url)
        except Exception:
            detail = policy

        if "/configurationPolicies" in base_url:
            try:
                detail["_settings"] = await _graph_get_all(client, token, f"{detail_url}/settings")
            except Exception:
                pass
        if "/groupPolicyConfigurations" in base_url:
            try:
                detail["_definitionValues"] = await _graph_get_all(client, token, f"{detail_url}/definitionValues")
            except Exception:
                pass

        out.append(detail)
    return out


def _flatten_settings(value, prefix: str = "", out: dict[str, str] | None = None) -> dict[str, str]:
    if out is None:
        out = {}
    if isinstance(value, dict):
        for key, child in value.items():
            child_key = f"{prefix}.{key}" if prefix else str(key)
            _flatten_settings(child, child_key, out)
    elif isinstance(value, list):
        for idx, child in enumerate(value):
            child_key = f"{prefix}[{idx}]"
            _flatten_settings(child, child_key, out)
    else:
        out[prefix or "$"] = json.dumps(value, sort_keys=True, default=str)
    return out


def _ui_policy_payload(entry: dict) -> dict | None:
    raw = entry.get("raw")
    if isinstance(raw, dict) and len(raw) > 0:
        return raw
    normalized = entry.get("normalized")
    if isinstance(normalized, dict) and len(normalized) > 0:
        return normalized
    return raw if isinstance(raw, dict) else None


def _compare_flat_settings(flat_a: dict[str, str], flat_b: dict[str, str]) -> dict:
    keys_a = set(flat_a.keys())
    keys_b = set(flat_b.keys())
    shared = keys_a & keys_b
    only_a = keys_a - keys_b
    only_b = keys_b - keys_a

    same_paths: list[str] = []
    different_paths: list[dict] = []
    for key in sorted(shared):
        if flat_a.get(key) == flat_b.get(key):
            same_paths.append(key)
        else:
            different_paths.append({"path": key, "tenant_a_value": flat_a.get(key), "tenant_b_value": flat_b.get(key)})

    return {
        "shared_settings_count": len(shared),
        "same_settings_count": len(same_paths),
        "different_values_count": len(different_paths),
        "only_in_tenant_a_count": len(only_a),
        "only_in_tenant_b_count": len(only_b),
        "sample_same_paths": same_paths[:8],
        "sample_different_paths": different_paths[:8],
        "sample_only_in_tenant_a_paths": sorted(list(only_a))[:8],
        "sample_only_in_tenant_b_paths": sorted(list(only_b))[:8],
    }


@router.post("")
async def compare_snapshots(req: CompareRequest, db: AsyncSession = Depends(get_db)):
    """Compare two snapshots side-by-side. Returns identical, modified, added, removed items."""
    snap_a = await db.get(Snapshot, req.snapshot_a_id)
    snap_b = await db.get(Snapshot, req.snapshot_b_id)
    if not snap_a or not snap_b:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    items_a_q = select(SnapshotItem).where(SnapshotItem.snapshot_id == req.snapshot_a_id)
    items_b_q = select(SnapshotItem).where(SnapshotItem.snapshot_id == req.snapshot_b_id)

    if req.resource_id:
        items_a_q = items_a_q.where(SnapshotItem.resource_id == req.resource_id)
        items_b_q = items_b_q.where(SnapshotItem.resource_id == req.resource_id)

    items_a = (await db.execute(items_a_q)).scalars().all()
    items_b = (await db.execute(items_b_q)).scalars().all()

    map_a = {i.resource_id: i for i in items_a}
    map_b = {i.resource_id: i for i in items_b}

    all_ids = set(list(map_a.keys()) + list(map_b.keys()))

    identical = []
    modified = []
    added = []
    removed = []

    for rid in sorted(all_ids):
        a = map_a.get(rid)
        b = map_b.get(rid)

        if a and not b:
            removed.append({
                "resource_id": rid,
                "display_name": a.display_name,
                "resource_type": a.resource_type,
                "snapshot": "a",
                "data": a.normalized,
            })
        elif b and not a:
            added.append({
                "resource_id": rid,
                "display_name": b.display_name,
                "resource_type": b.resource_type,
                "snapshot": "b",
                "data": b.normalized,
            })
        elif a.hash == b.hash:
            identical.append({
                "resource_id": rid,
                "display_name": a.display_name,
                "resource_type": a.resource_type,
            })
        else:
            diffs = _diff_dicts(a.normalized, b.normalized)
            modified.append({
                "resource_id": rid,
                "display_name": a.display_name,
                "resource_type": a.resource_type,
                "changes": diffs,
                "data_a": a.normalized,
                "data_b": b.normalized,
            })

    return {
        "snapshot_a": {"id": str(snap_a.id), "created_at": snap_a.created_at.isoformat(), "resource_count": snap_a.resource_count},
        "snapshot_b": {"id": str(snap_b.id), "created_at": snap_b.created_at.isoformat(), "resource_count": snap_b.resource_count},
        "summary": {
            "identical": len(identical),
            "modified": len(modified),
            "added": len(added),
            "removed": len(removed),
            "total_settings_analyzed": sum(len(m.get("changes", [])) for m in modified) + len(identical),
        },
        "identical": identical,
        "modified": modified,
        "added": added,
        "removed": removed,
    }


@router.post("/tenants")
async def compare_tenants(req: CompareTenantsRequest):
    """Compare policy coverage across two tenants for multiple policy types."""
    async with httpx.AsyncClient() as client:
        try:
            token_a = await _get_token(client, req.tenant_a)
            token_b = await _get_token(client, req.tenant_b)
        except httpx.HTTPStatusError as e:
            endpoint = str(e.request.url) if e.request else "unknown"
            detail = (
                "Unable to authenticate one or both tenants. "
                "Validate tenant/client credentials and grant admin consent for: "
                + ", ".join(TENANT_COMPARE_REQUIRED_PERMISSIONS)
                + f". Failing endpoint: {endpoint}"
            )
            raise HTTPException(status_code=400, detail=detail) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Tenant comparison failed: {str(e)}") from e

        name_a = req.tenant_a.label or req.tenant_a.tenant_id
        name_b = req.tenant_b.label or req.tenant_b.tenant_id
        try:
            org_a = await _graph_get_one(client, token_a, "/organization?$select=id,displayName")
            if org_a.get("value"):
                name_a = req.tenant_a.label or org_a["value"][0].get("displayName") or req.tenant_a.tenant_id
        except Exception:
            pass
        try:
            org_b = await _graph_get_one(client, token_b, "/organization?$select=id,displayName")
            if org_b.get("value"):
                name_b = req.tenant_b.label or org_b["value"][0].get("displayName") or req.tenant_b.tenant_id
        except Exception:
            pass

    policy_items = []
    policy_type_summary = []
    identical = []
    modified = []
    added = []
    removed = []
    source_errors = []
    tenant_a_resource_total = 0
    tenant_b_resource_total = 0

    async with httpx.AsyncClient() as client:
        for source in TENANT_POLICY_SOURCES:
            policy_type = source["policy_type"]
            resource_type = source["resource_type"]
            paths = source["paths"]
            policies_a: list[dict] = []
            policies_b: list[dict] = []
            read_ok = False
            last_error = ""
            selected_url = ""
            for url in paths:
                try:
                    policies_a = await _graph_get_all(client, token_a, url)
                    policies_b = await _graph_get_all(client, token_b, url)
                    read_ok = True
                    selected_url = url
                    break
                except httpx.HTTPStatusError as e:
                    last_error = _format_http_error(e)
                except Exception as e:
                    last_error = str(e)
            if not read_ok:
                source_errors.append(
                    {
                        "policy_type": policy_type,
                        "error": f"Failed to read this policy type. {last_error}",
                    }
                )
                continue

            policies_a = await _enrich_policy_details(client, token_a, selected_url, policies_a)
            policies_b = await _enrich_policy_details(client, token_b, selected_url, policies_b)

            tenant_a_resource_total += len(policies_a)
            tenant_b_resource_total += len(policies_b)

            norm_a = []
            for p in policies_a:
                normalized = _normalize_policy(p)
                norm_a.append(
                    {
                        "id": str(p.get("id") or ""),
                        "name": _policy_display_name(p),
                        "raw": p,
                        "normalized": normalized,
                        "flat": _flatten_settings(normalized),
                    }
                )
            norm_b = []
            for p in policies_b:
                normalized = _normalize_policy(p)
                norm_b.append(
                    {
                        "id": str(p.get("id") or ""),
                        "name": _policy_display_name(p),
                        "raw": p,
                        "normalized": normalized,
                        "flat": _flatten_settings(normalized),
                    }
                )

            type_counts = {"match": 0, "not_match": 0, "duplicate": 0}

            def _best_cross_tenant_match(source_group: list[dict], other_policies: list[dict]):
                if not source_group or not other_policies:
                    return None
                source = source_group[0]
                best = None
                best_score = -10**9
                for candidate in other_policies:
                    cmp = _compare_flat_settings(source["flat"], candidate["flat"])
                    if cmp["shared_settings_count"] == 0:
                        continue
                    score = (
                        cmp["same_settings_count"] * 10
                        - cmp["different_values_count"] * 3
                        - cmp["only_in_tenant_a_count"]
                        - cmp["only_in_tenant_b_count"]
                    )
                    if score > best_score:
                        best_score = score
                        best = (candidate, cmp)
                return best

            # Duplicate settings inside same tenant (same fingerprint)
            fp_map_a: dict[str, list[dict]] = {}
            fp_map_b: dict[str, list[dict]] = {}
            for p in norm_a:
                fp_map_a.setdefault(json.dumps(p["flat"], sort_keys=True), []).append(p)
            for p in norm_b:
                fp_map_b.setdefault(json.dumps(p["flat"], sort_keys=True), []).append(p)
            for fp, group in fp_map_a.items():
                if len(group) > 1:
                    type_counts["duplicate"] += 1
                    best_other = _best_cross_tenant_match(group, norm_b)
                    group_payload = {
                        "_duplicateCount": len(group),
                        "_policies": [_ui_policy_payload(g) for g in group if _ui_policy_payload(g) is not None],
                    }
                    policy_items.append(
                        {
                            "policy_type": policy_type,
                            "resource_type": resource_type,
                            "policy_name": " / ".join(g["name"] for g in group[:3]),
                            "policy_key": f"dup-a:{fp[:24]}",
                            "status": "duplicate",
                            "sub_status": "duplicate_settings",
                            "reason": (
                                f"{len(group)} policies in tenant A have identical settings."
                                + (" Best match found in tenant B for side-by-side detail." if best_other else "")
                            ),
                            "tenant_a_policy_name": " / ".join(g["name"] for g in group[:3]),
                            "tenant_b_policy_name": best_other[0]["name"] if best_other else "",
                            "tenant_a_count": len(group),
                            "tenant_b_count": 1 if best_other else 0,
                            "tenant_a_ids": [g["id"] for g in group if g["id"]],
                            "tenant_b_ids": [best_other[0]["id"]] if best_other and best_other[0]["id"] else [],
                            "tenant_a_data": group_payload if group_payload["_policies"] else (_ui_policy_payload(group[0]) if group else None),
                            "tenant_b_data": _ui_policy_payload(best_other[0]) if best_other else None,
                            "comparison": best_other[1] if best_other else None,
                        }
                    )
            for fp, group in fp_map_b.items():
                if len(group) > 1:
                    type_counts["duplicate"] += 1
                    best_other = _best_cross_tenant_match(group, norm_a)
                    group_payload = {
                        "_duplicateCount": len(group),
                        "_policies": [_ui_policy_payload(g) for g in group if _ui_policy_payload(g) is not None],
                    }
                    policy_items.append(
                        {
                            "policy_type": policy_type,
                            "resource_type": resource_type,
                            "policy_name": " / ".join(g["name"] for g in group[:3]),
                            "policy_key": f"dup-b:{fp[:24]}",
                            "status": "duplicate",
                            "sub_status": "duplicate_settings",
                            "reason": (
                                f"{len(group)} policies in tenant B have identical settings."
                                + (" Best match found in tenant A for side-by-side detail." if best_other else "")
                            ),
                            "tenant_a_policy_name": best_other[0]["name"] if best_other else "",
                            "tenant_b_policy_name": " / ".join(g["name"] for g in group[:3]),
                            "tenant_a_count": 1 if best_other else 0,
                            "tenant_b_count": len(group),
                            "tenant_a_ids": [best_other[0]["id"]] if best_other and best_other[0]["id"] else [],
                            "tenant_b_ids": [g["id"] for g in group if g["id"]],
                            "tenant_a_data": _ui_policy_payload(best_other[0]) if best_other else None,
                            "tenant_b_data": group_payload if group_payload["_policies"] else (_ui_policy_payload(group[0]) if group else None),
                            "comparison": best_other[1] if best_other else None,
                        }
                    )

            # Match policies by settings similarity (not by name)
            candidates = []
            for idx_a, a in enumerate(norm_a):
                for idx_b, b in enumerate(norm_b):
                    cmp = _compare_flat_settings(a["flat"], b["flat"])
                    if cmp["shared_settings_count"] == 0:
                        continue
                    score = (
                        cmp["same_settings_count"] * 10
                        - cmp["different_values_count"] * 3
                        - cmp["only_in_tenant_a_count"]
                        - cmp["only_in_tenant_b_count"]
                    )
                    candidates.append((score, cmp["same_settings_count"], idx_a, idx_b, cmp))

            candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
            matched_a: set[int] = set()
            matched_b: set[int] = set()

            for score, _, idx_a, idx_b, cmp in candidates:
                if idx_a in matched_a or idx_b in matched_b:
                    continue
                matched_a.add(idx_a)
                matched_b.add(idx_b)
                a = norm_a[idx_a]
                b = norm_b[idx_b]

                if (
                    cmp["same_settings_count"] > 0
                    and cmp["different_values_count"] == 0
                    and cmp["only_in_tenant_a_count"] == 0
                    and cmp["only_in_tenant_b_count"] == 0
                ):
                    status = "match"
                    sub_status = "same_settings"
                    reason = "Policies have identical settings."
                    type_counts["match"] += 1
                    identical.append(
                        {
                            "resource_id": a["id"] or b["id"],
                            "display_name": f"{a['name']} <-> {b['name']}",
                            "resource_type": resource_type,
                        }
                    )
                else:
                    status = "not_match"
                    sub_status = "different_settings"
                    reason = (
                        f"Same: {cmp['same_settings_count']}, diff values: {cmp['different_values_count']}, "
                        f"only A: {cmp['only_in_tenant_a_count']}, only B: {cmp['only_in_tenant_b_count']}."
                    )
                    type_counts["not_match"] += 1
                    diffs = _diff_dicts(a["normalized"], b["normalized"])
                    modified.append(
                        {
                            "resource_id": a["id"] or b["id"],
                            "display_name": f"{a['name']} <-> {b['name']}",
                            "resource_type": resource_type,
                            "changes": diffs,
                            "data_a": a["normalized"],
                            "data_b": b["normalized"],
                        }
                    )

                policy_items.append(
                    {
                        "policy_type": policy_type,
                        "resource_type": resource_type,
                        "policy_name": f"{a['name']} <-> {b['name']}",
                        "policy_key": f"pair:{a['id']}:{b['id']}",
                        "status": status,
                        "sub_status": sub_status,
                        "reason": reason,
                        "tenant_a_policy_name": a["name"],
                        "tenant_b_policy_name": b["name"],
                        "tenant_a_count": 1,
                        "tenant_b_count": 1,
                        "tenant_a_ids": [a["id"]] if a["id"] else [],
                        "tenant_b_ids": [b["id"]] if b["id"] else [],
                        "tenant_a_data": _ui_policy_payload(a),
                        "tenant_b_data": _ui_policy_payload(b),
                        "comparison": cmp,
                    }
                )

            # Unmatched policies => missing in one tenant
            for idx_a, a in enumerate(norm_a):
                if idx_a in matched_a:
                    continue
                type_counts["not_match"] += 1
                removed.append(
                    {
                        "resource_id": a["id"],
                        "display_name": a["name"],
                        "resource_type": resource_type,
                        "snapshot": "tenant_a",
                        "data": a["normalized"],
                    }
                )
                policy_items.append(
                    {
                        "policy_type": policy_type,
                        "resource_type": resource_type,
                        "policy_name": a["name"],
                        "policy_key": f"missing-b:{a['id']}",
                        "status": "not_match",
                        "sub_status": "missing_in_tenant_b",
                        "reason": "No settings-similar policy found in tenant B.",
                        "tenant_a_policy_name": a["name"],
                        "tenant_b_policy_name": "",
                        "tenant_a_count": 1,
                        "tenant_b_count": 0,
                        "tenant_a_ids": [a["id"]] if a["id"] else [],
                        "tenant_b_ids": [],
                        "tenant_a_data": _ui_policy_payload(a),
                        "tenant_b_data": None,
                        "comparison": None,
                    }
                )
            for idx_b, b in enumerate(norm_b):
                if idx_b in matched_b:
                    continue
                type_counts["not_match"] += 1
                added.append(
                    {
                        "resource_id": b["id"],
                        "display_name": b["name"],
                        "resource_type": resource_type,
                        "snapshot": "tenant_b",
                        "data": b["normalized"],
                    }
                )
                policy_items.append(
                    {
                        "policy_type": policy_type,
                        "resource_type": resource_type,
                        "policy_name": b["name"],
                        "policy_key": f"missing-a:{b['id']}",
                        "status": "not_match",
                        "sub_status": "missing_in_tenant_a",
                        "reason": "No settings-similar policy found in tenant A.",
                        "tenant_a_policy_name": "",
                        "tenant_b_policy_name": b["name"],
                        "tenant_a_count": 0,
                        "tenant_b_count": 1,
                        "tenant_a_ids": [],
                        "tenant_b_ids": [b["id"]] if b["id"] else [],
                        "tenant_a_data": None,
                        "tenant_b_data": _ui_policy_payload(b),
                        "comparison": None,
                    }
                )

            policy_type_summary.append(
                {
                    "policy_type": policy_type,
                    "match": type_counts["match"],
                    "not_match": type_counts["not_match"],
                    "duplicate": type_counts["duplicate"],
                    "tenant_a_total": len(policies_a),
                    "tenant_b_total": len(policies_b),
                }
            )

    return {
        "tenant_a": {
            "tenant_id": req.tenant_a.tenant_id,
            "name": name_a,
            "resource_count": tenant_a_resource_total,
        },
        "tenant_b": {
            "tenant_id": req.tenant_b.tenant_id,
            "name": name_b,
            "resource_count": tenant_b_resource_total,
        },
        "summary": {
            "match": len([i for i in policy_items if i["status"] == "match"]),
            "not_match": len([i for i in policy_items if i["status"] == "not_match"]),
            "duplicate": len([i for i in policy_items if i["status"] == "duplicate"]),
            "same_settings": len([i for i in policy_items if i["sub_status"] == "same_settings"]),
            "different_settings": len([i for i in policy_items if i["sub_status"] == "different_settings"]),
            "missing_in_tenant_a": len([i for i in policy_items if i["sub_status"] == "missing_in_tenant_a"]),
            "missing_in_tenant_b": len([i for i in policy_items if i["sub_status"] == "missing_in_tenant_b"]),
            "total_policies_compared": len(policy_items),
            "identical": len(identical),
            "modified": len(modified),
            "added": len(added),
            "removed": len(removed),
            "total_settings_analyzed": sum(len(m.get("changes", [])) for m in modified) + len(identical),
        },
        "policy_items": policy_items,
        "policy_type_summary": policy_type_summary,
        "source_errors": source_errors,
        "identical": identical,
        "modified": modified,
        "added": added,
        "removed": removed,
    }


