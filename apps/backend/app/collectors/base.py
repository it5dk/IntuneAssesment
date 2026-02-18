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
