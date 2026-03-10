const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Types
export interface Template {
  id: string;
  name: string;
  description: string;
  icon_key: string;
  product_tag: string;
  resource_type: string;
  graph_endpoints: string[];
  default_schedule_hours: number;
  default_ignore_rules: string[];
  default_severity: string;
  created_at: string;
}

export interface MonitorRun {
  id: string;
  monitor_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  snapshot_id: string | null;
}

export interface Monitor {
  id: string;
  template_id: string;
  name: string;
  description: string;
  schedule_hours: number;
  enabled: boolean;
  scope: Record<string, unknown> | null;
  ignore_rules: string[];
  baseline_snapshot_id: string | null;
  created_at: string;
  updated_at: string;
  product_tag: string | null;
  resource_type: string | null;
  last_run: MonitorRun | null;
  resource_count: number;
}

export interface SnapshotItem {
  id: string;
  resource_id: string;
  resource_type: string;
  display_name: string;
  raw_json: Record<string, unknown>;
  normalized: Record<string, unknown>;
  hash: string;
  created_at: string;
}

export interface Snapshot {
  id: string;
  monitor_id: string;
  resource_count: number;
  created_at: string;
  items?: SnapshotItem[];
}

export interface DriftItemDetail {
  id: string;
  json_path: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
}

export interface Drift {
  id: string;
  monitor_id: string;
  snapshot_id: string;
  resource_id: string;
  resource_type: string;
  display_name: string;
  change_type: string;
  severity: string;
  status: string;
  property_count: number;
  detected_at: string;
  resolved_at: string | null;
  items?: DriftItemDetail[];
}

export interface Overview {
  active_monitors_count: number;
  active_drifts_count: number;
  resources_monitored_count: number;
  success_rate: number;
  recent_drifts: {
    id: string;
    display_name: string;
    resource_type: string;
    property_count: number;
    severity: string;
    status: string;
    detected_at: string;
  }[];
  monitor_status: {
    id: string;
    name: string;
    product_tag: string;
    resource_count: number;
    schedule_hours: number;
    enabled: boolean;
    last_run_status: string | null;
    last_run_at: string | null;
  }[];
}

