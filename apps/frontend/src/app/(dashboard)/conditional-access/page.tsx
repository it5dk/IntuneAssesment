/*  BEGIN AUTODOC HEADER
//  File: apps\frontend\src\app\(dashboard)\conditional-access\page.tsx
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

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lock, ShieldCheck, AlertTriangle, BarChart3, Eye, Radio, Play,
  Shield, Target, Gauge, Timer, Zap, Layers, Search, Filter,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ConditionalAccessPage() {
  const queryClient = useQueryClient();
  const [activeModule, setActiveModule] = useState<"monitoring" | "risk" | "compliance" | "analytics">("monitoring");
  const monitoringRef = useRef<HTMLDivElement>(null);

  const { data: monitors } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.getMonitors,
  });

  const caMonitor = monitors?.find((m) => m.resource_type === "microsoft.graph.conditionalAccessPolicy");

  const { data: drifts } = useQuery({
    queryKey: ["drifts", caMonitor?.id],
    queryFn: () => api.getDrifts({ monitorId: caMonitor?.id }),
    enabled: !!caMonitor,
  });

  const { data: snapshots } = useQuery({
    queryKey: ["snapshots", caMonitor?.id],
    queryFn: () => api.getSnapshots(caMonitor?.id),
    enabled: !!caMonitor,
  });

  const latestSnapshot = snapshots?.[0];

  const { data: snapshotDetail } = useQuery({
    queryKey: ["snapshot", latestSnapshot?.id],
    queryFn: () => api.getSnapshot(latestSnapshot!.id),
    enabled: !!latestSnapshot,
  });

  const runMutation = useMutation({
    mutationFn: () => api.runMonitor(caMonitor!.id),
    onSuccess: () => {
      toast.success("Conditional Access scan triggered");
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });

  const activeDrifts = drifts?.filter((d) => d.status === "active") ?? [];
  const policies = snapshotDetail?.items ?? [];

  const enabledPolicies = policies.filter((p) => (p.normalized as Record<string, unknown>)?.state === "enabled");
  const disabledPolicies = policies.filter((p) => (p.normalized as Record<string, unknown>)?.state === "disabled");
  const reportOnlyPolicies = policies.filter((p) => (p.normalized as Record<string, unknown>)?.state === "enabledForReportingButNotEnforced");

  return (
    <div className="space-y-8">
      <PageHeader title="Conditional Access Control Center" description="Zero Trust Policy Management">
        {caMonitor && (
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            <Play className="mr-1.5 h-4 w-4" />
            {runMutation.isPending ? "Scanning..." : "Scan Policies"}
          </Button>
        )}
      </PageHeader>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{policies.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Policies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Shield className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">{enabledPolicies.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Enforced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold">{reportOnlyPolicies.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Report-Only</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Timer className="h-6 w-6 mx-auto mb-2 text-red-400" />
            <p className="text-2xl font-bold">{activeDrifts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active Drifts</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("monitoring");
            monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("monitoring");
              monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "monitoring" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "monitoring" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "monitoring" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Policy Monitoring</CardTitle>
            <CardDescription>Real-time tracking of policy state changes, enforcement status, and configuration drift detection.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-primary" /> State change detection</li>
              <li className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-blue-400" /> Enforcement tracking</li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-400" /> Drift alerts</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("risk");
            monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("risk");
              monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "risk" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "risk" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "risk" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Risk Assessment</CardTitle>
            <CardDescription>Identify security risks from disabled policies, overly permissive rules, and configuration gaps.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Security gap analysis</li>
              <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Best practice validation</li>
              <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-red-400" /> Risk scoring</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("compliance");
            monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("compliance");
              monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "compliance" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "compliance" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "compliance" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Compliance Tracking</CardTitle>
            <CardDescription>Monitor enforcement status across all users and ensure Zero Trust compliance posture.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Enforcement verification</li>
              <li className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-blue-400" /> Coverage analysis</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-purple-400" /> Policy scope review</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("analytics");
            monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("analytics");
              monitoringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "analytics" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "analytics" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "analytics" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Access Analytics</CardTitle>
            <CardDescription>Analyze policy patterns, effectiveness, and identify optimization opportunities.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Policy analytics</li>
              <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-blue-400" /> Pattern detection</li>
              <li className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-emerald-400" /> Effectiveness scoring</li>
            </ul>
          </CardContent>
        </Card>
        </div>
      </div>

      {activeModule === "monitoring" && (
        <div ref={monitoringRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                Policy Monitoring Workspace
              </CardTitle>
              <CardDescription>
                Real-time tracking of policy state changes, enforcement status, and configuration drift detection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">State change detection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">{activeDrifts.length} active state changes</p>
                    <p className="text-xs text-muted-foreground">
                      Tracks policy drifts between snapshots and highlights configuration changes that require review.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Enforcement tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">
                      Enforced: {enabledPolicies.length} | Report-only: {reportOnlyPolicies.length} | Disabled: {disabledPolicies.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Monitors policy enforcement posture and quickly surfaces gaps in active protection coverage.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Drift alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">{activeDrifts.filter((d) => d.severity === "critical").length} critical alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Flags high-impact drift items so you can prioritize critical policy changes first.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Recent drift alerts</p>
                {activeDrifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active drift alerts detected in the latest monitor run.</p>
                ) : (
                  <div className="space-y-2">
                    {activeDrifts.slice(0, 6).map((drift) => (
                      <div key={drift.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{drift.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {drift.change_type} • {drift.property_count} fields • {new Date(drift.detected_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={drift.severity === "critical" ? "danger" : "warning"} className="shrink-0">
                          {drift.severity}
                        </Badge>
                      </div>
                    ))}
                    <div>
                      <Link href={`/drifts?monitorId=${caMonitor?.id}`}>
                        <Button variant="outline" size="sm">Open Drift Alerts</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "risk" && (
        <div ref={monitoringRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Risk Assessment Workspace
              </CardTitle>
              <CardDescription>
                Identify security risks from disabled policies, overly permissive rules, and configuration gaps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Security gap analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">Disabled policies: {disabledPolicies.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Highlights disabled controls and drifted policy states that may leave access paths under-protected.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Best practice validation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">Report-only policies: {reportOnlyPolicies.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Flags policies not fully enforced yet so you can validate rollout posture against baseline standards.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Risk scoring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">
                      {(disabledPolicies.length * 15) + (reportOnlyPolicies.length * 8) + (activeDrifts.length * 12)} computed risk points
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Weighted from disabled policies, report-only controls, and active drifts for quick prioritization.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "compliance" && (
        <div ref={monitoringRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Compliance Tracking Workspace
              </CardTitle>
              <CardDescription>
                Monitor enforcement status across all users and ensure Zero Trust compliance posture.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Enforcement verification</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">Enforced policies: {enabledPolicies.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Verifies active enforcement posture and highlights policies that are not fully applied.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Coverage analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">
                      Coverage ratio: {policies.length === 0 ? "0%" : `${Math.round((enabledPolicies.length / policies.length) * 100)}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tracks enforcement coverage across available Conditional Access policies.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Policy scope review</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">
                      Report-only: {reportOnlyPolicies.length} | Disabled: {disabledPolicies.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reviews non-enforced policy scope to identify rollout gaps and scope misalignment.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "analytics" && (
        <div ref={monitoringRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Access Analytics Workspace
              </CardTitle>
              <CardDescription>
                Analyze policy patterns, effectiveness, and identify optimization opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Policy analytics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">Total policies analyzed: {policies.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Summarizes policy state distribution and drift impact for fast posture awareness.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pattern detection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">
                      Report-only + disabled patterns: {reportOnlyPolicies.length + disabledPolicies.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Detects recurring configuration patterns that may indicate rollout blockers or inconsistent baselines.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Effectiveness scoring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-semibold">
                      {policies.length === 0 ? "0" : Math.max(0, Math.round((enabledPolicies.length / policies.length) * 100 - (activeDrifts.length * 5)))}
                      /100 effectiveness
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Score blends enforcement coverage and drift load to estimate policy effectiveness.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Policy overview card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Conditional Access Policy Overview
          </CardTitle>
          <CardDescription>
            {latestSnapshot
              ? `Last scanned: ${new Date(latestSnapshot.created_at).toLocaleString()}`
              : "Run a Conditional Access monitor to load policies"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Capability highlights */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <Radio className="h-4 w-4 text-primary shrink-0" />
              <span>Real-time policy monitoring</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Security risk identification</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Enforcement status tracking</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Policy effectiveness analytics</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4 text-purple-400 shrink-0" />
              <span>Deep configuration analysis</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Multi-policy comparison</span>
            </div>
          </div>

          {/* Policy list */}
          {policies.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No Conditional Access policies loaded</p>
              {!caMonitor ? (
                <Link href="/templates">
                  <Button>Create CA Monitor from Template</Button>
                </Link>
              ) : (
                <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
                  Scan Policies
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {policies.map((policy) => {
                const norm = policy.normalized as Record<string, unknown>;
                const state = (norm?.state as string) || "unknown";
                const hasDrift = activeDrifts.some((d) => d.resource_id === policy.resource_id);
                return (
                  <div key={policy.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{policy.display_name}</p>
                        {hasDrift && <Badge variant="danger" className="text-[10px]">DRIFT</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{policy.resource_id.slice(0, 12)}...</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant={
                        state === "enabled" ? "success" :
                        state === "disabled" ? "secondary" :
                        state === "enabledForReportingButNotEnforced" ? "warning" :
                        "outline"
                      }>
                        {state === "enabledForReportingButNotEnforced" ? "report-only" : state}
                      </Badge>
                      {hasDrift && (
                        <Link href={`/drifts?monitorId=${caMonitor?.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

