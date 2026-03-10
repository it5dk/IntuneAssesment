"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Target,
  Gauge,
  BarChart3,
} from "lucide-react";

type Tab = "threats" | "score" | "insights";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "threats", label: "Active Threats", icon: Target },
  { key: "score", label: "Exposure Score", icon: Gauge },
  { key: "insights", label: "Vulnerability Insights", icon: BarChart3 },
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
      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function ThreatAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("threats");

  const { data, isLoading } = useQuery({
    queryKey: ["threat-analytics"],
    queryFn: api.getThreatAnalytics,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Threat Analytics"
        description="Active threats, secure score, and vulnerability insights"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Target className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Active Threats</p>
                <p className="text-2xl font-bold">{data.summary.active_threats}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Gauge className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Secure Score</p>
                <p className="text-2xl font-bold">
                  {data.summary.secure_score !== null ? `${data.summary.secure_score}/${data.summary.max_score}` : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">High Risk</p>
                <p className="text-2xl font-bold">{data.summary.high_risk}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{data.summary.categories}</p>
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "threats" ? (
            data?.data.threats.length === 0 ? <EmptyState text="No active threats" /> : (
              <div className="space-y-2">
                {data?.data.threats.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{t.category}</span>
                        {t.created && <><span>&middot;</span><span>{new Date(t.created).toLocaleString()}</span></>}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {severityBadge(t.severity)}
                      <Badge variant="secondary">{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "score" ? (
            !data?.data.secure_score ? <EmptyState text="Secure score data not available" /> : (
              <div className="space-y-6">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-6xl font-bold">{data.data.secure_score.current_score}</p>
                    <p className="text-xl text-muted-foreground mt-1">/ {data.data.secure_score.max_score}</p>
                    <div className="w-64 bg-accent rounded-full h-3 mt-4 mx-auto">
                      <div
                        className="bg-primary rounded-full h-3"
                        style={{ width: `${(data.data.secure_score.current_score / data.data.secure_score.max_score) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      Industry average: {data.data.secure_score.average_comparative_score}
                    </p>
                    {data.data.secure_score.created && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last updated: {new Date(data.data.secure_score.created).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            data?.data.insights.length === 0 ? <EmptyState text="No vulnerability insights available" /> : (
              <div className="space-y-2">
                {data?.data.insights.map((ins) => (
                  <div key={ins.category} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{ins.category}</p>
                      <p className="text-xs text-muted-foreground mt-1">{ins.count} threat(s) in this category</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {ins.high > 0 && <Badge variant="danger">{ins.high} high</Badge>}
                      {ins.medium > 0 && <Badge variant="warning">{ins.medium} medium</Badge>}
                      {ins.low > 0 && <Badge variant="success">{ins.low} low</Badge>}
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
