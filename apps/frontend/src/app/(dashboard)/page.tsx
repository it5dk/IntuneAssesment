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
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Radio,
  Database,
  TrendingUp,
  ArrowRight,
  KeyRound,
  ShieldAlert,
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

export default function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
  });

  const { data: certs, isLoading: certsLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: api.getCertificates,
  });

  const expiring = certs?.certificates.filter(
    (c) => c.status === "expired" || c.status === "critical"
  ) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Tenant health monitoring dashboard" />

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Monitors" value={data?.active_monitors_count ?? 0} icon={Radio} loading={isLoading} />
        <MetricCard title="Resources Monitored" value={data?.resources_monitored_count ?? 0} icon={Database} loading={isLoading} />
        <MetricCard title="Success Rate" value={`${data?.success_rate ?? 100}%`} icon={TrendingUp} loading={isLoading} />
        <MetricCard title="Expiring Secrets" value={expiring.length} icon={ShieldAlert} loading={certsLoading} />
      </div>

      {/* Action card */}
      <div className="grid grid-cols-1 gap-4">
        <ActionCard title="Key Vault" description="Monitor secrets, certificates, tokens, and access policies" icon={KeyRound} href="/drifts" />
      </div>

      {/* Expiring Certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Expiring Certificates & Secrets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No expired or critical certificates</p>
          ) : (
            <div className="space-y-3">
              {expiring.slice(0, 10).map((cert) => (
                <Link key={cert.id} href="/drifts">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{cert.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cert.category} &middot; {cert.type}
                        {cert.detail ? ` \u00b7 ${cert.detail}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className="text-sm font-medium text-red-500">
                        {cert.days_remaining !== null && cert.days_remaining < 0
                          ? `Expired ${Math.abs(cert.days_remaining)}d ago`
                          : `${cert.days_remaining}d left`}
                      </span>
                      <Badge variant="danger">{cert.status}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
