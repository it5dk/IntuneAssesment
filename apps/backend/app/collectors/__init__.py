""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\collectors\__init__.py
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

from app.collectors.entra_users import collect_entra_users
from app.collectors.entra_groups import collect_entra_groups
from app.collectors.conditional_access import collect_conditional_access_policies
from app.collectors.intune_rbac import collect_intune_role_assignments
from app.collectors.device_compliance import collect_device_compliance_policies
from app.collectors.devices import collect_managed_devices
from app.collectors.config_profiles import collect_device_configurations
from app.collectors.app_assignments import collect_app_assignments
from app.collectors.group_assignments import collect_group_policy_assignments

COLLECTOR_MAP: dict[str, callable] = {
    "microsoft.graph.user": collect_entra_users,
    "microsoft.graph.group": collect_entra_groups,
    "microsoft.graph.conditionalAccessPolicy": collect_conditional_access_policies,
    "intune.rbac.roleAssignment": collect_intune_role_assignments,
    "microsoft.graph.deviceCompliancePolicy": collect_device_compliance_policies,
    "microsoft.graph.managedDevice": collect_managed_devices,
    "microsoft.graph.deviceConfiguration": collect_device_configurations,
    "microsoft.graph.mobileAppAssessment": collect_app_assignments,
    "intune.groupAssignment": collect_group_policy_assignments,
}


