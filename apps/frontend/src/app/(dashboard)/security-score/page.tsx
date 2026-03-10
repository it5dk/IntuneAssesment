"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  BarChart3,
  ListChecks,
} from "lucide-react";

type Tab = "trend" | "controls";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "trend", label: "Score Trend", icon: BarChart3 },
  { key: "controls", label: "Control Recommendations", icon: ListChecks },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Gauge className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function SecurityScorePage() {
  const [activeTab, setActiveTab] = useState<Tab>("trend");

  const { data, isLoading } = useQuery({
    queryKey: ["security-score"],
    queryFn: api.getSecurityScore,
  });

  const TrendIcon = data?.summary.trend === "up" ? TrendingUp : data?.summary.trend === "down" ? TrendingDown : Minus;
  const trendColor = data?.summary.trend === "up" ? "text-green-500" : data?.summary.trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Score Trend"
        description="Track your Microsoft Secure Score over time and view recommendations"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Gauge className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Current Score</p>
                <p className="text-2xl font-bold">
                  {data.summary.current_score ?? "N/A"}
                  {data.summary.max_score && <span className="text-sm font-normal text-muted-foreground">/{data.summary.max_score}</span>}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendIcon className={`h-5 w-5 shrink-0 ${trendColor}`} />
              <div>
                <p className="text-xs text-muted-foreground">Trend</p>
                <p className="text-2xl font-bold capitalize">{data.summary.trend}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Industry Avg</p>
                <p className="text-2xl font-bold">{data.summary.average_score ?? "N/A"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Controls</p>
                <p className="text-2xl font-bold">{data.summary.controls_count}</p>
              </div>
            </CardContent>
          </Card>
        </div>
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
          ) : activeTab === "trend" ? (
            data?.data.history.length === 0 ? <EmptyState text="No score history available" /> : (
              <div className="space-y-2">
                {data?.data.history.map((h) => (
                  <div key={h.date} className="flex items-center justify-between rounded-lg border p-4">
                    <span className="text-sm font-medium">{h.date}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-48 bg-accent rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${h.max_score > 0 ? (h.current_score / h.max_score) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold w-20 text-right">{h.current_score}/{h.max_score}</span>
                      <span className="text-xs text-muted-foreground w-16 text-right">avg: {h.average_score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.controls.length === 0 ? <EmptyState text="No control recommendations" /> : (
              <div className="space-y-2">
                {data?.data.controls.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{c.category}</span>
                        <span>&middot;</span>
                        <span>{c.service}</span>
                        {c.implementation_cost && <><span>&middot;</span><span>Cost: {c.implementation_cost}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant="secondary">{c.max_score} pts</Badge>
                      {c.tier && <Badge variant="secondary">{c.tier}</Badge>}
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