// API functions
export const api = {
  // Templates
  getTemplates: () => request<Template[]>("/templates"),
  seedTemplates: () => request<Template[]>("/templates/seed", { method: "POST" }),

  // Monitors
  getMonitors: () => request<Monitor[]>("/monitors"),
  getMonitor: (id: string) => request<Monitor>(`/monitors/${id}`),
  createMonitor: (data: { template_id: string; name: string; description?: string; schedule_hours?: number; enabled?: boolean }) =>
    request<Monitor>("/monitors", { method: "POST", body: JSON.stringify(data) }),
  updateMonitor: (id: string, data: Partial<{ name: string; description: string; schedule_hours: number; enabled: boolean }>) =>
    request<Monitor>(`/monitors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  runMonitor: (id: string) => request<MonitorRun>(`/monitors/${id}/run`, { method: "POST" }),

  // Snapshots
  getSnapshots: (monitorId?: string) =>
    request<Snapshot[]>(`/snapshots${monitorId ? `?monitorId=${monitorId}` : ""}`),
  getSnapshot: (id: string) => request<Snapshot>(`/snapshots/${id}`),
  setBaseline: (id: string) => request<{ status: string }>(`/snapshots/${id}/baseline`, { method: "POST" }),

  // Drifts
  getDrifts: (params?: { status?: string; monitorId?: string; severity?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.monitorId) search.set("monitorId", params.monitorId);
    if (params?.severity) search.set("severity", params.severity);
    const qs = search.toString();
    return request<Drift[]>(`/drifts${qs ? `?${qs}` : ""}`);
  },
  getDrift: (id: string) => request<Drift>(`/drifts/${id}`),
  resolveDrift: (id: string) => request<{ status: string }>(`/drifts/${id}/resolve`, { method: "POST" }),

  // Overview
  getOverview: () => request<Overview>("/overview"),

  // Devices
  getDevices: (params?: { page?: number; page_size?: number; compliance_state?: string; os?: string; search?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.page_size) search.set("page_size", String(params.page_size));
    if (params?.compliance_state) search.set("compliance_state", params.compliance_state);
    if (params?.os) search.set("os", params.os);
    if (params?.search) search.set("search", params.search);
    const qs = search.toString();
    return request<DevicesResponse>(`/devices${qs ? `?${qs}` : ""}`);
  },
  getDeviceSummary: () => request<DeviceSummary>("/devices/summary"),

  // Compare
  compareSnapshots: (snapshot_a_id: string, snapshot_b_id: string, resource_id?: string) =>
    request<CompareResponse>("/compare", {
      method: "POST",
      body: JSON.stringify({ snapshot_a_id, snapshot_b_id, resource_id }),
    }),
  compareTenants: (data: CompareTenantsRequest) =>
    request<CompareTenantsResponse>("/compare/tenants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Configuration
  getConfigPolicies: (params?: { platform?: string; search?: string }) => {
    const search = new URLSearchParams();
    if (params?.platform) search.set("platform", params.platform);
    if (params?.search) search.set("search", params.search);
    const qs = search.toString();
    return request<ConfigPoliciesResponse>(`/configuration/policies${qs ? `?${qs}` : ""}`);
  },
  getConfigPolicySettings: (policyId: string) =>
    request<ConfigPolicySettings>(`/configuration/policies/${policyId}/settings`),
  getConfigSummary: () => request<ConfigSummary>("/configuration/summary"),

  // Assessments
  getAllAssessments: (params?: { type_filter?: string; search?: string }) => {
    const search = new URLSearchParams();
    if (params?.type_filter) search.set("type_filter", params.type_filter);
    if (params?.search) search.set("search", params.search);
    const qs = search.toString();
    return request<AllAssessmentsResponse>(`/assignments/all${qs ? `?${qs}` : ""}`);
  },
  getAppAssessments: (search?: string) =>
    request<AppAssessmentsResponse>(`/assignments/apps${search ? `?search=${search}` : ""}`),
  getGroupAssessments: (search?: string) =>
    request<GroupAssessmentsResponse>(`/assignments/groups${search ? `?search=${search}` : ""}`),

  // Groups
  getGroups: (params?: { search?: string; group_type?: string; has_members?: string; synced?: string }) => {
    const search = new URLSearchParams();
    if (params?.search) search.set("search", params.search);
    if (params?.group_type) search.set("group_type", params.group_type);
    if (params?.has_members) search.set("has_members", params.has_members);
    if (params?.synced) search.set("synced", params.synced);
    const qs = search.toString();
    return request<GroupsResponse>(`/groups${qs ? `?${qs}` : ""}`);
  },

  // Permissions
  getPermissions: () => request<PermissionsResponse>("/permissions"),

  // Assessment Manager (live Graph CRUD)
  getManagerObjects: (collection: string, search?: string) => {
    const params = new URLSearchParams();
    params.set("collection", collection);
    if (search) params.set("search", search);
    return request<ManagedObjectsResponse>(`/assessment-manager/objects?${params.toString()}`);
  },
  getObjectAssessments: (objectId: string, collection: string) =>
    request<ObjectAssessmentsResponse>(`/assessment-manager/objects/${objectId}/assignments?collection=${collection}`),
  validateAssessment: (data: ValidateAssessmentRequest) =>
    request<ValidationResult>("/assessment-manager/validate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createAssessment: (data: CreateAssessmentRequest) =>
    request<AssessResult>("/assessment-manager/assign", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAssessmentLogs: (params?: { object_id?: string; operator_id?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.object_id) search.set("object_id", params.object_id);
    if (params?.operator_id) search.set("operator_id", params.operator_id);
    if (params?.limit) search.set("limit", String(params.limit));
    const qs = search.toString();
    return request<AssessmentLogsResponse>(`/assessment-manager/logs${qs ? `?${qs}` : ""}`);
  },

  // Zero Trust Assessment
  getZeroTrustAssessment: (topUsers?: number) =>
    request<ZeroTrustAssessment>(`/zero-trust/assessment${topUsers ? `?top_users=${topUsers}` : ""}`),
  getZeroTrustUserAssessment: (userKey: string, lookbackDays: number = 30) =>
    request<ZeroTrustUserAssessment>(`/zero-trust/user-assessment?user_key=${encodeURIComponent(userKey)}&lookback_days=${lookbackDays}`),
  getIdentityRun: () => request<IdentityRunResponse>("/identity/run"),
  getDevicesRun: () => request<IdentityRunResponse>("/devices/run"),

  // Key Vault
  getCertificates: () => request<CertificatesResponse>("/certificates"),
  getAccessPolicies: () => request<AccessPoliciesResponse>("/certificates/access-policies"),

  // Device Compliance
  getDeviceCompliance: () => request<DeviceComplianceResponse>("/device-compliance"),

  // Privileged Access
  getPrivilegedAccess: () => request<PrivilegedAccessResponse>("/privileged-access"),

  // Endpoint Protection
  getEndpointProtection: () => request<EndpointProtectionResponse>("/endpoint-protection"),

  // Security Alerts
  getSecurityAlerts: () => request<SecurityAlertsResponse>("/security-alerts"),

  // Threat Analytics
  getThreatAnalytics: () => request<ThreatAnalyticsResponse>("/threat-analytics"),

  // Audit Logs
  getAuditLogs: () => request<AuditLogsResponse>("/audit-logs"),

  // Automation
  getAutomation: () => request<AutomationResponse>("/automation"),

  // Drift Detection
  getDriftDetection: () => request<DriftDetectionResponse>("/drift-detection"),

  // Security Score
  getSecurityScore: () => request<SecurityScoreResponse>("/security-score"),

  // Policy Conflicts
  getPolicyConflicts: () => request<PolicyConflictsResponse>("/policy-conflicts"),

  // Tenant Risk
  getTenantRisk: () => request<TenantRiskResponse>("/tenant-risk"),

  // Expiring Permissions
  getExpiringPermissions: () => request<ExpiringPermissionsResponse>("/expiring-permissions"),

  // Inactive Admins
  getInactiveAdmins: () => request<InactiveAdminsResponse>("/inactive-admins"),

  // Shadow Apps
  getShadowApps: () => request<ShadowAppsResponse>("/shadow-apps"),
};

// New types for added features
export interface DeviceEntry {
  id: string;
  device_name: string;
  os: string;
  os_version: string;
  compliance_state: string;
  is_encrypted: boolean;
  model: string;
  manufacturer: string;
  serial_number: string;
  user: string;
  enrolled: string | null;
  last_sync: string | null;
  management_agent: string;
}

export interface DevicesResponse {
  devices: DeviceEntry[];
  total: number;
  page: number;
  page_size: number;
  snapshot_id?: string;
  snapshot_at?: string;
}

export interface DeviceSummary {
  total: number;
  compliance: Record<string, number>;
  os_breakdown: Record<string, number>;
  encryption: { encrypted: number; not_encrypted: number };
}

export interface CompareResponse {
  snapshot_a: { id: string; created_at: string; resource_count: number };
  snapshot_b: { id: string; created_at: string; resource_count: number };
  summary: { identical: number; modified: number; added: number; removed: number; total_settings_analyzed: number };
  identical: { resource_id: string; display_name: string; resource_type: string }[];
  modified: { resource_id: string; display_name: string; resource_type: string; changes: { json_path: string; change_type: string; old_value: string | null; new_value: string | null }[]; data_a: Record<string, unknown>; data_b: Record<string, unknown> }[];
  added: { resource_id: string; display_name: string; resource_type: string; data: Record<string, unknown> }[];
  removed: { resource_id: string; display_name: string; resource_type: string; data: Record<string, unknown> }[];
}

export interface TenantConnectionInput {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  label?: string;
}

export interface CompareTenantsRequest {
  tenant_a: TenantConnectionInput;
  tenant_b: TenantConnectionInput;
}

export interface CompareTenantsResponse {
  tenant_a: { tenant_id: string; name: string; resource_count: number };
  tenant_b: { tenant_id: string; name: string; resource_count: number };
  summary: {
    match: number;
    not_match: number;
    duplicate: number;
    same_settings: number;
    different_settings: number;
    missing_in_tenant_a: number;
    missing_in_tenant_b: number;
    total_policies_compared: number;
    identical: number;
    modified: number;
    added: number;
    removed: number;
    total_settings_analyzed: number;
  };
  policy_items: {
    policy_type: string;
    resource_type: string;
    policy_name: string;
    policy_key: string;
    status: "match" | "not_match" | "duplicate";
    sub_status: "same_settings" | "different_settings" | "missing_in_tenant_a" | "missing_in_tenant_b" | "duplicate_settings" | "match";
    reason: string;
    tenant_a_policy_name?: string;
    tenant_b_policy_name?: string;
    tenant_a_count: number;
    tenant_b_count: number;
    tenant_a_ids: string[];
    tenant_b_ids: string[];
    tenant_a_data?: Record<string, unknown> | null;
    tenant_b_data?: Record<string, unknown> | null;
    comparison?: {
      shared_settings_count: number;
      same_settings_count: number;
      different_values_count: number;
      only_in_tenant_a_count: number;
      only_in_tenant_b_count: number;
      sample_same_paths: string[];
      sample_different_paths: { path: string; tenant_a_value: string | null; tenant_b_value: string | null }[];
      sample_only_in_tenant_a_paths: string[];
      sample_only_in_tenant_b_paths: string[];
    } | null;
  }[];
  policy_type_summary: {
    policy_type: string;
    match: number;
    not_match: number;
    duplicate: number;
    tenant_a_total: number;
    tenant_b_total: number;
  }[];
  source_errors: { policy_type: string; error: string }[];
  identical: { resource_id: string; display_name: string; resource_type: string }[];
  modified: {
    resource_id: string;
    display_name: string;
    resource_type: string;
    changes: { json_path: string; change_type: string; old_value: string | null; new_value: string | null }[];
    data_a: Record<string, unknown>;
    data_b: Record<string, unknown>;
  }[];
  added: { resource_id: string; display_name: string; resource_type: string; data: Record<string, unknown> }[];
  removed: { resource_id: string; display_name: string; resource_type: string; data: Record<string, unknown> }[];
}

export interface ConfigPolicy {
  id: string;
  display_name: string;
  description: string;
  resource_type: string;
  platform: string;
  last_modified: string | null;
  version: number | null;
  snapshot_id: string;
}

export interface ConfigPoliciesResponse {
  policies: ConfigPolicy[];
  total: number;
}

export interface ConfigPolicySetting {
  key: string;
  value: unknown;
  type: string;
}

export interface ConfigPolicySettings {
  policy_id: string;
  display_name: string;
  resource_type: string;
  platform: string;
  settings: ConfigPolicySetting[];
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
}

export interface ConfigSummary {
  total: number;
  by_type: Record<string, number>;
  by_platform: Record<string, number>;
}

export interface AssessmentEntry {
  type: string;
  source_name: string;
  source_id: string;
  intent: string;
  target_type: string;
  target_group_id: string | null;
  policy_type?: string;
}

export interface AllAssessmentsResponse {
  assignments: AssessmentEntry[];
  total: number;
}

export interface AppAssessment {
  id: string;
  display_name: string;
  publisher: string;
  assignment_count: number;
  assignments: { intent: string; target_type: string; target_group_id: string | null }[];
}

export interface AppAssessmentsResponse {
  apps: AppAssessment[];
  total: number;
}

export interface GroupAssessment {
  group_id: string;
  assignment_count: number;
  assignments: { policy_id: string; policy_name: string; policy_type: string; target_type: string; intent: string }[];
}

export interface GroupAssessmentsResponse {
  groups: GroupAssessment[];
  total: number;
}

export interface PermissionCheck {
  permission: string;
  status: "granted" | "denied" | "error";
  endpoint: string;
  error?: string;
}

export interface PermissionsResponse {
  total: number;
  granted: number;
  denied: number;
  checks: PermissionCheck[];
}

export interface GroupMember {
  id: string;
  displayName: string;
  userPrincipalName: string;
}

export interface GroupPolicyUsage {
  policy_name: string;
  policy_type: string;
  intent: string;
  source: string;
}

export interface EntraGroup {
  id: string;
  displayName: string;
  description: string;
  groupType: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
  groupTypes: string[];
  membershipRule: string | null;
  membershipRuleProcessingState: string | null;
  onPremisesSyncEnabled: boolean;
  onPremisesDomainName: string | null;
  onPremisesLastSyncDateTime: string | null;
  onPremisesSamAccountName: string | null;
  createdDateTime: string;
  memberCount: number;
  members: GroupMember[];
  usedIn: GroupPolicyUsage[];
  usedInCount: number;
}

export interface GroupsSummary {
  by_type: Record<string, number>;
  synced: number;
  cloud_only: number;
  empty_groups: number;
  with_policies: number;
}

export interface GroupsResponse {
  groups: EntraGroup[];
  total: number;
  summary: GroupsSummary;
  error?: string;
}

// Assessment Manager types
export interface ManagedObject {
  id: string;
  displayName: string;
  lastModifiedDateTime: string | null;
  notes?: string | null;
  description?: string | null;
}

export interface ManagedObjectsResponse {
  objects: ManagedObject[];
  total: number;
  error?: string;
}

export interface ObjectAssessment {
  id: string;
  intent: string;
  target_type: string;
  group_id: string | null;
  settings?: Record<string, unknown> | null;
}

export interface ObjectAssessmentsResponse {
  assignments: ObjectAssessment[];
  total: number;
  error?: string;
}

export interface ValidateAssessmentRequest {
  object_id: string;
  collection: string;
  targets: { group_id: string; intent: string }[];
}

export interface GroupCheck {
  group_id: string;
  exists: boolean;
  displayName?: string;
  error?: string | null;
}

export interface ConflictEntry {
  group_id: string;
  existing_intent: string;
  requested_intent: string;
  message: string;
}

export interface DuplicateEntry {
  group_id: string;
  intent: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  group_checks: GroupCheck[];
  duplicates: DuplicateEntry[];
  conflicts: ConflictEntry[];
  current_assessment_count: number;
  error?: string;
}

export interface CreateAssessmentRequest {
  tenant_id: string;
  operator_id: string;
  object_id: string;
  object_name: string;
  collection: string;
  targets: { group_id: string; intent: string }[];
  ticket_id?: string | null;
  stamp_operator: boolean;
}

export interface AssessResult {
  success: boolean;
  assignments_created: number;
  duplicates_skipped: number;
  stamp_result: string | null;
  conflicts: ConflictEntry[];
  errors: { group_id: string; error: string }[];
  log_id: string;
  error?: string;
}

export interface AssessmentLogEntry {
  id: string;
  tenant_id: string;
  operator_id: string;
  object_id: string;
  object_name: string;
  collection: string;
  action: string;
  targets: { group_id: string; intent: string }[];
  conflicts_detected: ConflictEntry[] | null;
  stamp_result: string | null;
  ticket_id: string | null;
  created_at: string | null;
}

export interface AssessmentLogsResponse {
  logs: AssessmentLogEntry[];
  total: number;
}

// Zero Trust Assessment types
export interface ZeroTrustPillarSummary {
  [key: string]: string | number | boolean;
}

export interface ZeroTrustPillar {
  score: number;
  grade: string;
  available: boolean;
  error: string | null;
  summary: Record<string, unknown>;
  details: Record<string, unknown>;
}

export interface UserRiskFactor {
  pillar: string;
  factor: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface TopRiskUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  userType: string;
  risk_score: number;
  risk_factors: UserRiskFactor[];
  created_date_time?: string;
  source?: "synced" | "cloud";
  licenses?: string[];
  password_expires_on?: string;
  password_length_set?: string;
  last_sign_in?: string;
  risk_factor_count?: number;
}

export interface PermissionStatus {
  all_granted: boolean;
  missing: string[];
  checks: { permission: string; status: "granted" | "denied" | "error" }[];
}

export interface ZeroTrustAssessment {
  assessment_time: string;
  assessment_duration_seconds: number;
  tenant_user_count: number;
  composite_score: number;
  composite_grade: string;
  pillars: Record<string, ZeroTrustPillar>;
  top_risk_users: TopRiskUser[];
  permissions_status: PermissionStatus;
}

export interface ZeroTrustUserAssessment {
  generated_at: string;
  lookback_days: number;
  user: {
    id: string;
    displayName: string;
    userPrincipalName: string;
    accountEnabled: boolean;
    userType: string;
    department?: string;
    jobTitle?: string;
    onPremisesSyncEnabled?: boolean;
  };
  goals: string[];
  risk_score: number;
  pillars: Record<string, { score: number; max: number; notes: Record<string, unknown> }>;
  high_risk_conditions: string[];
  remediation_checklist: { priority: "high" | "medium" | "low"; action: string }[];
  data_collection: Record<string, unknown>;
  raw_samples: Record<string, unknown>;
}

export interface IdentityControl {
  control: string;
  license: string;
  priority: "high" | "medium" | "low";
}

export interface IdentityTheme {
  theme: string;
  checks: IdentityControl[];
}

export interface IdentityRunResponse {
  run_at: string;
  source_url: string;
  summary: {
    total_controls: number;
    high_priority: number;
    medium_priority: number;
  };
  controls: IdentityTheme[];
  ideas_to_add_more: string[];
}

// Certificates & Secrets
export interface CertificateEntry {
  id: string;
  category: string;
  type: string;
  name: string;
  detail: string;
  app_id: string | null;
  expires: string | null;
  days_remaining: number | null;
  status: "expired" | "critical" | "warning" | "healthy" | "unknown";
}

export interface CertificatesSummary {
  total: number;
  expired: number;
  critical: number;
  warning: number;
  healthy: number;
}

export interface CertificatesResponse {
  certificates: CertificateEntry[];
  summary: CertificatesSummary;
  errors: { source: string; error: string }[];
}

export interface AccessPolicyEntry {
  id: string;
  app_name: string;
  app_id: string;
  resource_name: string;
  resource_app_id: string;
  application_permissions: number;
  delegated_permissions: number;
  total_permissions: number;
  permission_ids: string[];
}

export interface AccessPoliciesResponse {
  policies: AccessPolicyEntry[];
  total: number;
  errors: { source: string; error: string }[];
}

// Device Compliance
export interface DeviceComplianceResponse {
  data: {
    noncompliant: { id: string; device_name: string; os: string; os_version: string; user: string; last_sync: string | null; model: string; manufacturer: string }[];
    policies: { id: string; name: string; description: string; last_modified: string | null; version: number | null }[];
    jailbroken: { id: string; device_name: string; os: string; os_version: string; user: string; last_sync: string | null }[];
  };
  summary: { noncompliant: number; compliant: number; jailbroken: number; total_policies: number };
  errors: { source: string; error: string }[];
}

// Privileged Access
export interface PrivilegedAccessResponse {
  data: {
    role_assignments: { id: string; role_name: string; role_id: string; member_name: string; member_upn: string; member_id: string }[];
    pim_activations: { id: string; action: string; principal_id: string; role_definition_id: string; status: string; created: string | null; schedule: unknown }[];
    alerts: { id: string; principal_id: string; role_definition_id: string; status: string; created: string | null; type: string }[];
  };
  summary: { total_roles: number; total_assignments: number; active_pim: number; alerts: number };
  errors: { source: string; error: string }[];
}

// Endpoint Protection
export interface EndpointProtectionResponse {
  data: {
    antivirus: { id: string; name: string; category: string; severity: string; state: string; last_change: string | null; device_count: number }[];
    firewall: { id: string; name: string; description: string; last_modified: string | null; version: number | null }[];
    encryption: { id: string; name: string; description: string; last_modified: string | null; version: number | null }[];
    asr: { id: string; name: string; description: string; last_modified: string | null; version: number | null }[];
  };
  summary: { malware_detections: number; firewall_policies: number; encryption_policies: number; encrypted_devices: number; unencrypted_devices: number; asr_policies: number };
  errors: { source: string; error: string }[];
}

// Security Alerts
export interface SecurityAlertsResponse {
  data: {
    active: { id: string; title: string; severity: string; status: string; category: string; created: string | null; description: string; sources: string[] }[];
    resolved: { id: string; title: string; severity: string; status: string; category: string; created: string | null; resolved: string | null; description: string }[];
    trends: { date: string; count: number }[];
  };
  summary: { active: number; resolved: number; high_severity: number; medium_severity: number; low_severity: number };
  errors: { source: string; error: string }[];
}

// Threat Analytics
export interface ThreatAnalyticsResponse {
  data: {
    threats: { id: string; title: string; severity: string; status: string; category: string; created: string | null; description: string }[];
    secure_score: { current_score: number; max_score: number; created: string | null; average_comparative_score: number } | null;
    insights: { category: string; count: number; high: number; medium: number; low: number }[];
  };
  summary: { active_threats: number; secure_score: number | null; max_score: number | null; high_risk: number; categories: number };
  errors: { source: string; error: string }[];
}

// Audit Logs
export interface AuditLogsResponse {
  data: {
    directory: AuditLogEntry[];
    policy: AuditLogEntry[];
    device: AuditLogEntry[];
    admin: AuditLogEntry[];
  };
  summary: { total_events: number; directory_changes: number; policy_changes: number; device_actions: number; admin_activity: number };
  errors: { source: string; error: string }[];
}

export interface AuditLogEntry {
  id: string;
  activity: string;
  category: string;
  result: string;
  actor: string;
  target: { name: string; type: string; id: string };
  timestamp: string | null;
}

// Automation
export interface AutomationResponse {
  data: {
    remediation: { id: string; name: string; description: string; last_modified: string | null; action_count: number; actions: { rule_name: string; notification_templates: number }[] }[];
    runbooks: { id: string; name: string; description: string; file_name: string; run_as: string; signature_check: boolean; created: string | null; last_modified: string | null }[];
    playbooks: { id: string; name: string; description: string; publisher: string; is_global: boolean; created: string | null; last_modified: string | null }[];
  };
  summary: { remediation_policies: number; scripts: number; playbooks: number };
  errors: { source: string; error: string }[];
}

// Drift Detection
export interface DriftDetectionResponse {
  data: {
    policies: { id: string; name: string; description: string; created: string; last_modified: string; version: number; drifted: boolean }[];
    profiles: { id: string; name: string; description: string; created: string; last_modified: string; version: number; drifted: boolean }[];
    apps: { id: string; name: string; description: string; created: string; last_modified: string; version: number; drifted: boolean }[];
  };
  summary: { total_profiles: number; drifted_profiles: number; total_policies: number; drifted_policies: number; total_apps: number; drifted_apps: number; total_drifted: number };
  errors: { source: string; error: string }[];
}

// Security Score
export interface SecurityScoreResponse {
  data: {
    history: { date: string; current_score: number; max_score: number; average_score: number }[];
    controls: { id: string; title: string; description: string; max_score: number; current_score: number; category: string; state: string; service: string; tier: string; user_impact: string; implementation_cost: string }[];
    current: { current_score: number; max_score: number; average_score: number; date: string | null; enabled_services: string[] } | null;
  };
  summary: { current_score: number | null; max_score: number | null; average_score: number | null; trend: string; history_points: number; controls_count: number };
  errors: { source: string; error: string }[];
}

// Policy Conflicts
export interface PolicyConflictsResponse {
  data: {
    conflicts: { id: string; group_id: string; policy_type: string; policy_count: number; policies: { id: string; name: string }[]; severity: string }[];
    overlaps: { id: string; group_id: string; total_policies: number; by_type: Record<string, number>; policies: { id: string; name: string; type: string }[] }[];
    unassigned: { id: string; name: string; type: string }[];
  };
  summary: { total_conflicts: number; high_severity: number; medium_severity: number; total_overlaps: number; unassigned_policies: number };
  errors: { source: string; error: string }[];
}

// Tenant Risk
export interface TenantRiskResponse {
  data: {
    risk_factors: { factor: string; severity: string; points: number }[];
    risky_users: { id: string; name: string; upn: string; risk_level: string; risk_state: string; risk_detail: string; last_updated: string | null }[];
    risky_signins: { id: string; name: string; risk_level: string; risk_state: string; last_updated: string | null }[];
  };
  summary: { risk_score: number; max_score: number; risk_percentage: number; grade: string; risky_users: number; risky_service_principals: number; risk_factors: number };
  errors: { source: string; error: string }[];
}

// Expiring Permissions
export interface ExpiringPermissionsResponse {
  data: {
    oauth_grants: { id: string; client_id: string; consent_type: string; principal_id: string | null; resource_id: string; scope: string; expires: string | null; days_remaining: number | null; status: string }[];
    app_role_assignments: { id: string; principal_name: string; principal_id: string; resource_name: string; created: string | null }[];
    expiring_secrets: { id: string; app_name: string; app_id: string; type: string; hint: string; expires: string | null; days_remaining: number | null; status: string }[];
  };
  summary: { total_grants: number; expiring_grants: number; expiring_secrets: number; app_role_assignments: number; expired: number; critical: number };
  errors: { source: string; error: string }[];
}

// Inactive Admins
export interface InactiveAdminsResponse {
  data: {
    inactive: { id: string; name: string; upn: string; enabled: boolean; roles: string[]; last_signin: string | null; days_inactive: number | null }[];
    never_signed_in: { id: string; name: string; upn: string; enabled: boolean; roles: string[]; last_signin: string | null; days_inactive: number | null }[];
    disabled_admins: { id: string; name: string; upn: string; enabled: boolean; roles: string[]; last_signin: string | null; days_inactive: number | null }[];
  };
  summary: { total_admins: number; inactive_30d: number; never_signed_in: number; disabled_admins: number };
  errors: { source: string; error: string }[];
}

// Shadow Apps
export interface ShadowAppsResponse {
  data: {
    user_consented: { id: string; app_name: string; user_count: number; scopes: string[]; scope_count: number }[];
    high_privilege: { id: string; app_name: string; app_id: string; publisher: string; verified: boolean; owner_tenant: string; created: string | null; days_old: number | null }[];
    stale_apps: { id: string; app_name: string; app_id: string; created: string | null; days_old: number | null }[];
  };
  summary: { user_consented_apps: number; third_party_apps: number; stale_apps: number; total_shadow: number };
  errors: { source: string; error: string }[];
}
