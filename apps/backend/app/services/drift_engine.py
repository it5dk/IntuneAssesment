""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\services\drift_engine.py
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
""" END AUTODOC HEADER

import json
import logging
import re
from typing import Any
from app.models.drift import Drift
from app.models.drift_item import DriftItem
from app.models.snapshot_item import SnapshotItem

logger = logging.getLogger(__name__)

SEVERITY_MAP = {
    "microsoft.graph.conditionalAccessPolicy": "HIGH",
    "intune.rbac.roleAssignment": "HIGH",
    "microsoft.graph.group": "MEDIUM",
    "microsoft.graph.user": "LOW",
    "microsoft.graph.deviceCompliancePolicy": "MEDIUM",
}


def _should_ignore(path: str, ignore_patterns: list[str]) -> bool:
    for pattern in ignore_patterns:
        if re.search(pattern, path):
            return True
    return False


def _diff_dicts(old: dict, new: dict, prefix: str = "") -> list[dict]:
    """Recursively diff two dicts, returning list of {json_path, change_type, old_value, new_value}."""
    changes = []
    all_keys = set(list(old.keys()) + list(new.keys()))

    for key in sorted(all_keys):
        path = f"{prefix}.{key}" if prefix else key
        old_val = old.get(key)
        new_val = new.get(key)

        if key not in old:
            changes.append({"json_path": path, "change_type": "added", "old_value": None, "new_value": json.dumps(new_val, default=str)})
        elif key not in new:
            changes.append({"json_path": path, "change_type": "removed", "old_value": json.dumps(old_val, default=str), "new_value": None})
        elif isinstance(old_val, dict) and isinstance(new_val, dict):
            changes.extend(_diff_dicts(old_val, new_val, path))
        elif old_val != new_val:
            changes.append({
                "json_path": path,
                "change_type": "modified",
                "old_value": json.dumps(old_val, default=str),
                "new_value": json.dumps(new_val, default=str),
            })

    return changes


def compute_drift(
    baseline_items: list[SnapshotItem],
    current_items: list[SnapshotItem],
    ignore_patterns: list[str],
    monitor_id: Any,
    snapshot_id: Any,
    resource_type: str,
) -> list[Drift]:
    """Compare baseline vs current snapshot items and produce Drift records."""
    baseline_map = {item.resource_id: item for item in baseline_items}
    current_map = {item.resource_id: item for item in current_items}

    all_resource_ids = set(list(baseline_map.keys()) + list(current_map.keys()))
    drifts: list[Drift] = []
    severity = SEVERITY_MAP.get(resource_type, "MEDIUM")

    for rid in sorted(all_resource_ids):
        old_item = baseline_map.get(rid)
        new_item = current_map.get(rid)

        if not old_item:
            # Resource added
            drift = Drift(
                monitor_id=monitor_id,
                snapshot_id=snapshot_id,
                resource_id=rid,
                resource_type=resource_type,
                display_name=new_item.display_name,
                change_type="added",
                severity=severity,
                property_count=0,
            )
            drifts.append(drift)
            continue

        if not new_item:
            # Resource removed
            drift = Drift(
                monitor_id=monitor_id,
                snapshot_id=snapshot_id,
                resource_id=rid,
                resource_type=resource_type,
                display_name=old_item.display_name,
                change_type="removed",
                severity=severity,
                property_count=0,
            )
            drifts.append(drift)
            continue

        # Quick check: if hashes match, no drift
        if old_item.hash == new_item.hash:
            continue

        # Compute property-level diffs
        raw_changes = _diff_dicts(old_item.normalized, new_item.normalized)
        filtered_changes = [c for c in raw_changes if not _should_ignore(c["json_path"], ignore_patterns)]

        if not filtered_changes:
            continue

        drift = Drift(
            monitor_id=monitor_id,
            snapshot_id=snapshot_id,
            resource_id=rid,
            resource_type=resource_type,
            display_name=new_item.display_name,
            change_type="modified",
            severity=severity,
            property_count=len(filtered_changes),
        )
        drift.items = [
            DriftItem(
                json_path=c["json_path"],
                change_type=c["change_type"],
                old_value=c["old_value"],
                new_value=c["new_value"],
            )
            for c in filtered_changes
        ]
        drifts.append(drift)

    logger.info("Computed %d drifts for monitor %s", len(drifts), monitor_id)
    return drifts

