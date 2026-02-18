"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Clock, Database, GitCompareArrows, Camera } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: monitor, isLoading } = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => api.getMonitor(id),
  });

  const { data: snapshots } = useQuery({
    queryKey: ["snapshots", id],
    queryFn: () => api.getSnapshots(id),
  });

  const { data: drifts } = useQuery({
    queryKey: ["drifts", id],
    queryFn: () => api.getDrifts({ monitorId: id }),
  });

  const runMutation = useMutation({
    mutationFn: () => api.runMonitor(id),
    onSuccess: () => {
      toast.success("Monitor run triggered");
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!monitor) {
    return <p className="text-muted-foreground">Monitor not found</p>;
  }

  const activeDrifts = drifts?.filter((d) => d.status === "active").length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader title={monitor.name} description={monitor.description}>
        <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          <Play className="mr-1.5 h-4 w-4" />
          {runMutation.isPending ? "Running..." : "Run Now"}
        </Button>
      </PageHeader>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resources</p>
              <p className="text-2xl font-bold">{monitor.resource_count}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Schedule</p>
              <p className="text-2xl font-bold">Every {monitor.schedule_hours}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Drifts</p>
              <p className="text-2xl font-bold">{activeDrifts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Camera className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Snapshots</p>
              <p className="text-2xl font-bold">{snapshots?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Baseline */}
        <Card>
          <CardHeader>
            <CardTitle>Baseline</CardTitle>
          </CardHeader>
          <CardContent>
            {monitor.baseline_snapshot_id ? (
              <div className="space-y-2">
                <p className="text-sm font-mono text-muted-foreground">{monitor.baseline_snapshot_id}</p>
                <Link href={`/snapshots/${monitor.baseline_snapshot_id}`}>
                  <Button size="sm" variant="outline">View Baseline Snapshot</Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No baseline set. Run the monitor to create the first snapshot.</p>
            )}
          </CardContent>
        </Card>

        {/* Config */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Product</span>
              <Badge variant="secondary">{monitor.product_tag}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Resource Type</span>
              <span className="font-mono text-xs">{monitor.resource_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={monitor.enabled ? "success" : "secondary"}>
                {monitor.enabled ? "enabled" : "disabled"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Run</span>
              <span>
                {monitor.last_run ? (
                  <Badge
                    variant={monitor.last_run.status === "success" ? "success" : monitor.last_run.status === "failure" ? "danger" : "warning"}
                  >
                    {monitor.last_run.status}
                  </Badge>
                ) : (
                  "Never"
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {!snapshots?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No snapshots yet</p>
          ) : (
            <div className="space-y-2">
              {snapshots.slice(0, 10).map((snap) => (
                <Link key={snap.id} href={`/snapshots/${snap.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="text-sm font-mono">{snap.id.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(snap.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{snap.resource_count} resources</span>
                      {monitor.baseline_snapshot_id === snap.id && (
                        <Badge variant="info">baseline</Badge>
                      )}
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
