"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gauge,
  AlertTriangle,
  Users,
  Server,
} from "lucide-react";

type Tab = "factors" | "risky_users" | "risky_sps";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "factors", label: "Risk Factors", icon: AlertTriangle },
  { key: "risky_users", label: "Risky Users", icon: Users },
  { key: "risky_sps", label: "Risky Service Principals", icon: Server },
];

function gradeColor(grade: string) {
  switch (grade) {
    case "Critical": return "text-red-500";
    case "High": return "text-orange-500";
    case "Medium": return "text-yellow-500";
    case "Low": return "text-green-500";
    default: return "text-muted-foreground";
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Gauge className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function TenantRiskPage() {
  const [activeTab, setActiveTab] = useState<Tab>("factors");

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-risk"],
    queryFn: api.getTenantRisk,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tenant Risk Score"
        description="Aggregated risk assessment from multiple security signals"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Gauge className={`h-5 w-5 shrink-0 ${gradeColor(data.summary.grade)}`} />
              <div>
                <p className="text-xs text-muted-foreground">Risk Grade</p>
                <p className={`text-2xl font-bold ${gradeColor(data.summary.grade)}`}>{data.summary.grade}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Risk Score</p>
                <p className="text-2xl font-bold">{data.summary.risk_score}/{data.summary.max_score}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Risky Users</p>
                <p className="text-2xl font-bold">{data.summary.risky_users}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Server className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Risky SPs</p>
                <p className="text-2xl font-bold">{data.summary.risky_service_principals}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk gauge */}
      {data && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-500">Low</span>
                  <span className="text-yellow-500">Medium</span>
                  <span className="text-orange-500">High</span>
                  <span className="text-red-500">Critical</span>
                </div>
                <div className="w-full bg-accent rounded-full h-4">
                  <div
                    className={`rounded-full h-4 transition-all ${
                      data.summary.risk_percentage >= 70 ? "bg-red-500" :
                      data.summary.risk_percentage >= 50 ? "bg-orange-500" :
                      data.summary.risk_percentage >= 25 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(100, data.summary.risk_percentage)}%` }}
                  />
                </div>
                <p className="text-center mt-2 text-sm text-muted-foreground">{data.summary.risk_percentage}% risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          ) : activeTab === "factors" ? (
            data?.data.risk_factors.length === 0 ? <EmptyState text="No risk factors detected" /> : (
              <div className="space-y-2">
                {data?.data.risk_factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                    <p className="font-medium">{f.factor}</p>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant={f.severity === "critical" ? "danger" : f.severity === "high" ? "warning" : "secondary"}>
                        {f.severity}
                      </Badge>
                      <Badge variant="secondary">{f.points} pts</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "risky_users" ? (
            data?.data.risky_users.length === 0 ? <EmptyState text="No risky users" /> : (
              <div className="space-y-2">
                {data?.data.risky_users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{u.upn}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant={u.risk_level === "high" ? "danger" : u.risk_level === "medium" ? "warning" : "secondary"}>
                        {u.risk_level}
                      </Badge>
                      <Badge variant="secondary">{u.risk_state}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.risky_signins.length === 0 ? <EmptyState text="No risky service principals" /> : (
              <div className="space-y-2">
                {data?.data.risky_signins.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.name}</p>
                      {s.last_updated && <p className="text-xs text-muted-foreground mt-1">{new Date(s.last_updated).toLocaleString()}</p>}
                    </div>
                    <Badge variant={s.risk_level === "high" ? "danger" : s.risk_level === "medium" ? "warning" : "secondary"}>
                      {s.risk_level}
                    </Badge>
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
