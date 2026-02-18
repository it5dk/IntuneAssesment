"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings, Layers, Search, Monitor, Smartphone, Apple, Laptop,
  Gauge, Target, Timer, Zap, BarChart3, Shield, Filter, Eye,
  GitCompareArrows, Lock, ListChecks,
} from "lucide-react";
import Link from "next/link";

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("windows")) return <Monitor className="h-4 w-4" />;
  if (p.includes("ios") || p.includes("apple") || p.includes("macos")) return <Apple className="h-4 w-4" />;
  if (p.includes("android")) return <Smartphone className="h-4 w-4" />;
  return <Laptop className="h-4 w-4" />;
}

function platformLabel(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("windows")) return "Windows";
  if (p.includes("ios")) return "iOS";
  if (p.includes("macos")) return "macOS";
  if (p.includes("android")) return "Android";
  if (p.includes("compliance")) return "Compliance";
  return platform.split(".").pop() || "Unknown";
}

export default function ConfigurationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["config-summary"],
    queryFn: api.getConfigSummary,
  });

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ["config-policies", platformFilter, searchQuery],
    queryFn: () => api.getConfigPolicies({
      platform: platformFilter || undefined,
      search: searchQuery || undefined,
    }),
  });

  const policies = policiesData?.policies ?? [];
  const platforms = Object.keys(summary?.by_platform ?? {});
  const totalPolicies = summary?.total ?? 0;
  const typeCount = Object.keys(summary?.by_type ?? {}).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Configuration Management" description="Intune Policy & Settings Center" />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            {summaryLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (
              <p className="text-2xl font-bold">{totalPolicies}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total Policies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Layers className="h-6 w-6 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold">{platforms.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Platforms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">{typeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Policy Types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Timer className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">&lt; 2s</p>
            <p className="text-xs text-muted-foreground mt-1">Analysis Speed</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Policies</CardTitle>
            <CardDescription>Browse, search and analyze all Intune configuration and compliance policies across platforms.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><ListChecks className="h-3.5 w-3.5 text-primary" /> Full policy inventory</li>
              <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Compliance monitoring</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Platform analytics</li>
              <li className="flex items-center gap-2"><GitCompareArrows className="h-3.5 w-3.5 text-blue-400" /> Snapshot comparison</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Settings</CardTitle>
            <CardDescription>Drill down into individual policy settings with granular visibility into every configuration value.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-primary" /> Granular settings breakdown</li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-400" /> Conflict detection</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-emerald-400" /> Optimization insights</li>
              <li className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-blue-400" /> Value comparison</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Capability highlights */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Settings className="h-5 w-5 text-primary mb-2" />
            <p className="font-medium text-sm">Real-time Monitoring</p>
            <p className="text-xs text-muted-foreground mt-1">Track policy deployments and compliance in real-time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Layers className="h-5 w-5 text-amber-400 mb-2" />
            <p className="font-medium text-sm">Multi-Platform</p>
            <p className="text-xs text-muted-foreground mt-1">Windows, iOS, Android, and macOS analysis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Search className="h-5 w-5 text-emerald-400 mb-2" />
            <p className="font-medium text-sm">Settings Drill-Down</p>
            <p className="text-xs text-muted-foreground mt-1">Granular setting-level visibility</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Lock className="h-5 w-5 text-blue-400 mb-2" />
            <p className="font-medium text-sm">Drift Detection</p>
            <p className="text-xs text-muted-foreground mt-1">Automatic configuration change alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Platform filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPlatformFilter("")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !platformFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                platformFilter === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {platformIcon(p)}
              {platformLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Policy list */}
      {policiesLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No configuration policies found. Run a Configuration or Compliance monitor first.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Policies ({policies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {policies.map((policy) => (
                <Link key={policy.id} href={`/configuration/${policy.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shrink-0">
                        {platformIcon(policy.platform)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{policy.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{policy.description || policy.resource_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant="secondary" className="text-xs">{platformLabel(policy.platform)}</Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        {policy.resource_type.split(".").pop()}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
