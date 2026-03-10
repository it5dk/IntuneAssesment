import logging
from fastapi import APIRouter

from app.services.graph_client import graph_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["tenant-risk"])

GRAPH_BETA = "https://graph.microsoft.com/beta"


@router.get("/tenant-risk")
async def get_tenant_risk():
    """Aggregate a tenant-level risk score from multiple signals."""
    results: dict = {"risk_factors": [], "risky_users": [], "risky_signins": []}
    errors: list[dict] = []
    risk_score = 0
    max_score = 0

    # 1. Risky users
    try:
        users = await graph_client.get_all(
            "/identityProtection/riskyUsers",
            params={
                "$select": "id,userDisplayName,userPrincipalName,riskLevel,riskState,riskDetail,riskLastUpdatedDateTime",
                "$filter": "riskState ne 'remediated' and riskState ne 'dismissed'",
                "$top": "100",
            },
        )
        for u in users:
            results["risky_users"].append({
                "id": u.get("id", ""),
                "name": u.get("userDisplayName", "Unknown"),
                "upn": u.get("userPrincipalName", ""),
                "risk_level": u.get("riskLevel", "none"),
                "risk_state": u.get("riskState", ""),
                "risk_detail": u.get("riskDetail", ""),
                "last_updated": u.get("riskLastUpdatedDateTime"),
            })

        high_risk = sum(1 for u in results["risky_users"] if u["risk_level"] == "high")
        medium_risk = sum(1 for u in results["risky_users"] if u["risk_level"] == "medium")
        low_risk = sum(1 for u in results["risky_users"] if u["risk_level"] == "low")

        max_score += 30
        if high_risk > 0:
            risk_score += 30
            results["risk_factors"].append({"factor": f"{high_risk} high-risk user(s)", "severity": "critical", "points": 30})
        elif medium_risk > 0:
            risk_score += 15
            results["risk_factors"].append({"factor": f"{medium_risk} medium-risk user(s)", "severity": "high", "points": 15})
        elif low_risk > 0:
            risk_score += 5
            results["risk_factors"].append({"factor": f"{low_risk} low-risk user(s)", "severity": "medium", "points": 5})
    except Exception as e:
        logger.warning("Failed to fetch risky users: %s", e)
        errors.append({"source": "Risky Users", "error": str(e)})

    # 2. Risky sign-ins (recent)
    try:
        signins = await graph_client.get_all(
            "/identityProtection/riskyServicePrincipals",
            params={
                "$select": "id,displayName,riskLevel,riskState,riskLastUpdatedDateTime",
                "$top": "50",
            },
        )
        for s in signins:
            results["risky_signins"].append({
                "id": s.get("id", ""),
                "name": s.get("displayName", "Unknown"),
                "risk_level": s.get("riskLevel", "none"),
                "risk_state": s.get("riskState", ""),
                "last_updated": s.get("riskLastUpdatedDateTime"),
            })

        max_score += 20
        risky_sp = len(results["risky_signins"])
        if risky_sp > 5:
            risk_score += 20
            results["risk_factors"].append({"factor": f"{risky_sp} risky service principal(s)", "severity": "critical", "points": 20})
        elif risky_sp > 0:
            risk_score += 10
            results["risk_factors"].append({"factor": f"{risky_sp} risky service principal(s)", "severity": "high", "points": 10})
    except Exception as e:
        logger.warning("Failed to fetch risky service principals: %s", e)
        errors.append({"source": "Risky Service Principals", "error": str(e)})

    # 3. Check secure score contribution
    try:
        resp = await graph_client.get(
            f"{GRAPH_BETA}/security/secureScores",
            params={"$top": "1", "$orderby": "createdDateTime desc"},
        )
        scores = resp.get("value", []) if isinstance(resp, dict) else []
        if scores:
            s = scores[0]
            current = s.get("currentScore", 0)
            max_s = s.get("maxScore", 1)
            pct = (current / max_s) * 100 if max_s > 0 else 0

            max_score += 25
            if pct < 40:
                risk_score += 25
                results["risk_factors"].append({"factor": f"Low secure score ({current}/{max_s})", "severity": "critical", "points": 25})
            elif pct < 60:
                risk_score += 15
                results["risk_factors"].append({"factor": f"Moderate secure score ({current}/{max_s})", "severity": "high", "points": 15})
            elif pct < 80:
                risk_score += 5
                results["risk_factors"].append({"factor": f"Good secure score ({current}/{max_s})", "severity": "low", "points": 5})
    except Exception as e:
        logger.warning("Failed to fetch secure score for risk: %s", e)
        errors.append({"source": "Secure Score", "error": str(e)})

    # 4. Check non-compliant device ratio
    try:
        all_devices = await graph_client.get_all(
            "/deviceManagement/managedDevices",
            params={"$select": "id,complianceState", "$top": "999"},
        )
        total = len(all_devices)
        noncompliant = sum(1 for d in all_devices if d.get("complianceState") == "noncompliant")

        max_score += 25
        if total > 0:
            ratio = noncompliant / total
            if ratio > 0.3:
                risk_score += 25
                results["risk_factors"].append({"factor": f"{noncompliant}/{total} devices non-compliant ({ratio:.0%})", "severity": "critical", "points": 25})
            elif ratio > 0.1:
                risk_score += 15
                results["risk_factors"].append({"factor": f"{noncompliant}/{total} devices non-compliant ({ratio:.0%})", "severity": "high", "points": 15})
            elif noncompliant > 0:
                risk_score += 5
                results["risk_factors"].append({"factor": f"{noncompliant}/{total} devices non-compliant", "severity": "medium", "points": 5})
    except Exception as e:
        logger.warning("Failed to fetch device compliance for risk: %s", e)
        errors.append({"source": "Device Compliance", "error": str(e)})

    # Compute grade
    if max_score == 0:
        grade = "N/A"
        risk_pct = 0
    else:
        risk_pct = (risk_score / max_score) * 100
        if risk_pct >= 70:
            grade = "Critical"
        elif risk_pct >= 50:
            grade = "High"
        elif risk_pct >= 25:
            grade = "Medium"
        else:
            grade = "Low"

    results["risk_factors"].sort(key=lambda x: x["points"], reverse=True)

    summary = {
        "risk_score": risk_score,
        "max_score": max_score,
        "risk_percentage": round(risk_pct, 1),
        "grade": grade,
        "risky_users": len(results["risky_users"]),
        "risky_service_principals": len(results["risky_signins"]),
        "risk_factors": len(results["risk_factors"]),
    }

    return {"data": results, "summary": summary, "errors": errors}
