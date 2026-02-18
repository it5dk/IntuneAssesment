<!--  BEGIN AUTODOC HEADER
<!--  File: apps\backend\docs\permissions.md
<!--  Description: (edit inside USER NOTES below)
<!-- 
<!--  BEGIN AUTODOC META
<!--  Version: 0.0.0.3
<!--  Last-Updated: 2026-02-19 00:30:35
<!--  Managed-By: autosave.ps1
<!--  END AUTODOC META
<!-- 
<!--  BEGIN USER NOTES
<!--  Your notes here. We will NEVER change this block.
<!--  END USER NOTES
<!--  END AUTODOC HEADER

# Microsoft Graph Permissions

Drift Control requires **Application** permissions (client credentials flow). All permissions need **admin consent**.

## Required Permissions by Monitor Type

### Entra ID User Monitor
| Permission | Type | Rationale |
|---|---|---|
| `User.Read.All` | Application | Read user profiles, licenses, sync status |

### Entra ID Group Monitor
| Permission | Type | Rationale |
|---|---|---|
| `Group.Read.All` | Application | Read group properties and metadata |
| `GroupMember.Read.All` | Application | Read group membership lists |

### Conditional Access Policy Monitor
| Permission | Type | Rationale |
|---|---|---|
| `Policy.Read.All` | Application | Read Conditional Access policies |

### Intune Role Assessment Monitor
| Permission | Type | Rationale |
|---|---|---|
| `DeviceManagementRBAC.Read.All` | Application | Read Intune RBAC role definitions and assignments |

### Device Compliance Policies Monitor
| Permission | Type | Rationale |
|---|---|---|
| `DeviceManagementConfiguration.Read.All` | Application | Read device compliance policies |

### Configuration Profiles Monitor
| Permission | Type | Rationale |
|---|---|---|
| `DeviceManagementConfiguration.Read.All` | Application | Read device configuration profiles (shared with compliance policies) |

### Managed Devices Monitor
| Permission | Type | Rationale |
|---|---|---|
| `DeviceManagementManagedDevices.Read.All` | Application | Read managed device inventory and status |

### App Assignments Monitor
| Permission | Type | Rationale |
|---|---|---|
| `DeviceManagementApps.Read.All` | Application | Read mobile app assignments and configurations |

## Consolidated Minimum Permission Set

For all 8 monitor types, the minimum required permissions are:

```
User.Read.All
Group.Read.All
GroupMember.Read.All
Policy.Read.All
DeviceManagementRBAC.Read.All
DeviceManagementConfiguration.Read.All
DeviceManagementManagedDevices.Read.All
DeviceManagementApps.Read.All
```

## Least Privilege Notes

- All permissions are **read-only** - Drift Control never modifies tenant configuration
- Application permissions are used (no user context) for background/scheduled monitoring
- `Directory.Read.All` could replace `User.Read.All` + `Group.Read.All` + `GroupMember.Read.All` but is broader than necessary
- Consider granting only the permissions for the monitor types you plan to use

## API Versions

All collectors use Microsoft Graph **v1.0** endpoints. No beta endpoints are required for the current monitor types.

