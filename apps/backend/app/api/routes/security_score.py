import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["security-score"])

GRAPH_BETA = "https://graph.microsoft.com/beta"


@router.get("/security-score")
async def get_security_score():
    """Fetch Microsoft Secure Score history and control profiles."""
    results: dict = {"history": [], "controls": [], "current": None}
    errors: list[dict] = []

    # 1. Secure score history (last 30 entries) - use beta API
    try:
        resp = await graph_client.get(
            f"{GRAPH_BETA}/security/secureScores",
            params={"$top": "30", "$orderby": "createdDateTime desc"},
        )
        scores = resp.get("value", []) if isinstance(resp, dict) else []
        for s in scores:
            avg = next(
                (c.get("averageScore", 0)
                 for c in s.get("averageComparativeScores", [])
                 if c.get("basis") == "AllTenants"),
                0,
            )
            entry = {
                "date": s.get("createdDateTime", "")[:10],
                "current_score": s.get("currentScore", 0),
                "max_score": s.get("maxScore", 0),
                "average_score": avg,
            }
            results["history"].append(entry)

        if scores:
            latest = scores[0]
            avg = next(
                (c.get("averageScore", 0)
                 for c in latest.get("averageComparativeScores", [])
                 if c.get("basis") == "AllTenants"),
                0,
            )
            results["current"] = {
                "current_score": latest.get("currentScore", 0),
                "max_score": latest.get("maxScore", 0),
                "average_score": avg,
                "date": latest.get("createdDateTime"),
                "enabled_services": latest.get("enabledServices", []),
            }
    except Exception as e:
        logger.warning("Failed to fetch secure scores: %s", e)
        errors.append({"source": "Secure Scores", "error": str(e)})

    # 2. Secure score control profiles (recommendations)
    try:
        resp = await graph_client.get(
            f"{GRAPH_BETA}/security/secureScoreControlProfiles",
            params={"$top": "50"},
        )
        profiles = resp.get("value", []) if isinstance(resp, dict) else []
        for p in profiles:
            results["controls"].append({
                "id": p.get("id", ""),
                "title": p.get("title", ""),
                "description": p.get("actionUrl", ""),
                "max_score": p.get("maxScore", 0),
                "current_score": p.get("scoreInPercentage", 0),
                "category": p.get("controlCategory", ""),
                "state": p.get("controlStateUpdates", [{}])[0].get("state", "")
                    if p.get("controlStateUpdates") else "",
                "service": p.get("service", ""),
                "tier": p.get("tier", ""),
                "user_impact": p.get("userImpact", ""),
                "implementation_cost": p.get("implementationCost", ""),
            })
    except Exception as e:
        logger.warning("Failed to fetch secure score controls: %s", e)
        errors.append({"source": "Score Controls", "error": str(e)})

    # Compute trend
    trend_direction = "stable"
    if len(results["history"]) >= 2:
        recent = results["history"][0]["current_score"]
        older = results["history"][-1]["current_score"]
        if recent > older:
            trend_direction = "up"
        elif recent < older:
            trend_direction = "down"

    summary = {
        "current_score": results["current"]["current_score"] if results["current"] else None,
        "max_score": results["current"]["max_score"] if results["current"] else None,
        "average_score": results["current"]["average_score"] if results["current"] else None,
        "trend": trend_direction,
        "history_points": len(results["history"]),
        "controls_count": len(results["controls"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
