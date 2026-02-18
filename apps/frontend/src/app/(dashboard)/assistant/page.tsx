"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type EntraGroup,
  type IdentityRunResponse,
  type ManagedObject,
  type ValidationResult,
  type ZeroTrustPillar,
  type TopRiskUser,
  type UserRiskFactor,
} from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Users, AppWindow, FolderTree, Search, ListFilter,
  Gauge, Target, Layers, Zap, BarChart3,
  UserCheck, Shield, Eye, GitCompareArrows,
  ChevronDown, ChevronUp, Cloud, Building2, UserX,
  Lock, Settings, Plus, CheckCircle2,
  AlertTriangle, XCircle, Loader2, ClipboardList,
  ArrowRight, RefreshCw, History, ShieldAlert,
  ShieldCheck, KeyRound, Fingerprint, UserCog,
  Globe, Clock, UsersRound, AlertCircle,
  ChevronRight, Info,
} from "lucide-react";
import { toast } from "sonner";

type TabView = "all" | "apps" | "groups" | "assessment" | "identity";
type CollectionType = "apps" | "deviceConfigurations" | "deviceCompliancePolicies";

const COLLECTION_LABELS: Record<CollectionType, string> = {
  apps: "Apps",
  deviceConfigurations: "Device Configurations",
  deviceCompliancePolicies: "Compliance Policies",
};

const COLLECTION_ICONS: Record<CollectionType, React.ReactNode> = {
  apps: <AppWindow className="h-4 w-4" />,
  deviceConfigurations: <Settings className="h-4 w-4" />,
  deviceCompliancePolicies: <Shield className="h-4 w-4" />,
};

// ── Pillar config ──────────────────────────────────────────────────────────

const PILLAR_CONFIG: Record<string, { label: string; icon: React.ReactNode; weight: number; description: string }> = {
  user_risk: { label: "User Risk", icon: <ShieldAlert className="h-5 w-5" />, weight: 20, description: "Risky users, risk detections, and sign-in anomalies" },
  mfa_coverage: { label: "MFA Coverage", icon: <Fingerprint className="h-5 w-5" />, weight: 20, description: "Multi-factor authentication policy coverage" },
  privilege_exposure: { label: "Privilege Exposure", icon: <KeyRound className="h-5 w-5" />, weight: 20, description: "Admin roles, standing privileges, and role sprawl" },
  ca_coverage: { label: "CA Coverage", icon: <Lock className="h-5 w-5" />, weight: 15, description: "Conditional Access policy coverage and exclusions" },
  access_footprint: { label: "Access Footprint", icon: <Globe className="h-5 w-5" />, weight: 10, description: "OAuth grants, high-privilege scopes, and app consents" },
  account_lifecycle: { label: "Account Lifecycle", icon: <Clock className="h-5 w-5" />, weight: 10, description: "Stale accounts, disabled users, and guest hygiene" },
  group_risk: { label: "Group Risk", icon: <UsersRound className="h-5 w-5" />, weight: 5, description: "CA exclusion groups and group security posture" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function intentBadge(intent: string) {
  const map: Record<string, "success" | "danger" | "info" | "warning"> = {
    required: "danger",
    available: "success",
    uninstall: "warning",
    apply: "info",
    include: "info",
    exclude: "danger",
  };
  return <Badge variant={map[intent] || "secondary"}>{intent}</Badge>;
}

function groupTypeBadge(type: string) {
  const map: Record<string, "default" | "info" | "success" | "warning" | "secondary"> = {
    Security: "default",
    "Microsoft 365": "info",
    "Dynamic Security": "warning",
    "Dynamic Distribution": "warning",
    Distribution: "secondary",
    "Mail-enabled Security": "success",
  };
  return <Badge variant={map[type] || "secondary"} className="text-[10px]">{type}</Badge>;
}

function policySourceIcon(source: string) {
  switch (source) {
    case "app_assignment": return <AppWindow className="h-3 w-3 text-amber-400" />;
    case "conditional_access": return <Lock className="h-3 w-3 text-blue-400" />;
    case "group_policy": return <Settings className="h-3 w-3 text-emerald-400" />;
    default: return <FolderTree className="h-3 w-3" />;
  }
}

function targetTypeLabel(odata: string) {
  if (odata.includes("groupAssignment")) return "Group";
  if (odata.includes("allDevices")) return "All Devices";
  if (odata.includes("allLicensedUsers")) return "All Users";
  return odata.split(".").pop() || odata;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-emerald-400";
    case "B": return "text-blue-400";
    case "C": return "text-amber-400";
    case "D": return "text-orange-400";
    case "F": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case "A": return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
    case "B": return "bg-blue-500/10 border-blue-500/30 text-blue-400";
    case "C": return "bg-amber-500/10 border-amber-500/30 text-amber-400";
    case "D": return "bg-orange-500/10 border-orange-500/30 text-orange-400";
    case "F": return "bg-red-500/10 border-red-500/30 text-red-400";
    default: return "bg-muted border-muted-foreground/30 text-muted-foreground";
  }
}

function scoreBarColor(score: number): string {
  if (score <= 20) return "bg-emerald-500";
  if (score <= 40) return "bg-blue-500";
  if (score <= 60) return "bg-amber-500";
  if (score <= 80) return "bg-orange-500";
  return "bg-red-500";
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-amber-400";
    case "low": return "text-blue-400";
    default: return "text-muted-foreground";
  }
}

