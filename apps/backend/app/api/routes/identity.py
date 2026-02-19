""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\identity.py
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

from datetime import datetime, timezone
from pathlib import Path
import json
from fastapi import APIRouter

router = APIRouter(prefix="/identity", tags=["identity"])

GUIDANCE_URL = "https://learn.microsoft.com/en-us/entra/fundamentals/configure-security?toc=%2Fsecurity%2Fzero-trust%2Fassessment%2Ftoc.json&bc=%2Fsecurity%2Fzero-trust%2Fassessment%2Ftoc.json"
ZTA_SOURCE_URL = "https://github.com/microsoft/zerotrustassessment/tree/psnext/src/powershell"
TEST_META_PATH = Path(__file__).resolve().parents[2] / "data" / "zerotrust_testmeta.json"


@router.get("/run")
async def run_identity_guidance_check():
    if not TEST_META_PATH.exists():
        return {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "source_url": GUIDANCE_URL,
            "zta_source_url": ZTA_SOURCE_URL,
            "summary": {"total_controls": 0, "high_priority": 0, "medium_priority": 0},
            "controls": [],
            "ideas_to_add_more": ["Identity metadata source file is missing. Re-sync from zerotrustassessment psnext."],
            "error": f"Missing file: {TEST_META_PATH}",
        }

    with TEST_META_PATH.open("r", encoding="utf-8") as f:
        meta = json.load(f)

    identity_checks = []
    for test_id, item in meta.items():
        if str(item.get("Pillar", "")).lower() != "identity":
            continue
        risk = str(item.get("RiskLevel", "Medium")).lower()
        priority = "high" if risk == "high" else "medium" if risk == "medium" else "low"
        identity_checks.append({
            "id": str(item.get("TestId", test_id)),
            "control": item.get("Title", f"Test {test_id}"),
            "license": f"Tenant: {', '.join(item.get('TenantType', []))}" if item.get("TenantType") else "Tenant: N/A",
            "priority": priority,
            "category": item.get("Category", "General"),
            "implementation_cost": item.get("ImplementationCost", "Unknown"),
            "user_impact": item.get("UserImpact", "Unknown"),
            "sfi_pillar": item.get("SfiPillar", "Identity"),
        })

    identity_checks.sort(key=lambda x: int(x["id"]) if x["id"].isdigit() else 999999)

    themes = {}
    for check in identity_checks:
        theme = check["sfi_pillar"] or "Identity"
        themes.setdefault(theme, []).append(check)

    controls = [{"theme": theme, "checks": checks} for theme, checks in themes.items()]

    total = len(identity_checks)
    high = sum(1 for c in identity_checks if c["priority"] == "high")
    medium = sum(1 for c in identity_checks if c["priority"] == "medium")
    low = sum(1 for c in identity_checks if c["priority"] == "low")

    ideas_to_add = [
        "Add policy-as-code exports for Conditional Access and role settings.",
        "Schedule a weekly identity drift report with top risk deltas.",
        "Assign control owners and due dates per recommendation.",
        "Store monthly evidence snapshots for audit readiness.",
    ]

    return {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "source_url": GUIDANCE_URL,
        "zta_source_url": ZTA_SOURCE_URL,
        "summary": {"total_controls": total, "high_priority": high, "medium_priority": medium},
        "breakdown": {"high": high, "medium": medium, "low": low},
        "controls": controls,
        "ideas_to_add_more": ideas_to_add,
    }


