"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

type Tab = "active" | "resolved" | "trends";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "active", label: "Active Alerts", icon: Bell },
  { key: "resolved", label: "Resolved Alerts", icon: CheckCircle },
  { key: "trends", label: "Alert Trends", icon: TrendingUp },
];

function severityBadge(severity: string) {
  const map: Record<string, "danger" | "warning" | "success" | "secondary"> = {
    high: "danger",
    medium: "warning",
    low: "success",
  };
  return <Badge variant={map[severity] || "secondary"}>{severity}</Badge>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function SecurityAlertsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const { data, isLoading } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: api.getSecurityAlerts,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Alerts"
        description="Monitor active and resolved security alerts from Microsoft Defender"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Bell className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{data.summary.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{data.summary.resolved}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">High</p>
                <p className="text-2xl font-bold">{data.summary.high_severity}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Medium</p>
                <p className="text-2xl font-bold">{data.summary.medium_severity}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Low</p>
                <p className="text-2xl font-bold">{data.summary.low_severity}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = tabs.find((t) => t.key === activeTab)!.icon; return <Icon className="h-5 w-5" />; })()}
            {tabs.find((t) => t.key === activeTab)?.label}
            {data && activeTab !== "trends" && (
              <Badge variant="secondary" className="ml-2">
                {activeTab === "active" ? data.data.active.length : data.data.resolved.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "active" ? (
            data?.data.active.length === 0 ? <EmptyState text="No active alerts" /> : (
              <div className="space-y-2">
                {data?.data.active.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{a.category}</span>
                        {a.created && <><span>&middot;</span><span>{new Date(a.created).toLocaleString()}</span></>}
                      </div>
                      {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {severityBadge(a.severity)}
                      <Badge variant="secondary">{a.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "resolved" ? (
            data?.data.resolved.length === 0 ? <EmptyState text="No resolved alerts" /> : (
              <div className="space-y-2">
                {data?.data.resolved.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{a.category}</span>
                        {a.created && <><span>&middot;</span><span>{new Date(a.created).toLocaleString()}</span></>}
                        {a.resolved && <><span>&middot;</span><span>Resolved {new Date(a.resolved).toLocaleString()}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {severityBadge(a.severity)}
                      <Badge variant="success">resolved</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.trends.length === 0 ? <EmptyState text="No trend data available" /> : (
              <div className="space-y-2">
                {data?.data.trends.map((t) => (
                  <div key={t.date} className="flex items-center justify-between rounded-lg border p-4">
                    <span className="text-sm font-medium">{t.date}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-48 bg-accent rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${Math.min(100, (t.count / Math.max(...data!.data.trends.map(x => x.count), 1)) * 100)}%` }}
                        />
                      </div>
                      <Badge variant="secondary">{t.count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {data?.errors && data.errors.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-yellow-500 mb-2">Some sources could not be loaded:</p>
            {data.errors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">{e.source}: {e.error}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
