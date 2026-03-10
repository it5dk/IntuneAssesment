import logging
from collections import defaultdict
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["security-alerts"])

GRAPH_BETA = "https://graph.microsoft.com/beta"


@router.get("/security-alerts")
async def get_security_alerts():
    results: dict = {"active": [], "resolved": [], "trends": []}
    errors: list[dict] = []

    # Fetch all alerts at once, then split by status
    all_alerts: list[dict] = []
    try:
        all_alerts = await graph_client.get_all(
            f"{GRAPH_BETA}/security/alerts_v2",
            params={
                "$top": "200",
                "$orderby": "createdDateTime desc",
            },
        )
    except Exception:
        # Fallback: try v1.0 /security/alerts (legacy)
        try:
            all_alerts = await graph_client.get_all(
                "/security/alerts",
                params={
                    "$top": "200",
                    "$orderby": "createdDateTime desc",
                },
            )
        except Exception as e:
            logger.warning("Failed to fetch security alerts: %s", e)
            errors.append({"source": "Security Alerts", "error": str(e)})

    for a in all_alerts:
        status = (a.get("status") or "").lower()
        entry = {
            "id": a.get("id", ""),
            "title": a.get("title", "Unknown Alert"),
            "severity": a.get("severity", "unknown"),
            "status": a.get("status", ""),
            "category": a.get("category", ""),
            "created": a.get("createdDateTime"),
            "description": a.get("description", ""),
            "sources": a.get("serviceSources", a.get("vendorInformation", {}).get("provider", "")),
        }
        if status in ("resolved",):
            entry["resolved"] = a.get("resolvedDateTime") or a.get("closedDateTime")
            results["resolved"].append(entry)
        else:
            results["active"].append(entry)

    # Compute trends by date
    daily_counts: dict[str, int] = defaultdict(int)
    for alert in results["active"] + results["resolved"]:
        created = alert.get("created", "")
        if created:
            day = created[:10]
            daily_counts[day] += 1

    results["trends"] = [
        {"date": day, "count": count}
        for day, count in sorted(daily_counts.items())
    ][-30:]

    severity_counts = defaultdict(int)
    for a in results["active"]:
        severity_counts[a.get("severity", "unknown")] += 1

    summary = {
        "active": len(results["active"]),
        "resolved": len(results["resolved"]),
        "high_severity": severity_counts.get("high", 0),
        "medium_severity": severity_counts.get("medium", 0),
        "low_severity": severity_counts.get("low", 0),
    }

    return {"data": results, "summary": summary, "errors": errors}
