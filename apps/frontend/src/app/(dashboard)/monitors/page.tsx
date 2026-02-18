"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, Play, Eye, Clock, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function MonitorsPage() {
  const queryClient = useQueryClient();

  const { data: monitors, isLoading } = useQuery({
    queryKey: ["monitors"],
    queryFn: api.getMonitors,
  });

  const runMutation = useMutation({
    mutationFn: api.runMonitor,
    onSuccess: () => {
      toast.success("Monitor run triggered");
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
    onError: (err) => toast.error(`Run failed: ${err.message}`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateMonitor(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      toast.success("Monitor updated");
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Monitors" description="Manage configuration drift monitors">
        <Link href="/templates">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Monitor
          </Button>
        </Link>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : monitors?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No monitors configured yet</p>
            <Link href="/templates">
              <Button>Create from Template</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Monitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monitors?.map((monitor) => (
                <div
                  key={monitor.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shrink-0">
                      <Radio className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{monitor.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {monitor.product_tag && (
                          <Badge variant="secondary" className="text-xs">
                            {monitor.product_tag}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Every {monitor.schedule_hours}h
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {monitor.resource_count} resources
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {monitor.last_run && (
                      <Badge
                        variant={
                          monitor.last_run.status === "success"
                            ? "success"
                            : monitor.last_run.status === "failure"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {monitor.last_run.status}
                      </Badge>
                    )}
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: monitor.id,
                          enabled: !monitor.enabled,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        monitor.enabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          monitor.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runMutation.mutate(monitor.id)}
                      disabled={runMutation.isPending}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Run
                    </Button>
                    <Link href={`/monitors/${monitor.id}`}>
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
