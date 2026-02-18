"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitCompareArrows } from "lucide-react";
import Link from "next/link";

function severityBadge(severity: string) {
  const map: Record<string, "danger" | "warning" | "info"> = {
    HIGH: "danger",
    MEDIUM: "warning",
    LOW: "info",
  };
  return <Badge variant={map[severity] || "secondary"}>{severity}</Badge>;
}

export default function DriftsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: drifts, isLoading } = useQuery({
    queryKey: [
      "drifts",
      statusFilter === "all" ? undefined : statusFilter,
      undefined,
      severityFilter === "all" ? undefined : severityFilter,
    ],
    queryFn: () =>
      api.getDrifts({
        status: statusFilter === "all" ? undefined : statusFilter,
        severity: severityFilter === "all" ? undefined : severityFilter,
      }),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Drift Control" description="Review and manage configuration drift" />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">Status:</span>
          {["all", "active", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center mr-1">Severity:</span>
          {["all", "HIGH", "MEDIUM", "LOW"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                severityFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Drifts list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : drifts?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompareArrows className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No drifts detected</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Detected Drifts ({drifts?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drifts?.map((drift) => (
                <Link key={drift.id} href={`/drifts/${drift.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{drift.display_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{drift.resource_type}</span>
                        <span>&middot;</span>
                        <span>{drift.change_type}</span>
                        <span>&middot;</span>
                        <span>{drift.property_count} properties</span>
                        <span>&middot;</span>
                        <span>{new Date(drift.detected_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {severityBadge(drift.severity)}
                      <Badge variant={drift.status === "active" ? "danger" : "success"}>
                        {drift.status}
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
