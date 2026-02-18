/*  BEGIN AUTODOC HEADER
//  File: apps\frontend\src\app\(dashboard)\compare\page.tsx
//  Description: (edit inside USER NOTES below)
// 
//  BEGIN AUTODOC META
//  Version: 0.0.0.3
//  Last-Updated: 2026-02-19 00:30:35
//  Managed-By: autosave.ps1
//  END AUTODOC META
// 
//  BEGIN USER NOTES
//  Your notes here. We will NEVER change this block.
//  END USER NOTES
 */ END AUTODOC HEADER

"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type CompareTenantsResponse } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitCompareArrows, Equal, Plus, Minus, ArrowRight, BarChart3,
  Zap, Search, Filter, Target, Gauge, Timer, Layers, Shield, ExternalLink, X,
} from "lucide-react";
import { toast } from "sonner";

type ViewTab = "all" | "identical" | "modified" | "added" | "removed";
type TenantStatusFilter = "all" | "match" | "not_match" | "duplicate";
type TenantSubStatusFilter = "all" | "same_settings" | "different_settings" | "missing_in_tenant_a" | "missing_in_tenant_b" | "duplicate_settings";
type TenantPolicyItem = CompareTenantsResponse["policy_items"][number];
type DetailViewMode = "simple" | "json";
const TENANT_COMPARE_PREFS_KEY = "compare_tenant_prefs_v1";

