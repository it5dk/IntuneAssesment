""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\services\seed.py
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

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.template import Template

SEED_TEMPLATES = [
    {
        "name": "Entra ID User Monitor",
        "description": "Monitor Entra ID user accounts for property changes, license modifications, and sync status drift.",
        "icon_key": "users",
        "product_tag": "entra",
        "resource_type": "microsoft.graph.user",
        "graph_endpoints": ["/users"],
        "default_schedule_hours": 24,
        "default_ignore_rules": ["createdDateTime", ".*lastSign.*", ".*timestamp.*"],
        "default_severity": "LOW",
    },
    {
        "name": "Entra ID Group Monitor",
        "description": "Monitor Entra ID security and M365 groups for membership changes, property modifications, and group type drift.",
        "icon_key": "shield",
        "product_tag": "entra",
        "resource_type": "microsoft.graph.group",
        "graph_endpoints": ["/groups", "/groups/{id}/members"],
        "default_schedule_hours": 12,
        "default_ignore_rules": ["createdDateTime", ".*timestamp.*"],
        "default_severity": "MEDIUM",
    },
    {
        "name": "Conditional Access Policy Monitor",
        "description": "Monitor Conditional Access policies for state changes, condition modifications, and grant control drift.",
        "icon_key": "lock",
        "product_tag": "entra",
        "resource_type": "microsoft.graph.conditionalAccessPolicy",
        "graph_endpoints": ["/identity/conditionalAccess/policies"],
        "default_schedule_hours": 6,
        "default_ignore_rules": ["createdDateTime", "modifiedDateTime"],
        "default_severity": "HIGH",
    },
    {
        "name": "Intune Role Assessment Monitor",
        "description": "Monitor Intune RBAC role assignments for scope changes, new assignments, and permission drift.",
        "icon_key": "key",
        "product_tag": "intune",
        "resource_type": "intune.rbac.roleAssignment",
        "graph_endpoints": ["/deviceManagement/roleDefinitions", "/deviceManagement/roleAssignments"],
        "default_schedule_hours": 12,
        "default_ignore_rules": [".*timestamp.*"],
        "default_severity": "HIGH",
    },
    {
        "name": "Device Compliance Policies Monitor",
        "description": "Monitor Intune device compliance policies for rule changes, platform modifications, and enforcement drift.",
        "icon_key": "laptop",
        "product_tag": "intune",
        "resource_type": "microsoft.graph.deviceCompliancePolicy",
        "graph_endpoints": ["/deviceManagement/deviceCompliancePolicies"],
        "default_schedule_hours": 12,
        "default_ignore_rules": ["createdDateTime", "lastModifiedDateTime", "version"],
        "default_severity": "MEDIUM",
    },
    {
        "name": "Managed Devices Monitor",
        "description": "Monitor Intune managed devices for compliance status changes, OS updates, encryption state, and enrollment drift.",
        "icon_key": "monitor",
        "product_tag": "intune",
        "resource_type": "microsoft.graph.managedDevice",
        "graph_endpoints": ["/deviceManagement/managedDevices"],
        "default_schedule_hours": 12,
        "default_ignore_rules": ["lastSyncDateTime", ".*timestamp.*"],
        "default_severity": "MEDIUM",
    },
    {
        "name": "Device Configuration Profiles Monitor",
        "description": "Monitor Intune device configuration profiles for setting changes, platform modifications, and deployment drift.",
        "icon_key": "settings",
        "product_tag": "intune",
        "resource_type": "microsoft.graph.deviceConfiguration",
        "graph_endpoints": ["/deviceManagement/deviceConfigurations"],
        "default_schedule_hours": 12,
        "default_ignore_rules": ["lastModifiedDateTime", "version", ".*timestamp.*"],
        "default_severity": "MEDIUM",
    },
    {
        "name": "App Assignments Monitor",
        "description": "Monitor Intune app assignments for deployment changes, intent modifications, and targeting drift across users and groups.",
        "icon_key": "app-window",
        "product_tag": "intune",
        "resource_type": "microsoft.graph.mobileAppAssessment",
        "graph_endpoints": ["/deviceAppManagement/mobileApps", "/deviceAppManagement/mobileApps/{id}/assignments"],
        "default_schedule_hours": 12,
        "default_ignore_rules": ["createdDateTime", "lastModifiedDateTime"],
        "default_severity": "MEDIUM",
    },
    {
        "name": "Group Policy Assignments Monitor",
        "description": "Monitor policy assignments by group for scope changes, new assignments, and targeting drift across compliance and configuration policies.",
        "icon_key": "users-round",
        "product_tag": "intune",
        "resource_type": "intune.groupAssignment",
        "graph_endpoints": ["/deviceManagement/deviceCompliancePolicies/{id}/assignments", "/deviceManagement/deviceConfigurations/{id}/assignments"],
        "default_schedule_hours": 12,
        "default_ignore_rules": [".*timestamp.*"],
        "default_severity": "HIGH",
    },
]


async def seed_templates(db: AsyncSession) -> list[Template]:
    """Insert default templates if they don't exist. Returns all templates."""
    existing = (await db.execute(select(Template))).scalars().all()
    existing_types = {t.resource_type for t in existing}

    created = []
    for tpl_data in SEED_TEMPLATES:
        if tpl_data["resource_type"] not in existing_types:
            tpl = Template(**tpl_data)
            db.add(tpl)
            created.append(tpl)

    if created:
        await db.flush()

    return list(existing) + created


