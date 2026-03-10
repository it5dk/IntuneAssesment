import logging
from collections import defaultdict
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["threat-analytics"])

GRAPH_BETA = "https://graph.microsoft.com/beta"


@router.get("/threat-analytics")
async def get_threat_analytics():
    results: dict = {"threats": [], "secure_score": None, "insights": []}
    errors: list[dict] = []

    # 1. Active threats (unresolved alerts) - try beta first, fallback to v1.0
    try:
        alerts = await graph_client.get_all(
            f"{GRAPH_BETA}/security/alerts_v2",
            params={
                "$top": "100",
                "$orderby": "createdDateTime desc",
            },
        )
        for a in alerts:
            status = (a.get("status") or "").lower()
            if status != "resolved":
                results["threats"].append({
                    "id": a.get("id", ""),
                    "title": a.get("title", "Unknown"),
                    "severity": a.get("severity", "unknown"),
                    "status": a.get("status", ""),
                    "category": a.get("category", ""),
                    "created": a.get("createdDateTime"),
                    "description": a.get("description", ""),
                })
    except Exception:
        try:
            alerts = await graph_client.get_all(
                "/security/alerts",
                params={"$top": "100", "$orderby": "createdDateTime desc"},
            )
            for a in alerts:
                status = (a.get("status") or "").lower()
                if status != "resolved":
                    results["threats"].append({
                        "id": a.get("id", ""),
                        "title": a.get("title", "Unknown"),
                        "severity": a.get("severity", "unknown"),
                        "status": a.get("status", ""),
                        "category": a.get("category", ""),
                        "created": a.get("createdDateTime"),
                        "description": a.get("description", ""),
                    })
        except Exception as e:
            logger.warning("Failed to fetch active threats: %s", e)
            errors.append({"source": "Active Threats", "error": str(e)})

    # 2. Secure Score - try beta first
    try:
        scores = await graph_client.get(
            f"{GRAPH_BETA}/security/secureScores",
            params={"$top": "1", "$orderby": "createdDateTime desc"},
        )
        score_list = scores.get("value", []) if isinstance(scores, dict) else []
        if score_list:
            s = score_list[0]
            results["secure_score"] = {
                "current_score": s.get("currentScore", 0),
                "max_score": s.get("maxScore", 0),
                "created": s.get("createdDateTime"),
                "average_comparative_score": next(
                    (c.get("averageScore", 0) for c in s.get("averageComparativeScores", [])
                     if c.get("basis") == "AllTenants"),
                    0,
                ),
            }
    except Exception as e:
        logger.warning("Failed to fetch secure score: %s", e)
        errors.append({"source": "Secure Score", "error": str(e)})

    # 3. Vulnerability insights (aggregate by category)
    category_counts: dict[str, dict] = defaultdict(lambda: {"count": 0, "high": 0, "medium": 0, "low": 0})
    for t in results["threats"]:
        cat = t.get("category", "Other") or "Other"
        category_counts[cat]["count"] += 1
        severity = t.get("severity", "").lower()
        if severity in ("high", "medium", "low"):
            category_counts[cat][severity] += 1

    results["insights"] = [
        {"category": cat, **counts}
        for cat, counts in sorted(category_counts.items(), key=lambda x: x[1]["count"], reverse=True)
    ]

    summary = {
        "active_threats": len(results["threats"]),
        "secure_score": results["secure_score"]["current_score"] if results["secure_score"] else None,
        "max_score": results["secure_score"]["max_score"] if results["secure_score"] else None,
        "high_risk": sum(1 for t in results["threats"] if t.get("severity") == "high"),
        "categories": len(category_counts),
    }

    return {"data": results, "summary": summary, "errors": errors}
