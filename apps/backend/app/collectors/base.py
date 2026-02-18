""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\base.py
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

import hashlib
import json
from typing import Any


def stable_hash(data: dict) -> str:
    """Produce a deterministic hash of a dict by sorting keys."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def normalize_resource(raw: dict, fields: list[str]) -> dict:
    """Extract only specified fields from raw JSON for stable comparison."""
    normalized = {}
    for f in fields:
        if f in raw:
            normalized[f] = raw[f]
    return normalized


CollectedItem = dict[str, Any]  # {resource_id, resource_type, display_name, raw_json, normalized, hash}