function severityBadgeVariant(severity: string): "danger" | "warning" | "info" | "secondary" {
  switch (severity) {
    case "critical": return "danger";
    case "high": return "warning";
    case "medium": return "info";
    default: return "secondary";
  }
}

// ── GroupRow ─────────────────────────────────────────────────────────────────

function GroupRow({ group }: { group: EntraGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="shrink-0">
          {group.onPremisesSyncEnabled ? (
            <Building2 className="h-4 w-4 text-amber-400" />
          ) : (
            <Cloud className="h-4 w-4 text-blue-400" />
          )}
        </div>
        <div className="w-[200px] shrink-0 min-w-0 md:w-[200px]">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{group.displayName}</p>
            {group.memberCount === 0 && <UserX className="h-3.5 w-3.5 text-red-400 shrink-0" />}
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 md:hidden">{group.description}</p>
          )}
        </div>
        <div className="flex-1 min-w-0 hidden md:block">
          <p className="text-xs text-muted-foreground truncate">{group.description || "\u2014"}</p>
        </div>
        <div className="shrink-0 hidden sm:block">{groupTypeBadge(group.groupType)}</div>
        <div className="shrink-0 w-20 text-center hidden md:block">
          <div className="flex items-center justify-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className={`text-xs font-medium ${group.memberCount === 0 ? "text-red-400" : ""}`}>
              {group.memberCount}
            </span>
          </div>
        </div>
        <div className="shrink-0 w-20 text-center hidden md:block">
          <Badge variant={group.usedInCount > 0 ? "info" : "secondary"} className="text-[10px]">
            {group.usedInCount} {group.usedInCount === 1 ? "policy" : "policies"}
          </Badge>
        </div>
        <div className="shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-accent/10 px-4 py-3 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
            <div><p className="text-muted-foreground">Type</p><p className="font-medium mt-0.5">{group.groupType}</p></div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="font-medium mt-0.5 flex items-center gap-1">
                {group.onPremisesSyncEnabled
                  ? <><Building2 className="h-3 w-3 text-amber-400" /> On-premises synced</>
                  : <><Cloud className="h-3 w-3 text-blue-400" /> Cloud-only</>}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Members</p>
              <p className={`font-medium mt-0.5 ${group.memberCount === 0 ? "text-red-400" : ""}`}>
                {group.memberCount} {group.memberCount === 0 ? "(empty)" : ""}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium mt-0.5">
                {group.createdDateTime ? new Date(group.createdDateTime).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>
          {group.onPremisesSyncEnabled && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-xs">
              {group.onPremisesDomainName && <div><p className="text-muted-foreground">Domain</p><p className="font-medium mt-0.5">{group.onPremisesDomainName}</p></div>}
              {group.onPremisesSamAccountName && <div><p className="text-muted-foreground">SAM Account</p><p className="font-medium mt-0.5 font-mono">{group.onPremisesSamAccountName}</p></div>}
              {group.onPremisesLastSyncDateTime && <div><p className="text-muted-foreground">Last Sync</p><p className="font-medium mt-0.5">{new Date(group.onPremisesLastSyncDateTime).toLocaleString()}</p></div>}
            </div>
          )}
          {group.membershipRule && (
            <div className="text-xs">
              <p className="text-muted-foreground mb-1">Membership Rule</p>
              <code className="block rounded bg-accent/50 p-2 text-[11px] font-mono overflow-x-auto">{group.membershipRule}</code>
            </div>
          )}
          {group.members.length > 0 && (
            <div className="text-xs">
              <p className="text-muted-foreground mb-1.5">Members (showing up to 50)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {group.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-md bg-accent/50 px-2 py-1.5">
                    <UserCheck className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.displayName || "N/A"}</p>
                      <p className="truncate text-muted-foreground text-[10px]">{m.userPrincipalName}</p>
                    </div>
                  </div>
                ))}
              </div>
              {group.memberCount > group.members.length && (
                <p className="text-muted-foreground mt-1">...and {group.memberCount - group.members.length} more</p>
              )}
            </div>
          )}
          {group.usedIn.length > 0 ? (
            <div className="text-xs">
              <p className="text-muted-foreground mb-1.5">Used in ({group.usedIn.length} policies)</p>
              <div className="space-y-1">
                {group.usedIn.map((u, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {policySourceIcon(u.source)}
                      <span className="truncate">{u.policy_name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{u.policy_type}</Badge>
                      {intentBadge(u.intent)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs"><p className="text-muted-foreground">Not used in any policies</p></div>
          )}
          <div className="text-xs">
            <p className="text-muted-foreground">Object ID</p>
            <p className="font-mono text-[11px] mt-0.5 select-all">{group.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Assessment Dialog ───────────────────────────────────────────────────

function AddAssignmentDialog({
  open, onOpenChange, object, collection, onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object: ManagedObject;
  collection: CollectionType;
  onSuccess: () => void;
}) {
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<{ id: string; displayName: string }[]>([]);
  const [intent, setIntent] = useState(collection === "apps" ? "required" : "apply");
  const [operatorId, setOperatorId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [stampOperator, setStampOperator] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const { data: groupResults, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups-search", groupSearch],
    queryFn: () => api.getGroups({ search: groupSearch || undefined }),
    enabled: open && groupSearch.length >= 1,
    staleTime: 30_000,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      api.createAssessment({
        tenant_id: tenantId,
        operator_id: operatorId,
        object_id: object.id,
        object_name: object.displayName,
        collection,
        targets: selectedGroups.map((g) => ({ group_id: g.id, intent })),
        ticket_id: ticketId || null,
        stamp_operator: stampOperator,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.assignments_created} assessment(s) created${result.duplicates_skipped ? `, ${result.duplicates_skipped} skipped` : ""}`);
        onOpenChange(false);
        onSuccess();
        setSelectedGroups([]);
        setValidation(null);
      } else {
        toast.error(result.error || "Assessment failed");
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed: ${err.message}`);
    },
  });

  async function handleValidate() {
    if (selectedGroups.length === 0) {
      toast.error("Select at least one group");
      return;
    }
    setValidating(true);
    try {
      const result = await api.validateAssessment({
        object_id: object.id,
        collection,
        targets: selectedGroups.map((g) => ({ group_id: g.id, intent })),
      });
      setValidation(result);
      if (result.valid) {
        toast.success("Validation passed");
      } else {
        toast.warning("Validation found issues");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  }

  function toggleGroup(group: { id: string; displayName: string }) {
    setSelectedGroups((prev) =>
      prev.some((g) => g.id === group.id)
        ? prev.filter((g) => g.id !== group.id)
        : [...prev, group]
    );
    setValidation(null);
  }

  const intentOptions = collection === "apps"
    ? ["required", "available", "uninstall"]
    : ["apply"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Assessment
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign <span className="font-medium text-foreground">{object.displayName}</span> to groups
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Operator & Tenant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Operator ID *</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="your-email@company.com"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tenant ID *</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="tenant-guid"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              />
            </div>
          </div>

          {/* Intent selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Intent</label>
            <div className="flex gap-2">
              {intentOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setIntent(opt); setValidation(null); }}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    intent === opt
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Group search & selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Groups</label>

            {selectedGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedGroups.map((g) => (
                  <Badge key={g.id} variant="default" className="text-xs pr-1">
                    {g.displayName}
                    <button
                      onClick={() => toggleGroup(g)}
                      className="ml-1.5 rounded-full hover:bg-primary-foreground/20 p-0.5"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search Entra ID groups..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>

            {groupSearch.length >= 1 && (
              <div className="mt-2 max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                {groupsLoading ? (
                  <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : groupResults?.groups.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No groups found</div>
                ) : (
                  groupResults?.groups.slice(0, 20).map((g) => {
                    const isSelected = selectedGroups.some((sg) => sg.id === g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGroup({ id: g.id, displayName: g.displayName })}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-accent/20 transition-colors ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{g.displayName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {groupTypeBadge(g.groupType)}
                            <span className="text-[10px] text-muted-foreground">{g.memberCount} members</span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-2" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Ticket ID & Stamp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ticket ID (optional)</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="JIRA-1234"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={stampOperator}
                  onChange={(e) => setStampOperator(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-xs">Stamp operator ID on object</span>
              </label>
            </div>
          </div>

          {/* Validation results */}
          {validation && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {validation.valid ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Validation Passed</>
                ) : (
                  <><AlertTriangle className="h-4 w-4 text-amber-400" /> Issues Found</>
                )}
              </div>
              {validation.group_checks.map((gc) => (
                <div key={gc.group_id} className="flex items-center gap-2 text-xs">
                  {gc.exists ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-400" />
                  )}
                  <span className="font-mono">{gc.group_id.slice(0, 12)}...</span>
                  {gc.displayName && <span className="text-muted-foreground">({gc.displayName})</span>}
                  {!gc.exists && <span className="text-red-400">Group not found</span>}
                </div>
              ))}
              {validation.duplicates.map((d, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {d.message}
                </div>
              ))}
              {validation.conflicts.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-red-400">
                  <XCircle className="h-3 w-3" />
                  {c.message}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={selectedGroups.length === 0 || validating}
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
              Validate
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={
                selectedGroups.length === 0 ||
                !operatorId ||
                !tenantId ||
                assignMutation.isPending ||
                (validation !== null && !validation.valid)
              }
            >
              {assignMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-1" />
              )}
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Assessment Manager Panel ────────────────────────────────────────────────

function AssignmentManagerPanel() {
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState<CollectionType>("apps");
  const [objectSearch, setObjectSearch] = useState("");
  const [selectedObject, setSelectedObject] = useState<ManagedObject | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const { data: objectsData, isLoading: objectsLoading } = useQuery({
    queryKey: ["manager-objects", collection, objectSearch],
    queryFn: () => api.getManagerObjects(collection, objectSearch || undefined),
    staleTime: 30_000,
  });

  const { data: assignData, isLoading: assignLoading, refetch: refetchAssign } = useQuery({
    queryKey: ["object-assignments", selectedObject?.id, collection],
    queryFn: () => api.getObjectAssessments(selectedObject!.id, collection),
    enabled: !!selectedObject,
    staleTime: 15_000,
  });

  const { data: logsData } = useQuery({
    queryKey: ["assessment-logs", selectedObject?.id],
    queryFn: () => api.getAssessmentLogs({ object_id: selectedObject?.id, limit: 20 }),
    enabled: showLogs && !!selectedObject,
  });

  return (
    <div className="space-y-4">
      {/* Collection selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(COLLECTION_LABELS) as CollectionType[]).map((c) => (
          <button
            key={c}
            onClick={() => { setCollection(c); setSelectedObject(null); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              collection === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {COLLECTION_ICONS[c]}
            {COLLECTION_LABELS[c]}
            {objectsData && collection === c && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{objectsData.total}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Search objects */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={`Search ${COLLECTION_LABELS[collection].toLowerCase()}...`}
          value={objectSearch}
          onChange={(e) => setObjectSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Object list */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {COLLECTION_ICONS[collection]}
                {COLLECTION_LABELS[collection]} ({objectsData?.total ?? "..."})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {objectsData?.error && (
                <div className="px-4 py-3 text-xs text-red-400">{objectsData.error}</div>
              )}
              {objectsLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto divide-y">
                  {objectsData?.objects.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObject(obj)}
                      className={`w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors ${
                        selectedObject?.id === obj.id ? "bg-accent/30 border-l-2 border-primary" : ""
                      }`}
                    >
                      <p className="text-sm font-medium truncate">{obj.displayName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {obj.lastModifiedDateTime
                          ? `Modified: ${new Date(obj.lastModifiedDateTime).toLocaleDateString()}`
                          : obj.id.slice(0, 12) + "..."}
                      </p>
                    </button>
                  ))}
                  {objectsData?.objects.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No objects found</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Assessment detail panel */}
        <div className="lg:col-span-2">
          {!selectedObject ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Select an object from the list to view its assignments</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg">{selectedObject.displayName}</CardTitle>
                    <CardDescription className="font-mono text-[11px]">{selectedObject.id}</CardDescription>
                    {(selectedObject.notes || selectedObject.description) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedObject.notes || selectedObject.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowLogs(!showLogs)}>
                      <History className="h-3.5 w-3.5 mr-1" />
                      Logs
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => refetchAssign()}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={() => setDialogOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Assessment
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current assignments */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Current Assignments ({assignData?.total ?? "..."})
                  </h4>
                  {assignLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : assignData?.assignments.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No assignments. Click &quot;Add Assessment&quot; to assign this object to groups.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {assignData?.assignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-accent shrink-0">
                              {a.group_id ? <Users className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{targetTypeLabel(a.target_type)}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">
                                {a.group_id || "All users/devices"}
                              </p>
                            </div>
                          </div>
                          <div className="ml-2 shrink-0">{intentBadge(a.intent)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit logs */}
                {showLogs && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      Assessment Change Logs ({logsData?.total ?? 0})
                    </h4>
                    {!logsData?.logs.length ? (
                      <p className="text-xs text-muted-foreground">No logs found for this object</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {logsData.logs.map((log) => (
                          <div key={log.id} className="rounded-md bg-accent/30 px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{log.action} by {log.operator_id}</span>
                              <span className="text-muted-foreground">
                                {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                              <span>{log.targets.length} target(s)</span>
                              {log.ticket_id && <Badge variant="outline" className="text-[9px]">#{log.ticket_id}</Badge>}
                              {log.stamp_result && <span className="text-emerald-400">{log.stamp_result}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Assessment Dialog */}
      {selectedObject && (
        <AddAssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          object={selectedObject}
          collection={collection}
          onSuccess={() => {
            refetchAssign();
            queryClient.invalidateQueries({ queryKey: ["assessment-logs"] });
          }}
        />
      )}
    </div>
  );
}

// ── Pillar Score Card ───────────────────────────────────────────────────────

function PillarCard({
  pillarKey,
  pillar,
}: {
  pillarKey: string;
  pillar: ZeroTrustPillar;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = PILLAR_CONFIG[pillarKey];
  if (!config) return null;

  const isAvailable = pillar.available;
  const score = pillar.score;
  const grade = pillar.grade;

  return (
    <Card className={`transition-colors ${!isAvailable ? "opacity-60" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isAvailable ? "bg-accent" : "bg-muted"}`}>
              {config.icon}
            </div>
            <div>
              <p className="text-sm font-semibold">{config.label}</p>
              <p className="text-[10px] text-muted-foreground">Weight: {config.weight}%</p>
            </div>
          </div>
          {isAvailable ? (
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg border text-xl font-black ${gradeBg(grade)}`}>
              {grade}
            </div>
          ) : (
            <Badge variant="secondary" className="text-[10px]">N/A</Badge>
          )}
        </div>

        {/* Score bar */}
        {isAvailable && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Risk Score</span>
              <span className={`font-bold ${gradeColor(grade)}`}>{score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(score)}`}
                style={{ width: `${Math.max(2, score)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message for unavailable pillars */}
        {!isAvailable && pillar.error && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{pillar.error}</span>
          </div>
        )}

        {/* Summary stats */}
        {isAvailable && pillar.summary && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {Object.entries(pillar.summary).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground truncate mr-2">
                  {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span className="font-medium shrink-0">
                  {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        <p className="text-[11px] text-muted-foreground">{config.description}</p>

        {/* Expandable details toggle */}
        {isAvailable && pillar.details && Object.keys(pillar.details).length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}

        {/* Expanded details */}
        {expanded && pillar.details && (
          <div className="space-y-3 pt-1 border-t">
            {Object.entries(pillar.details).map(([key, value]) => {
              if (!Array.isArray(value) || value.length === 0) return null;
              return (
                <div key={key}>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ({value.length})
                  </p>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {value.slice(0, 20).map((item: Record<string, unknown>, idx: number) => {
                      const dn = item.displayName ? String(item.displayName) : "";
                      const rn = item.roleName ? String(item.roleName) : "";
                      const upn = item.userPrincipalName ? String(item.userPrincipalName) : "";
                      const rl = item.riskLevel ? String(item.riskLevel) : "";
                      const mc = item.memberCount != null ? String(item.memberCount) : "";
                      const dsi = item.daysSinceSignIn != null ? String(item.daysSinceSignIn) : "";
                      const ct = item.consentType ? String(item.consentType) : "";
                      const rs = Array.isArray(item.risky_scopes) ? (item.risky_scopes as string[]).join(", ") : "";

                      return (
                        <div key={idx} className="rounded-md bg-accent/30 px-3 py-1.5 text-[11px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            {dn ? <span className="font-medium">{dn}</span> : null}
                            {rn ? <span className="font-medium">{rn}</span> : null}
                            {upn ? <span className="text-muted-foreground">{upn}</span> : null}
                            {rl ? (
                              <Badge variant={rl === "high" ? "danger" : rl === "medium" ? "warning" : "secondary"} className="text-[9px]">
                                {rl}
                              </Badge>
                            ) : null}
                            {item.isCritical === true ? (
                              <Badge variant="danger" className="text-[9px]">Critical</Badge>
                            ) : null}
                            {mc ? <span className="text-muted-foreground">{mc} members</span> : null}
                            {dsi ? <span className="text-amber-400">{dsi}d inactive</span> : null}
                            {item.phishing_resistant === true ? (
                              <Badge variant="success" className="text-[9px]">Phishing-resistant</Badge>
                            ) : null}
                            {ct ? <Badge variant="outline" className="text-[9px]">{ct}</Badge> : null}
                            {rs ? <span className="text-red-400 text-[10px]">{rs}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                    {value.length > 20 && (
                      <p className="text-[10px] text-muted-foreground mt-1">...and {value.length - 20} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Zero Trust Assessment Panel ─────────────────────────────────────────────

function ZeroTrustAssessmentPanel() {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data: assessment, isLoading, error, refetch } = useQuery({
    queryKey: ["zero-trust-assessment"],
    queryFn: () => api.getZeroTrustAssessment(50),
    staleTime: 5 * 60_000, // 5 min stale time (expensive call)
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Running Zero Trust Assessment</p>
            <p className="text-sm text-muted-foreground mt-1">
              Fetching data from 9+ Graph API endpoints in parallel...
            </p>
            <p className="text-xs text-muted-foreground mt-3">This may take 10-30 seconds depending on tenant size.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-red-400 mb-4" />
          <p className="text-lg font-medium text-red-400">Assessment Failed</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry Assessment
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!assessment) return null;

  const pillarOrder = ["user_risk", "mfa_coverage", "privilege_exposure", "ca_coverage", "access_footprint", "account_lifecycle", "group_risk"];

  return (
    <div className="space-y-6">
      {/* Permission warnings */}
      {!assessment.permissions_status.all_granted && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">Missing Graph API Permissions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Some pillars require additional permissions: {assessment.permissions_status.missing.join(", ")}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {assessment.permissions_status.checks.map((c) => (
                <Badge
                  key={c.permission}
                  variant={c.status === "granted" ? "success" : c.status === "denied" ? "danger" : "warning"}
                  className="text-[10px]"
                >
                  {c.permission}: {c.status}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Composite Score Card */}
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Score gauge */}
            <div className="flex flex-col items-center">
              <div className={`relative flex items-center justify-center h-28 w-28 rounded-full border-4 ${
                assessment.composite_grade === "A" ? "border-emerald-500" :
                assessment.composite_grade === "B" ? "border-blue-500" :
                assessment.composite_grade === "C" ? "border-amber-500" :
                assessment.composite_grade === "D" ? "border-orange-500" :
                assessment.composite_grade === "F" ? "border-red-500" : "border-muted"
              }`}>
                <div className="text-center">
                  <p className={`text-4xl font-black ${gradeColor(assessment.composite_grade)}`}>
                    {assessment.composite_grade}
                  </p>
                  <p className="text-sm font-bold text-muted-foreground">{assessment.composite_score}/100</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Composite Score</p>
            </div>

            {/* Assessment info */}
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  Zero Trust Identity Assessment
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {assessment.tenant_user_count} users assessed across 7 security pillars
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">{assessment.assessment_duration_seconds}s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Users:</span>
                  <span className="font-medium">{assessment.tenant_user_count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{new Date(assessment.assessment_time).toLocaleString()}</span>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Re-run Assessment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pillar Score Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Security Pillars
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pillarOrder.map((key) => {
            const pillar = assessment.pillars[key];
            if (!pillar) return null;
            return <PillarCard key={key} pillarKey={key} pillar={pillar} />;
          })}
        </div>
      </div>

      {/* Top Risk Users Table */}
      {assessment.top_risk_users.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Top Risk Users ({assessment.top_risk_users.length})
          </h3>
          <Card>
            <CardContent className="p-0">
              {/* Table header */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2.5 text-[11px] font-medium text-muted-foreground border-b">
                <span className="w-6 shrink-0"></span>
                <span className="w-[220px] shrink-0">User</span>
                <span className="w-24 text-center">Score</span>
                <span className="w-16 text-center">Grade</span>
                <span className="w-20 text-center">Type</span>
                <span className="w-20 text-center">Status</span>
                <span className="flex-1">Risk Factors</span>
                <span className="w-5 shrink-0"></span>
              </div>

              <div className="divide-y max-h-[600px] overflow-y-auto">
                {assessment.top_risk_users.map((user, idx) => {
                  const userGrade = user.risk_score <= 20 ? "A" : user.risk_score <= 40 ? "B" : user.risk_score <= 60 ? "C" : user.risk_score <= 80 ? "D" : "F";
                  const isExpanded = expandedUser === user.id;

                  return (
                    <div key={user.id}>
                      <button
                        onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent/20 transition-colors"
                      >
                        <span className="w-6 text-xs text-muted-foreground font-mono shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="w-[220px] shrink-0 min-w-0">
                          <p className="text-sm font-medium truncate">{user.displayName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{user.userPrincipalName}</p>
                        </div>
                        <div className="w-24 text-center hidden md:block">
                          <div className="inline-flex items-center gap-1.5">
                            <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${scoreBarColor(user.risk_score)}`}
                                style={{ width: `${Math.max(4, user.risk_score)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${gradeColor(userGrade)}`}>{user.risk_score}</span>
                          </div>
                        </div>
                        <div className="w-16 text-center hidden md:block">
                          <span className={`text-sm font-black ${gradeColor(userGrade)}`}>{userGrade}</span>
                        </div>
                        <div className="w-20 text-center hidden md:block">
                          <Badge variant={user.userType === "Guest" ? "warning" : "secondary"} className="text-[10px]">
                            {user.userType}
                          </Badge>
                        </div>
                        <div className="w-20 text-center hidden md:block">
                          <Badge variant={user.accountEnabled ? "success" : "danger"} className="text-[10px]">
                            {user.accountEnabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex-1 hidden md:flex items-center gap-1 flex-wrap">
                          {user.risk_factors.slice(0, 3).map((f, fi) => (
                            <Badge key={fi} variant={severityBadgeVariant(f.severity)} className="text-[9px]">
                              {f.factor.length > 30 ? f.factor.slice(0, 30) + "..." : f.factor}
                            </Badge>
                          ))}
                          {user.risk_factors.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{user.risk_factors.length - 3}</span>
                          )}
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>

                      {/* Mobile score info */}
                      {!isExpanded && (
                        <div className="flex items-center gap-2 px-4 pb-2 md:hidden">
                          <span className={`text-sm font-black ${gradeColor(userGrade)}`}>{userGrade}</span>
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${scoreBarColor(user.risk_score)}`}
                              style={{ width: `${Math.max(4, user.risk_score)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{user.risk_score}</span>
                          <Badge variant={user.accountEnabled ? "success" : "danger"} className="text-[9px]">
                            {user.accountEnabled ? "Active" : "Off"}
                          </Badge>
                        </div>
                      )}

                      {/* Expanded risk factors */}
                      {isExpanded && (
                        <div className="border-t bg-accent/10 px-4 py-3 space-y-3">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                            <div>
                              <p className="text-muted-foreground">Risk Score</p>
                              <p className={`text-lg font-black mt-0.5 ${gradeColor(userGrade)}`}>{user.risk_score}/100</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Grade</p>
                              <p className={`text-lg font-black mt-0.5 ${gradeColor(userGrade)}`}>{userGrade}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Account Type</p>
                              <p className="font-medium mt-0.5">{user.userType}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Account Status</p>
                              <p className={`font-medium mt-0.5 ${user.accountEnabled ? "text-emerald-400" : "text-red-400"}`}>
                                {user.accountEnabled ? "Enabled" : "Disabled"}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Risk Factors ({user.risk_factors.length})
                            </p>
                            <div className="space-y-1.5">
                              {user.risk_factors.map((factor, fi) => (
                                <div
                                  key={fi}
                                  className="flex items-center gap-3 rounded-md bg-accent/50 px-3 py-2"
                                >
                                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                                    factor.severity === "critical" ? "bg-red-500" :
                                    factor.severity === "high" ? "bg-orange-500" :
                                    factor.severity === "medium" ? "bg-amber-500" :
                                    "bg-blue-500"
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium">{factor.factor}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Pillar: {PILLAR_CONFIG[factor.pillar]?.label || factor.pillar}
                                    </p>
                                  </div>
                                  <Badge variant={severityBadgeVariant(factor.severity)} className="text-[9px] shrink-0">
                                    {factor.severity}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="text-xs">
                            <p className="text-muted-foreground">User ID</p>
                            <p className="font-mono text-[11px] mt-0.5 select-all">{user.id}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function IdentityGuidancePanel() {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["identity-guidance-run"],
    queryFn: api.getIdentityRun,
    enabled: false,
  });

  const runData = data as IdentityRunResponse | undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Identity Guidance Runner
          </CardTitle>
          <CardDescription>
            Run a checklist aligned to Microsoft Entra identity security guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              {isFetching ? "Running..." : "Run Identity Check"}
            </Button>
            <a href="https://learn.microsoft.com/en-us/entra/fundamentals/configure-security?toc=%2Fsecurity%2Fzero-trust%2Fassessment%2Ftoc.json&bc=%2Fsecurity%2Fzero-trust%2Fassessment%2Ftoc.json" target="_blank" rel="noreferrer">
              <Button variant="outline">
                Open Microsoft Guidance
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
          {error && (
            <p className="text-sm text-red-400">
              {error instanceof Error ? error.message : "Failed to run identity check."}
            </p>
          )}
        </CardContent>
      </Card>

      {runData && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Total Controls</p>
                <p className="text-2xl font-bold">{runData.summary.total_controls}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-red-400">{runData.summary.high_priority}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Medium Priority</p>
                <p className="text-2xl font-bold text-amber-400">{runData.summary.medium_priority}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Identity Controls</CardTitle>
              <CardDescription>Run time: {new Date(runData.run_at).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {runData.controls.map((theme) => (
                <div key={theme.theme} className="rounded-lg border p-4">
                  <p className="font-medium">{theme.theme}</p>
                  <div className="mt-3 space-y-2">
                    {theme.checks.map((item) => (
                      <div key={`${theme.theme}-${item.control}`} className="flex items-center justify-between gap-3 rounded-md bg-accent/40 p-2 text-xs">
                        <span>{item.control}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={item.priority === "high" ? "danger" : "warning"}>{item.priority}</Badge>
                          <Badge variant="secondary">{item.license}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ideas To Add More</CardTitle>
              <CardDescription>Suggested improvements for your assistant and identity operations.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {runData.ideas_to_add_more.map((idea) => (
                  <li key={idea} className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{idea}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const [tab, setTab] = useState<TabView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupTypeFilter, setGroupTypeFilter] = useState("");
  const [syncedFilter, setSyncedFilter] = useState("");
  const [membersFilter, setMembersFilter] = useState("");

  const { data: appData, isLoading: appLoading } = useQuery({
    queryKey: ["assignments-apps", searchQuery],
    queryFn: () => api.getAppAssessments(searchQuery || undefined),
    enabled: tab === "apps",
  });

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["entra-groups", searchQuery, groupTypeFilter, syncedFilter, membersFilter],
    queryFn: () => api.getGroups({
      search: searchQuery || undefined,
      group_type: groupTypeFilter || undefined,
      synced: syncedFilter || undefined,
      has_members: membersFilter || undefined,
    }),
    enabled: tab === "groups",
    staleTime: 60_000,
  });

  const isLoading = tab === "apps" ? appLoading : tab === "groups" ? groupsLoading : false;
  const summary = groupsData?.summary;

  return (
    <div className="space-y-8">
      <PageHeader title="Intune Assessment Center" description="Assessment Management, Analytics & Zero Trust Assessment" />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{appData?.total ?? "..."}</p>
            <p className="text-xs text-muted-foreground mt-1">App Assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">{groupsData?.total ?? "..."}</p>
            <p className="text-xs text-muted-foreground mt-1">Entra Groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Shield className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">{summary?.with_policies ?? "..."}</p>
            <p className="text-xs text-muted-foreground mt-1">Groups with Policies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <ClipboardList className="h-6 w-6 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold">Live</p>
            <p className="text-xs text-muted-foreground mt-1">Assessment Manager</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab selector cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <button onClick={() => setTab("all")} className="text-left">
          <Card className={`h-full transition-colors ${tab === "all" ? "border-primary/50" : "hover:border-primary/30"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={tab === "all" ? "default" : "secondary"} className="text-[10px]">
                  {tab === "all" ? "ACTIVE" : "VIEW"}
                </Badge>
              </div>
              <CardTitle className="text-lg">All Assignments</CardTitle>
              <CardDescription>Browse and manage assignments for apps, configs, and compliance policies live from Graph API.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><ListFilter className="h-3.5 w-3.5 text-primary" /> Live Graph API browsing</li>
                <li className="flex items-center gap-2"><Plus className="h-3.5 w-3.5 text-emerald-400" /> Create assignments</li>
                <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-400" /> Conflict detection</li>
              </ul>
            </CardContent>
          </Card>
        </button>

        <button onClick={() => setTab("apps")} className="text-left">
          <Card className={`h-full transition-colors ${tab === "apps" ? "border-primary/50" : "hover:border-primary/30"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={tab === "apps" ? "default" : "secondary"} className="text-[10px]">
                  {tab === "apps" ? "ACTIVE" : "VIEW"}
                </Badge>
              </div>
              <CardTitle className="text-lg">App Assignments</CardTitle>
              <CardDescription>Application deployment tracking and distribution monitoring.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><AppWindow className="h-3.5 w-3.5 text-amber-400" /> Application deployment tracking and distribution monitoring</li>
                <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-emerald-400" /> App deployment tracking</li>
                <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-400" /> Install analysis</li>
                <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-blue-400" /> Distribution analytics</li>
              </ul>
            </CardContent>
          </Card>
        </button>

        <button onClick={() => setTab("groups")} className="text-left">
          <Card className={`h-full transition-colors ${tab === "groups" ? "border-primary/50" : "hover:border-primary/30"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={tab === "groups" ? "default" : "secondary"} className="text-[10px]">
                  {tab === "groups" ? "ACTIVE" : "VIEW"}
                </Badge>
              </div>
              <CardTitle className="text-lg">Group Assignments</CardTitle>
              <CardDescription>All Entra ID groups with members, sync status, and policy usage.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-emerald-400" /> Full group inventory</li>
                <li className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5 text-amber-400" /> Policy usage tracking</li>
                <li className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-blue-400" /> Member visibility</li>
              </ul>
            </CardContent>
          </Card>
        </button>

        <button onClick={() => setTab("assessment")} className="text-left">
          <Card className={`h-full transition-colors ${tab === "assessment" ? "border-primary/50" : "hover:border-primary/30"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={tab === "assessment" ? "default" : "secondary"} className="text-[10px]">
                  {tab === "assessment" ? "ACTIVE" : "LOAD"}
                </Badge>
              </div>
              <CardTitle className="text-lg">User Assessment</CardTitle>
              <CardDescription>Browse users, risk signals, and security posture details from Graph.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-primary" /> Search + filters</li>
                <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-emerald-400" /> Per-user details</li>
                <li className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Risk-driven insights</li>
              </ul>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                Load User Assessment <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </div>
            </CardContent>
          </Card>
        </button>

        <button onClick={() => setTab("identity")} className="text-left">
          <Card className={`h-full transition-colors ${tab === "identity" ? "border-primary/50" : "hover:border-primary/30"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge variant={tab === "identity" ? "default" : "secondary"} className="text-[10px]">
                  {tab === "identity" ? "ACTIVE" : "RUN"}
                </Badge>
              </div>
              <CardTitle className="text-lg">Identity</CardTitle>
              <CardDescription>Run Microsoft Entra identity security guidance checks.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Guided control checklist</li>
                <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-amber-400" /> Identity hardening priorities</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-primary" /> Run + open guidance</li>
              </ul>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Search + filters (only for apps and groups tabs) */}
      {(tab === "apps" || tab === "groups") && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={tab === "groups" ? "Search groups by name, description, or ID..." : "Search assignments..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {tab === "groups" && (
            <>
              <select
                value={groupTypeFilter}
                onChange={(e) => setGroupTypeFilter(e.target.value)}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                <option value="Security">Security</option>
                <option value="Microsoft 365">Microsoft 365</option>
                <option value="Dynamic Security">Dynamic Security</option>
                <option value="Distribution">Distribution</option>
                <option value="Mail-enabled Security">Mail-enabled Security</option>
              </select>
              <select
                value={syncedFilter}
                onChange={(e) => setSyncedFilter(e.target.value)}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">All Sources</option>
                <option value="true">Synced from AD</option>
                <option value="false">Cloud-only</option>
              </select>
              <select
                value={membersFilter}
                onChange={(e) => setMembersFilter(e.target.value)}
                className="rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">All Groups</option>
                <option value="true">Has Members</option>
                <option value="false">Empty Groups</option>
              </select>
            </>
          )}
        </div>
      )}

      {/* Groups summary row */}
      {tab === "groups" && summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(summary.by_type).map(([type, count]) => (
            <button key={type} onClick={() => setGroupTypeFilter(groupTypeFilter === type ? "" : type)} className="text-left">
              <Card className={`transition-colors ${groupTypeFilter === type ? "border-primary/50" : "hover:border-primary/20"}`}>
                <CardContent className="p-3">
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{type}</p>
                </CardContent>
              </Card>
            </button>
          ))}
          <Card>
            <CardContent className="p-3">
              <p className="text-lg font-bold flex items-center gap-1">
                <Building2 className="h-4 w-4 text-amber-400" />
                {summary.synced}
              </p>
              <p className="text-[10px] text-muted-foreground">Synced from AD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-lg font-bold flex items-center gap-1">
                <UserX className="h-4 w-4 text-red-400" />
                {summary.empty_groups}
              </p>
              <p className="text-[10px] text-muted-foreground">Empty Groups</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content area */}
      {tab === "all" ? (
        <AssignmentManagerPanel />
      ) : tab === "assessment" ? (
        <ZeroTrustAssessmentPanel />
      ) : tab === "identity" ? (
        <IdentityGuidancePanel />
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          {/* App Assignments view */}
          {tab === "apps" && (
            <Card>
              <CardHeader>
                <CardTitle>App Assignments ({appData?.total ?? 0})</CardTitle>
                <CardDescription>Track which applications are assigned to specific users.</CardDescription>
                <div className="mt-2">
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-primary" /> Per-user app view</li>
                    <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-emerald-400" /> Install status</li>
                    <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-blue-400" /> Usage analytics</li>
                  </ul>
                </div>
              </CardHeader>
              <CardContent>
                {!appData?.apps.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No app assignments found. Run App Assessment monitors first.</p>
                ) : (
                  <div className="space-y-3">
                    {appData.apps.map((app) => (
                      <div key={app.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{app.display_name}</p>
                            <p className="text-xs text-muted-foreground">{app.publisher}</p>
                          </div>
                          <Badge variant="secondary">{app.assignment_count} assignments</Badge>
                        </div>
                        {app.assignments.length > 0 && (
                          <div className="space-y-1.5">
                            {app.assignments.map((a, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-1.5 text-xs">
                                <span className="text-muted-foreground truncate">
                                  {a.target_group_id ? `Group: ${a.target_group_id.slice(0, 12)}...` : "All users/devices"}
                                </span>
                                {intentBadge(a.intent)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Group Assignments view */}
          {tab === "groups" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Entra ID Groups ({groupsData?.total ?? 0})
                    </CardTitle>
                    <CardDescription>All groups from Microsoft Entra ID with members, sync status, and policy assignments</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-medium text-muted-foreground border-b mt-4 hidden md:flex">
                  <span className="w-5 shrink-0"></span>
                  <span className="w-[200px] shrink-0">Group</span>
                  <span className="flex-1">Description</span>
                  <span className="w-28 text-center">Type</span>
                  <span className="w-20 text-center">Members</span>
                  <span className="w-20 text-center">Policies</span>
                  <span className="w-5 shrink-0"></span>
                </div>
              </CardHeader>
              <CardContent>
                {groupsData?.error ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-red-400" />
                    <p className="text-sm text-red-400 font-medium">Failed to load groups</p>
                    <p className="text-xs text-muted-foreground mt-1">{groupsData.error}</p>
                    <p className="text-xs text-muted-foreground mt-2">Make sure Group.Read.All (Application) permission is granted.</p>
                  </div>
                ) : !groupsData?.groups.length ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No groups found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupsData.groups.map((group) => (
                      <GroupRow key={group.id} group={group} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
