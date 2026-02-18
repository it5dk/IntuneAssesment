"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function changeTypeColor(ct: string) {
  switch (ct) {
    case "added":
      return "text-emerald-400";
    case "removed":
      return "text-red-400";
    case "modified":
      return "text-amber-400";
    default:
      return "text-foreground";
  }
}

export default function DriftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: drift, isLoading } = useQuery({
    queryKey: ["drift", id],
    queryFn: () => api.getDrift(id),
  });

  const resolveMutation = useMutation({
    mutationFn: () => api.resolveDrift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drift", id] });
      queryClient.invalidateQueries({ queryKey: ["drifts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Drift resolved");
    },
    onError: (err) => toast.error(`Resolve failed: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!drift) {
    return <p className="text-muted-foreground">Drift not found</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader title={drift.display_name || "Drift Detail"} description={`${drift.resource_type} - ${drift.change_type}`}>
        {drift.status === "active" && (
          <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {resolveMutation.isPending ? "Resolving..." : "Resolve"}
          </Button>
        )}
      </PageHeader>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Resource ID</span>
              <p className="font-mono mt-0.5">{drift.resource_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Resource Type</span>
              <p className="font-mono mt-0.5">{drift.resource_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Change Type</span>
              <p className={`mt-0.5 font-medium ${changeTypeColor(drift.change_type)}`}>{drift.change_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Severity</span>
              <div className="mt-0.5">
                <Badge variant={drift.severity === "HIGH" ? "danger" : drift.severity === "MEDIUM" ? "warning" : "info"}>
                  {drift.severity}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="mt-0.5">
                <Badge variant={drift.status === "active" ? "danger" : "success"}>{drift.status}</Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Detected</span>
              <p className="mt-0.5">{new Date(drift.detected_at).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drift Items */}
      <Card>
        <CardHeader>
          <CardTitle>Property Changes ({drift.items?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!drift.items?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {drift.change_type === "added"
                ? "New resource added (no property-level diff)"
                : drift.change_type === "removed"
                ? "Resource removed"
                : "No property changes"}
            </p>
          ) : (
            <div className="space-y-3">
              {drift.items.map((item) => (
                <div key={item.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{item.json_path}</span>
                    <Badge
                      variant={item.change_type === "added" ? "success" : item.change_type === "removed" ? "danger" : "warning"}
                    >
                      {item.change_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {item.old_value !== null && (
                      <div className="flex-1 rounded-md bg-red-500/10 p-2">
                        <span className="text-xs text-muted-foreground">Old</span>
                        <pre className="text-red-400 text-xs mt-1 whitespace-pre-wrap break-all">{item.old_value}</pre>
                      </div>
                    )}
                    {item.old_value !== null && item.new_value !== null && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    {item.new_value !== null && (
                      <div className="flex-1 rounded-md bg-emerald-500/10 p-2">
                        <span className="text-xs text-muted-foreground">New</span>
                        <pre className="text-emerald-400 text-xs mt-1 whitespace-pre-wrap break-all">{item.new_value}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
