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
