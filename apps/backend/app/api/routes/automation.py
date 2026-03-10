import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["automation"])

GRAPH_BETA = "https://graph.microsoft.com/beta"


@router.get("/automation")
async def get_automation():
    results: dict = {"remediation": [], "runbooks": [], "playbooks": []}
    errors: list[dict] = []

    # 1. Auto remediation - compliance policies with scheduled actions
    try:
        policies = await graph_client.get_all(
            "/deviceManagement/deviceCompliancePolicies",
            params={"$select": "id,displayName,description,lastModifiedDateTime"},
        )
        for p in policies:
            results["remediation"].append({
                "id": p.get("id", ""),
                "name": p.get("displayName", "Unknown"),
                "description": p.get("description", ""),
                "last_modified": p.get("lastModifiedDateTime"),
                "action_count": 0,
                "actions": [],
            })
    except Exception as e:
        logger.warning("Failed to fetch remediation policies: %s", e)
        errors.append({"source": "Auto Remediation", "error": str(e)})

    # 2. PowerShell scripts (runbooks) - beta API
    try:
        scripts = await graph_client.get_all(
            f"{GRAPH_BETA}/deviceManagement/deviceManagementScripts",
            params={"$select": "id,displayName,description,createdDateTime,lastModifiedDateTime,runAsAccount,enforceSignatureCheck,fileName"},
        )
        for s in scripts:
            results["runbooks"].append({
                "id": s.get("id", ""),
                "name": s.get("displayName", "Unknown"),
                "description": s.get("description", ""),
                "file_name": s.get("fileName", ""),
                "run_as": s.get("runAsAccount", ""),
                "signature_check": s.get("enforceSignatureCheck", False),
                "created": s.get("createdDateTime"),
                "last_modified": s.get("lastModifiedDateTime"),
            })
    except Exception as e:
        logger.warning("Failed to fetch PowerShell scripts: %s", e)
        errors.append({"source": "PowerShell Scripts", "error": str(e)})

    # 3. Shell scripts (macOS/Linux) - beta API
    try:
        shell_scripts = await graph_client.get_all(
            f"{GRAPH_BETA}/deviceManagement/deviceShellScripts",
            params={"$select": "id,displayName,description,createdDateTime,lastModifiedDateTime,runAsAccount,fileName"},
        )
        for s in shell_scripts:
            results["runbooks"].append({
                "id": s.get("id", ""),
                "name": s.get("displayName", "Unknown"),
                "description": s.get("description", ""),
                "file_name": s.get("fileName", ""),
                "run_as": s.get("runAsAccount", ""),
                "signature_check": False,
                "created": s.get("createdDateTime"),
                "last_modified": s.get("lastModifiedDateTime"),
            })
    except Exception as e:
        logger.warning("Failed to fetch shell scripts: %s", e)
        errors.append({"source": "Shell Scripts", "error": str(e)})

    # 4. Proactive remediations (device health scripts) - beta API
    try:
        health_scripts = await graph_client.get_all(
            f"{GRAPH_BETA}/deviceManagement/deviceHealthScripts",
            params={"$select": "id,displayName,description,createdDateTime,lastModifiedDateTime,publisher,isGlobalScript"},
        )
        for s in health_scripts:
            results["playbooks"].append({
                "id": s.get("id", ""),
                "name": s.get("displayName", "Unknown"),
                "description": s.get("description", ""),
                "publisher": s.get("publisher", ""),
                "is_global": s.get("isGlobalScript", False),
                "created": s.get("createdDateTime"),
                "last_modified": s.get("lastModifiedDateTime"),
            })
    except Exception as e:
        logger.warning("Failed to fetch health scripts: %s", e)
        errors.append({"source": "Health Scripts", "error": str(e)})

    summary = {
        "remediation_policies": len(results["remediation"]),
        "scripts": len(results["runbooks"]),
        "playbooks": len(results["playbooks"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