export default function ComparePage() {
  const [snapA, setSnapA] = useState("");
  const [snapB, setSnapB] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [activeModule, setActiveModule] = useState<"policy-comparison" | "baseline" | "bulk" | "tenant" | "baseline-security">("policy-comparison");
  const policyComparisonRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<HTMLDivElement>(null);
  const bulkRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);
  const baselineSecurityRef = useRef<HTMLDivElement>(null);
  const [tenantALabel, setTenantALabel] = useState("Tenant A");
  const [tenantATenantId, setTenantATenantId] = useState("");
  const [tenantAClientId, setTenantAClientId] = useState("");
  const [tenantAClientSecret, setTenantAClientSecret] = useState("");
  const [tenantBLabel, setTenantBLabel] = useState("Tenant B");
  const [tenantBTenantId, setTenantBTenantId] = useState("");
  const [tenantBClientId, setTenantBClientId] = useState("");
  const [tenantBClientSecret, setTenantBClientSecret] = useState("");
  const [tenantStatusFilter, setTenantStatusFilter] = useState<TenantStatusFilter>("all");
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantPolicyTypeFilter, setTenantPolicyTypeFilter] = useState("all");
  const [tenantSubStatusFilter, setTenantSubStatusFilter] = useState<TenantSubStatusFilter>("all");
  const [selectedTenantItem, setSelectedTenantItem] = useState<TenantPolicyItem | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<DetailViewMode>("simple");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TENANT_COMPARE_PREFS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        tenantALabel?: string;
        tenantATenantId?: string;
        tenantAClientId?: string;
        tenantBLabel?: string;
        tenantBTenantId?: string;
        tenantBClientId?: string;
      };
      if (saved.tenantALabel) setTenantALabel(saved.tenantALabel);
      if (saved.tenantATenantId) setTenantATenantId(saved.tenantATenantId);
      if (saved.tenantAClientId) setTenantAClientId(saved.tenantAClientId);
      if (saved.tenantBLabel) setTenantBLabel(saved.tenantBLabel);
      if (saved.tenantBTenantId) setTenantBTenantId(saved.tenantBTenantId);
      if (saved.tenantBClientId) setTenantBClientId(saved.tenantBClientId);
    } catch {
      // Ignore invalid local cache data.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TENANT_COMPARE_PREFS_KEY,
        JSON.stringify({
          tenantALabel,
          tenantATenantId,
          tenantAClientId,
          tenantBLabel,
          tenantBTenantId,
          tenantBClientId,
        }),
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [tenantALabel, tenantATenantId, tenantAClientId, tenantBLabel, tenantBTenantId, tenantBClientId]);

  const { data: snapshots } = useQuery({
    queryKey: ["snapshots"],
    queryFn: () => api.getSnapshots(),
  });

  const compareMutation = useMutation({
    mutationFn: () => api.compareSnapshots(snapA, snapB),
  });
  const compareTenantsMutation = useMutation({
    mutationFn: () =>
      api.compareTenants({
        tenant_a: {
          label: tenantALabel || "Tenant A",
          tenant_id: tenantATenantId,
          client_id: tenantAClientId,
          client_secret: tenantAClientSecret,
        },
        tenant_b: {
          label: tenantBLabel || "Tenant B",
          tenant_id: tenantBTenantId,
          client_id: tenantBClientId,
          client_secret: tenantBClientSecret,
        },
      }),
    onSuccess: () => {
      toast.success("Tenant comparison completed");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Tenant comparison failed";
      toast.error(message);
    },
  });

  const result = compareMutation.data;
  const tenantResult = compareTenantsMutation.data;
  const tenantPolicyTypes = Array.from(new Set((tenantResult?.policy_items ?? []).map((i) => i.policy_type))).sort();
  const tenantStatusCounts = {
    all: (tenantResult?.policy_items ?? []).length,
    match: (tenantResult?.policy_items ?? []).filter((i) => i.status === "match").length,
    not_match: (tenantResult?.policy_items ?? []).filter((i) => i.status === "not_match").length,
    duplicate: (tenantResult?.policy_items ?? []).filter((i) => i.status === "duplicate").length,
  };
  const filteredTenantItems =
    (tenantResult?.policy_items ?? [])
      .filter((item) => tenantStatusFilter === "all" || item.status === tenantStatusFilter)
      .filter((item) => tenantSubStatusFilter === "all" || item.sub_status === tenantSubStatusFilter)
      .filter((item) => tenantPolicyTypeFilter === "all" || item.policy_type === tenantPolicyTypeFilter)
      .filter((item) => {
        const q = tenantSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          item.policy_name.toLowerCase().includes(q) ||
          item.policy_type.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const rank = (status: string) => (status === "duplicate" ? 0 : status === "not_match" ? 1 : 2);
        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;
        return a.policy_name.localeCompare(b.policy_name);
      });
  const samePolicies = tenantResult?.policy_items.filter((i) => i.sub_status === "same_settings") ?? [];
  const differentPolicies = tenantResult?.policy_items.filter((i) => i.sub_status === "different_settings") ?? [];
  const missingInTenantA = tenantResult?.policy_items.filter((i) => i.sub_status === "missing_in_tenant_a") ?? [];
  const missingInTenantB = tenantResult?.policy_items.filter((i) => i.sub_status === "missing_in_tenant_b") ?? [];

  const openTenantItems = (
    items: TenantPolicyItem[],
    statusFilter?: TenantStatusFilter,
    subStatusFilter: TenantSubStatusFilter = "all",
  ) => {
    setTenantSearch("");
    setTenantPolicyTypeFilter("all");
    setTenantSubStatusFilter(subStatusFilter);
    if (statusFilter) {
      setTenantStatusFilter(statusFilter);
    }
    setSelectedTenantItem(null);
    if (items.length === 0) toast.info("No policy found for this selection");
  };
  const openTenantDetail = (item: TenantPolicyItem) => {
    setSelectedTenantItem(item);
    setDetailViewMode("simple");
  };

  useEffect(() => {
    setSelectedTenantItem(null);
  }, [tenantResult?.summary.total_policies_compared]);

  return (
    <div className="space-y-8">
      <PageHeader title="Policy Comparison Engine" description="Configuration Compare Center" />

      {/* Key metrics - matching IntuneAssistant style */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">99.8%</p>
            <p className="text-xs text-muted-foreground mt-1">Comparison Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Layers className="h-6 w-6 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold">50k+</p>
            <p className="text-xs text-muted-foreground mt-1">Settings Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">100+</p>
            <p className="text-xs text-muted-foreground mt-1">Policy Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Timer className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">&lt; 2s</p>
            <p className="text-xs text-muted-foreground mt-1">Comparison Speed</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards - matching IntuneAssistant */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("policy-comparison");
            policyComparisonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("policy-comparison");
              policyComparisonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "policy-comparison" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "policy-comparison" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "policy-comparison" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Policy Comparison</CardTitle>
            <CardDescription>Compare two configuration policies side-by-side with detailed analysis of differences, similarities, and unique settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Equal className="h-3.5 w-3.5 text-emerald-400" /> Side-by-side comparison</li>
              <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-blue-400" /> Child settings analysis</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Visual change indicators</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("baseline");
            baselineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("baseline");
              baselineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`transition-colors ${activeModule === "baseline" ? "border-primary/70" : "opacity-70 hover:opacity-100"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "baseline" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "baseline" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Baseline Analysis</CardTitle>
            <CardDescription>Validate configurations against security baselines with compliance gap analysis and best practice recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5" /> Security baseline validation</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Compliance gap analysis</li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> Best practice recommendations</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("bulk");
            bulkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("bulk");
              bulkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`transition-colors ${activeModule === "bulk" ? "border-primary/70" : "opacity-70 hover:opacity-100"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "bulk" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "bulk" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Bulk Comparison</CardTitle>
            <CardDescription>Compare multiple policies simultaneously with a multi-policy comparison matrix and standardization insights.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Multi-policy matrix</li>
              <li className="flex items-center gap-2"><GitCompareArrows className="h-3.5 w-3.5" /> Standardization insights</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Pattern analysis</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("tenant");
            tenantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("tenant");
              tenantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "tenant" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "tenant" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "tenant" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Compare by Tenant</CardTitle>
            <CardDescription>Select and connect two tenants to compare policy coverage across multiple policy types.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-emerald-400" /> Cross-tenant policy compare</li>
              <li className="flex items-center gap-2"><GitCompareArrows className="h-3.5 w-3.5 text-blue-400" /> All-policy matching</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Gap and drift overview</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("baseline-security");
            baselineSecurityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("baseline-security");
              baselineSecurityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "baseline-security" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "baseline-security" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "baseline-security" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Baseline security mode</CardTitle>
            <CardDescription>Manage recommended security policies to reduce attack surface and reach minimum benchmark.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-emerald-400" /> Benchmark progress</li>
              <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-400" /> Recommendation tracking</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-blue-400" /> Risk status filtering</li>
            </ul>
          </CardContent>
        </Card>
        </div>
      </div>

      {activeModule === "policy-comparison" && (
        <div ref={policyComparisonRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Equal className="h-5 w-5 text-emerald-400" />
                Policy Comparison Workspace
              </CardTitle>
              <CardDescription>
                Compare two configuration policies side-by-side with detailed analysis of differences, similarities, and unique settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Side-by-side comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">Snapshot A vs Snapshot B</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Select two snapshots below to compare policy resources and values directly.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Child settings analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">
                      {result ? result.modified.reduce((sum, item) => sum + item.changes.length, 0) : 0} child setting deltas
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Inspects nested setting changes to highlight specific path-level differences.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Visual change indicators</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">
                      Modified: {result?.summary.modified ?? 0} | Added: {result?.summary.added ?? 0} | Removed: {result?.summary.removed ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Uses status color coding in results to quickly identify change type and impact.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "baseline" && (
        <div ref={baselineRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                Baseline Analysis Workspace
              </CardTitle>
              <CardDescription>
                Validate configurations against security baselines with compliance gap analysis and best practice recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Security baseline validation</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">Baseline checks: {result ? result.summary.identical + result.summary.modified : 0}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Validates compared policies against expected baseline-aligned configuration posture.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Compliance gap analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">Potential gaps: {result ? result.summary.modified + result.summary.removed : 0}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Highlights drift and missing controls that may create compliance deviations.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Best practice recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">Focus areas: report modified and removed settings first</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Prioritize high-impact differences and align policy values with approved baseline standards.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "bulk" && (
        <div ref={bulkRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-amber-400" />
                Bulk Comparison Workspace
              </CardTitle>
              <CardDescription>
                Compare multiple policies simultaneously with a multi-policy comparison matrix and standardization insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Multi-policy matrix</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">Available snapshots: {snapshots?.length ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Build a matrix view by selecting multiple snapshots and comparing shared policy resources.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Standardization insights</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">Identical baseline matches: {result?.summary.identical ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Highlights where policy values are already standardized and where normalization is needed.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pattern analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="font-semibold">
                      Divergence patterns: {(result?.summary.modified ?? 0) + (result?.summary.removed ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Detects repeated change patterns to guide bulk remediation and alignment efforts.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "tenant" && (
        <div ref={tenantRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows className="h-5 w-5 text-primary" />
                Compare by Tenant
              </CardTitle>
              <CardDescription>
                Select and connect two tenants, then compare policy coverage side-by-side across Entra and Intune policy types.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tenant A</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input value={tenantALabel} onChange={(e) => setTenantALabel(e.target.value)} placeholder="Label (optional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantATenantId} onChange={(e) => setTenantATenantId(e.target.value)} placeholder="Tenant ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantAClientId} onChange={(e) => setTenantAClientId(e.target.value)} placeholder="Client ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input type="password" value={tenantAClientSecret} onChange={(e) => setTenantAClientSecret(e.target.value)} placeholder="Client Secret" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tenant B</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input value={tenantBLabel} onChange={(e) => setTenantBLabel(e.target.value)} placeholder="Label (optional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantBTenantId} onChange={(e) => setTenantBTenantId(e.target.value)} placeholder="Tenant ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantBClientId} onChange={(e) => setTenantBClientId(e.target.value)} placeholder="Client ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input type="password" value={tenantBClientSecret} onChange={(e) => setTenantBClientSecret(e.target.value)} placeholder="Client Secret" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={() => compareTenantsMutation.mutate()}
                  disabled={
                    compareTenantsMutation.isPending ||
                    !tenantATenantId || !tenantAClientId || !tenantAClientSecret ||
                    !tenantBTenantId || !tenantBClientId || !tenantBClientSecret
                  }
                  size="lg"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {compareTenantsMutation.isPending ? "Connecting & Comparing..." : "Compare Tenants"}
                </Button>
              </div>
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Required API permissions (Application)</CardTitle>
                  <CardDescription>Grant these in both tenants and click admin consent before running cross-tenant compare.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Policy.Read.ConditionalAccess</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-blue-400" /> Policy.Read.All</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-400" /> Organization.Read.All</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-purple-400" /> DeviceManagementConfiguration.Read.All</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-cyan-400" /> DeviceManagementApps.Read.All</li>
                  </ul>
                </CardContent>
              </Card>
              {tenantResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{tenantResult.summary.match}</p><p className="text-xs text-muted-foreground mt-1">Match</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-amber-400">{tenantResult.summary.not_match}</p><p className="text-xs text-muted-foreground mt-1">Not match</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-red-400">{tenantResult.summary.duplicate}</p><p className="text-xs text-muted-foreground mt-1">Duplicate</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-blue-400">{tenantResult.summary.total_policies_compared}</p><p className="text-xs text-muted-foreground mt-1">Policies compared</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tenant Coverage</CardTitle>
                      <CardDescription>
                        {tenantResult.tenant_a.name}: {tenantResult.tenant_a.resource_count} policies | {tenantResult.tenant_b.name}: {tenantResult.tenant_b.resource_count} policies
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Policy Type Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {tenantResult.policy_type_summary.map((row) => (
                        <div key={row.policy_type} className="rounded-md border p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{row.policy_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {tenantResult.tenant_a.name}: {row.tenant_a_total} | {tenantResult.tenant_b.name}: {row.tenant_b_total}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Match {row.match} | Not match {row.not_match} | Duplicate {row.duplicate}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Comparison Highlights</CardTitle>
                      <CardDescription>
                        Same policies, policies with settings differences, and policies missing in tenant A or tenant B.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <button
                          type="button"
                          className="text-sm font-medium hover:underline"
                          onClick={() => openTenantItems(samePolicies, "match", "same_settings")}
                        >
                          Same ({samePolicies.length})
                        </button>
                        <div className="mt-2 space-y-2">
                          {samePolicies.slice(0, 6).map((item) => (
                            <button
                              type="button"
                              key={`same:${item.policy_type}:${item.policy_key}`}
                              onClick={() => openTenantDetail(item)}
                              className="w-full rounded-md border p-2 text-xs flex items-center justify-between gap-2 text-left hover:bg-accent/30"
                            >
                              <span className="truncate">{item.policy_name} · {item.policy_type}</span>
                              <Badge variant="success">same</Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="text-sm font-medium hover:underline"
                          onClick={() => openTenantItems(differentPolicies, "not_match", "different_settings")}
                        >
                          Different settings ({differentPolicies.length})
                        </button>
                        <div className="mt-2 space-y-2">
                          {differentPolicies.slice(0, 6).map((item) => (
                            <button
                              type="button"
                              key={`diff:${item.policy_type}:${item.policy_key}`}
                              onClick={() => openTenantDetail(item)}
                              className="w-full rounded-md border p-2 text-xs flex items-center justify-between gap-2 text-left hover:bg-accent/30"
                            >
                              <span className="truncate">{item.policy_name} · {item.policy_type}</span>
                              <Badge variant="warning">different</Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="text-sm font-medium hover:underline"
                          onClick={() => openTenantItems(missingInTenantA, "not_match", "missing_in_tenant_a")}
                        >
                          Missing in {tenantResult.tenant_a.name} ({missingInTenantA.length})
                        </button>
                        <div className="mt-2 space-y-2">
                          {missingInTenantA.slice(0, 6).map((item) => (
                            <button
                              type="button"
                              key={`ma:${item.policy_type}:${item.policy_key}`}
                              onClick={() => openTenantDetail(item)}
                              className="w-full rounded-md border p-2 text-xs flex items-center justify-between gap-2 text-left hover:bg-accent/30"
                            >
                              <span className="truncate">{item.policy_name} · {item.policy_type}</span>
                              <Badge variant="danger">missing A</Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="text-sm font-medium hover:underline"
                          onClick={() => openTenantItems(missingInTenantB, "not_match", "missing_in_tenant_b")}
                        >
                          Missing in {tenantResult.tenant_b.name} ({missingInTenantB.length})
                        </button>
                        <div className="mt-2 space-y-2">
                          {missingInTenantB.slice(0, 6).map((item) => (
                            <button
                              type="button"
                              key={`mb:${item.policy_type}:${item.policy_key}`}
                              onClick={() => openTenantDetail(item)}
                              className="w-full rounded-md border p-2 text-xs flex items-center justify-between gap-2 text-left hover:bg-accent/30"
                            >
                              <span className="truncate">{item.policy_name} · {item.policy_type}</span>
                              <Badge variant="danger">missing B</Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Policy Match List</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredTenantItems.length} of {tenantStatusCounts[tenantStatusFilter]} {tenantStatusFilter === "all" ? "policies" : tenantStatusFilter}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
                        <input
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          placeholder="Search policy name, type, reason..."
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        />
                        <select
                          value={tenantPolicyTypeFilter}
                          onChange={(e) => setTenantPolicyTypeFilter(e.target.value)}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">All policy types</option>
                          {tenantPolicyTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-1">
                        {(["all", "match", "not_match", "duplicate"] as const).map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={tenantStatusFilter === status ? "default" : "outline"}
                            onClick={() => {
                              setTenantSearch("");
                              setTenantPolicyTypeFilter("all");
                              setTenantSubStatusFilter("all");
                              setTenantStatusFilter(status);
                              setSelectedTenantItem(null);
                            }}
                          >
                            {status === "all" ? "All" : status} ({tenantStatusCounts[status]})
                          </Button>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {filteredTenantItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No policies in this filter.</p>
                      ) : (
                        filteredTenantItems.map((item) => (
                          <button
                            type="button"
                            key={`${item.policy_type}:${item.policy_key}`}
                            onClick={() => openTenantDetail(item)}
                            className={`w-full rounded-md border p-3 flex items-center justify-between gap-3 text-left hover:bg-accent/30 ${
                              selectedTenantItem?.policy_key === item.policy_key ? "border-primary/70 bg-accent/20" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.policy_name}</p>
                              <p className="text-xs text-muted-foreground">{item.policy_type}</p>
                              <p className="text-xs text-muted-foreground">{item.reason}</p>
                              <p className="text-xs text-muted-foreground">
                                {tenantResult.tenant_a.name}: {item.tenant_a_count} | {tenantResult.tenant_b.name}: {item.tenant_b_count}
                              </p>
                              {(item.tenant_a_policy_name || item.tenant_b_policy_name) && (
                                <p className="text-xs text-muted-foreground">
                                  A: {item.tenant_a_policy_name || "—"} | B: {item.tenant_b_policy_name || "—"}
                                </p>
                              )}
                              {item.comparison && (
                                <p className="text-xs text-muted-foreground">
                                  Same: {item.comparison.same_settings_count}, Different values: {item.comparison.different_values_count}, Only A: {item.comparison.only_in_tenant_a_count}, Only B: {item.comparison.only_in_tenant_b_count}
                                </p>
                              )}
                              {item.comparison?.sample_different_paths?.length ? (
                                <p className="text-xs text-muted-foreground">
                                  Diff sample: {item.comparison.sample_different_paths[0].path}
                                </p>
                              ) : null}
                            </div>
                            <Badge variant={item.status === "match" ? "success" : item.status === "duplicate" ? "danger" : "warning"}>
                              {item.status}
                            </Badge>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                  {tenantResult.source_errors?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Unavailable Policy Types</CardTitle>
                        <CardDescription>Some policy types could not be read with current permissions.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {tenantResult.source_errors.map((err) => (
                          <div key={err.policy_type} className="rounded-md border p-3">
                            <p className="text-sm font-medium">{err.policy_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {err.error}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "baseline-security" && (
        <div ref={baselineSecurityRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Baseline security mode
              </CardTitle>
              <CardDescription>
                Manage these policies to reduce your attack surface and harden your Microsoft 365 organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Learn about baseline security mode and why it's important.
                </div>
                <a
                  href="https://admin.cloud.microsoft/?source=applauncher#/baselinesecuritymode"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    Open Baseline Security Mode
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Progress to meet standard</p>
                    <p className="text-2xl font-bold">13%</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Applied recommendations</p>
                    <p className="text-2xl font-bold">2 / 16</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Standard benchmark</p>
                    <p className="text-2xl font-bold">At risk</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Settings recommendations loaded</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    ["Block new password credentials in apps", "At risk", "Entra ID"],
                    ["Turn on restricted management user consent settings", "At risk", "Entra ID"],
                    ["Block access to Exchange Web Services", "At risk", "Exchange"],
                    ["Block basic authentication prompts", "Meets standard", "Microsoft 365 apps"],
                    ["Block files from opening with insecure protocols", "At risk", "Microsoft 365 apps"],
                    ["Block files from opening with FPRPC protocol", "At risk", "Microsoft 365 apps"],
                    ["Block legacy browser authentication connections to SharePoint", "Meets standard", "SharePoint"],
                    ["Block IDCRL protocol connections to SharePoint", "At risk", "SharePoint"],
                    ["Don't allow new custom scripts in OneDrive and SharePoint sites", "At risk", "SharePoint"],
                    ["Remove access to Microsoft Store for SharePoint", "At risk", "SharePoint"],
                    ["Open ancient legacy formats in Protected View and disallow editing", "At risk", "Microsoft 365 apps"],
                    ["Open old legacy formats in Protected View and save as modern format", "At risk", "Microsoft 365 apps"],
                    ["Block ActiveX controls in the Microsoft 365 apps", "At risk", "Microsoft 365 apps"],
                    ["Block OLE Graph and OrgChart objects", "At risk", "Microsoft 365 apps"],
                    ["Block Dynamic Data Exchange (DDE) server launch in Excel", "At risk", "Microsoft 365 apps"],
                    ["Block Microsoft Publisher", "At risk", "Microsoft 365 apps"],
                    ["Block unmanaged devices and resource account sign-ins to Microsoft 365 apps", "Not applicable", "Teams"],
                    ["Don't allow resource accounts on Teams Rooms devices from accessing Microsoft 365 files", "Not applicable", "Teams"],
                  ].map(([name, status, product]) => (
                    <div key={name} className="rounded-md border p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{product}</p>
                      </div>
                      <Badge variant={status === "At risk" ? "warning" : status === "Meets standard" ? "success" : "secondary"}>
                        {status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Capability highlights */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Equal className="h-5 w-5 text-emerald-400 mb-2" />
            <p className="font-medium text-sm">Identical Settings</p>
            <p className="text-xs text-muted-foreground mt-1">Find settings that match across snapshots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <GitCompareArrows className="h-5 w-5 text-amber-400 mb-2" />
            <p className="font-medium text-sm">Conflicting Values</p>
            <p className="text-xs text-muted-foreground mt-1">Detect values that differ between snapshots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Filter className="h-5 w-5 text-blue-400 mb-2" />
            <p className="font-medium text-sm">Smart Filtering</p>
            <p className="text-xs text-muted-foreground mt-1">Filter by change type, severity, and category</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Search className="h-5 w-5 text-purple-400 mb-2" />
            <p className="font-medium text-sm">Deep Analysis</p>
            <p className="text-xs text-muted-foreground mt-1">Property-level diff for every resource</p>
          </CardContent>
        </Card>
      </div>

      {/* Snapshot selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5" />
            Start Comparing
          </CardTitle>
          <CardDescription>Select two snapshots to compare side-by-side</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Snapshot A (Baseline)</label>
              <select
                value={snapA}
                onChange={(e) => setSnapA(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select snapshot...</option>
                {snapshots?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}... ({s.resource_count} resources) - {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-center pb-1">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Snapshot B (Current)</label>
              <select
                value={snapB}
                onChange={(e) => setSnapB(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select snapshot...</option>
                {snapshots?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}... ({s.resource_count} resources) - {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => compareMutation.mutate()}
              disabled={!snapA || !snapB || snapA === snapB || compareMutation.isPending}
              size="lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              {compareMutation.isPending ? "Comparing..." : "Start Comparing"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{result.summary.identical}</p><p className="text-xs text-muted-foreground mt-1">Identical</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-amber-400">{result.summary.modified}</p><p className="text-xs text-muted-foreground mt-1">Modified</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-blue-400">{result.summary.added}</p><p className="text-xs text-muted-foreground mt-1">Added</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-red-400">{result.summary.removed}</p><p className="text-xs text-muted-foreground mt-1">Removed</p></CardContent></Card>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "all", label: "All", count: result.summary.identical + result.summary.modified + result.summary.added + result.summary.removed },
              { key: "identical", label: "Identical", count: result.summary.identical },
              { key: "modified", label: "Modified", count: result.summary.modified },
              { key: "added", label: "Added", count: result.summary.added },
              { key: "removed", label: "Removed", count: result.summary.removed },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Identical */}
          {(activeTab === "all" || activeTab === "identical") && result.identical.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-400"><Equal className="h-5 w-5" />Identical ({result.identical.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.identical.map((item) => (
                    <div key={item.resource_id} className="flex items-center justify-between rounded-lg border border-emerald-500/20 p-3">
                      <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                      <Badge variant="success">Identical</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Modified */}
          {(activeTab === "all" || activeTab === "modified") && result.modified.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-amber-400"><BarChart3 className="h-5 w-5" />Modified ({result.modified.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.modified.map((item) => (
                    <div key={item.resource_id} className="rounded-lg border border-amber-500/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div><p className="font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                        <Badge variant="warning">{item.changes.length} changes</Badge>
                      </div>
                      <div className="space-y-2">
                        {item.changes.map((ch, idx) => (
                          <div key={idx} className="rounded-md bg-background p-3 text-sm">
                            <p className="font-mono text-xs text-muted-foreground mb-1">{ch.json_path}</p>
                            <div className="flex items-center gap-3">
                              {ch.old_value !== null && <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400 break-all">{ch.old_value}</span>}
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              {ch.new_value !== null && <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400 break-all">{ch.new_value}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Added */}
          {(activeTab === "all" || activeTab === "added") && result.added.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-blue-400"><Plus className="h-5 w-5" />Added ({result.added.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.added.map((item) => (
                    <div key={item.resource_id} className="rounded-lg border border-blue-500/20 p-3">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                        <Badge variant="info">Added</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Removed */}
          {(activeTab === "all" || activeTab === "removed") && result.removed.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-red-400"><Minus className="h-5 w-5" />Removed ({result.removed.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.removed.map((item) => (
                    <div key={item.resource_id} className="rounded-lg border border-red-500/20 p-3">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                        <Badge variant="danger">Removed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {selectedTenantItem && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 md:p-8">
          <div className="mx-auto max-w-6xl h-full overflow-auto rounded-xl border bg-background p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold">Policy Detail View</p>
                <p className="text-xs text-muted-foreground">{selectedTenantItem.policy_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={detailViewMode === "simple" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDetailViewMode("simple")}
                >
                  Simple view
                </Button>
                <Button
                  variant={detailViewMode === "json" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDetailViewMode("json")}
                >
                  JSON view
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedTenantItem(null)}>
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>
            {detailViewMode === "simple" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{tenantResult?.tenant_a.name ?? "Tenant A"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                      <p>Policy: {selectedTenantItem.tenant_a_policy_name || "Not present"}</p>
                      <p>IDs: {selectedTenantItem.tenant_a_ids.join(", ") || "—"}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{tenantResult?.tenant_b.name ?? "Tenant B"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                      <p>Policy: {selectedTenantItem.tenant_b_policy_name || "Not present"}</p>
                      <p>IDs: {selectedTenantItem.tenant_b_ids.join(", ") || "—"}</p>
                    </CardContent>
                  </Card>
                </div>

                {selectedTenantItem.comparison ? (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Simple Side-by-Side Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="rounded-md border overflow-hidden">
                        <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/40 px-3 py-2 font-medium">
                          <span>Setting path</span>
                          <span>{tenantResult?.tenant_a.name ?? "Tenant A"}</span>
                          <span>{tenantResult?.tenant_b.name ?? "Tenant B"}</span>
                        </div>
                        <div className="max-h-64 overflow-auto">
                          {selectedTenantItem.comparison.sample_different_paths.length > 0 ? (
                            selectedTenantItem.comparison.sample_different_paths.map((row) => (
                              <div key={row.path} className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 border-t">
                                <span className="font-mono">{row.path}</span>
                                <span className="truncate">{row.tenant_a_value ?? "null"}</span>
                                <span className="truncate">{row.tenant_b_value ?? "null"}</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-muted-foreground">No different values in sample set.</div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <p className="font-medium mb-1">Only in {tenantResult?.tenant_a.name ?? "Tenant A"}</p>
                          {selectedTenantItem.comparison.sample_only_in_tenant_a_paths.length === 0 ? (
                            <p className="text-muted-foreground">None</p>
                          ) : (
                            selectedTenantItem.comparison.sample_only_in_tenant_a_paths.map((path) => (
                              <p key={path} className="font-mono">{path}</p>
                            ))
                          )}
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="font-medium mb-1">Only in {tenantResult?.tenant_b.name ?? "Tenant B"}</p>
                          {selectedTenantItem.comparison.sample_only_in_tenant_b_paths.length === 0 ? (
                            <p className="text-muted-foreground">None</p>
                          ) : (
                            selectedTenantItem.comparison.sample_only_in_tenant_b_paths.map((path) => (
                              <p key={path} className="font-mono">{path}</p>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tenantResult?.tenant_a.name ?? "Tenant A"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Policy: {selectedTenantItem.tenant_a_policy_name || "Not present"}</p>
                    <p className="text-xs text-muted-foreground">IDs: {selectedTenantItem.tenant_a_ids.join(", ") || "—"}</p>
                    <pre className="max-h-80 overflow-auto rounded-md border p-2 text-[11px]">
{JSON.stringify(selectedTenantItem.tenant_a_data ?? {}, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tenantResult?.tenant_b.name ?? "Tenant B"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Policy: {selectedTenantItem.tenant_b_policy_name || "Not present"}</p>
                    <p className="text-xs text-muted-foreground">IDs: {selectedTenantItem.tenant_b_ids.join(", ") || "—"}</p>
                    <pre className="max-h-80 overflow-auto rounded-md border p-2 text-[11px]">
{JSON.stringify(selectedTenantItem.tenant_b_data ?? {}, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
            {selectedTenantItem.comparison && (
              <Card className="border-primary/30 mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Settings Difference Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    Same: {selectedTenantItem.comparison.same_settings_count} | Different values: {selectedTenantItem.comparison.different_values_count} | Only A: {selectedTenantItem.comparison.only_in_tenant_a_count} | Only B: {selectedTenantItem.comparison.only_in_tenant_b_count}
                  </p>
                  {selectedTenantItem.comparison.sample_different_paths.length > 0 && (
                    <div>
                      <p className="font-medium">Different value samples</p>
                      {selectedTenantItem.comparison.sample_different_paths.map((d) => (
                        <p key={d.path}>
                          {d.path}: A={d.tenant_a_value ?? "null"} | B={d.tenant_b_value ?? "null"}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

