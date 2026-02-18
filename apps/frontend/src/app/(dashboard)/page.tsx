/*  BEGIN AUTODOC HEADER
//  File: apps\frontend\src\app\(dashboard)\page.tsx
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

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Radio,
  GitCompareArrows,
  Database,
  TrendingUp,
  ArrowRight,
  Eye,
  Settings,
  Camera,
} from "lucide-react";
import Link from "next/link";

function MetricCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-3xl font-bold mt-1">{value}</p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function severityBadge(severity: string) {
  const map: Record<string, "danger" | "warning" | "info"> = {
    HIGH: "danger",
    MEDIUM: "warning",
    LOW: "info",
  };
  return <Badge variant={map[severity] || "secondary"}>{severity}</Badge>;
}

function statusBadge(status: string) {
  return (
    <Badge variant={status === "active" ? "danger" : "success"}>
      {status}
    </Badge>
  );
}

export default function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Configuration drift monitoring dashboard" />

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Monitors" value={data?.active_monitors_count ?? 0} icon={Radio} loading={isLoading} />
        <MetricCard title="Active Drifts" value={data?.active_drifts_count ?? 0} icon={GitCompareArrows} loading={isLoading} />
        <MetricCard title="Resources Monitored" value={data?.resources_monitored_count ?? 0} icon={Database} loading={isLoading} />
        <MetricCard title="Success Rate" value={`${data?.success_rate ?? 100}%`} icon={TrendingUp} loading={isLoading} />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionCard title="View Drifts" description="Review detected configuration drift" icon={Eye} href="/drifts" />
        <ActionCard title="Manage Monitors" description="Configure and manage monitors" icon={Settings} href="/monitors" />
        <ActionCard title="View Snapshots" description="Browse configuration snapshots" icon={Camera} href="/snapshots" />
      </div>

      {/* Recent Drifts + Monitor Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Drifts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5" />
              Recent Drifts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : data?.recent_drifts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No drifts detected yet</p>
            ) : (
              <div className="space-y-3">
                {data?.recent_drifts.map((drift) => (
                  <Link key={drift.id} href={`/drifts/${drift.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{drift.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {drift.resource_type} &middot; {drift.property_count} properties
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {severityBadge(drift.severity)}
                        {statusBadge(drift.status)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monitor Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Monitor Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : data?.monitor_status.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No monitors configured yet</p>
            ) : (
              <div className="space-y-3">
                {data?.monitor_status.map((mon) => (
                  <Link key={mon.id} href={`/monitors/${mon.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{mon.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {mon.resource_count} resources &middot; Every {mon.schedule_hours}h
                        </p>
                      </div>
                      <Badge variant={mon.enabled ? "success" : "secondary"}>
                        {mon.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

