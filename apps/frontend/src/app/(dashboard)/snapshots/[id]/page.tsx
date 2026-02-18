"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, Code, FileJson } from "lucide-react";
import { toast } from "sonner";

export default function SnapshotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"normalized" | "raw">("normalized");

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["snapshot", id],
    queryFn: () => api.getSnapshot(id),
  });

  const baselineMutation = useMutation({
    mutationFn: () => api.setBaseline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      toast.success("Snapshot set as baseline");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!snapshot) {
    return <p className="text-muted-foreground">Snapshot not found</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader title={`Snapshot ${id.slice(0, 8)}...`} description={`${snapshot.resource_count} resources captured on ${new Date(snapshot.created_at).toLocaleString()}`}>
        <Button variant="outline" onClick={() => baselineMutation.mutate()} disabled={baselineMutation.isPending}>
          <Bookmark className="mr-1.5 h-4 w-4" />
          Set as Baseline
        </Button>
      </PageHeader>

      {/* View mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("normalized")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "normalized" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <FileJson className="h-3.5 w-3.5" />
          Normalized
        </button>
        <button
          onClick={() => setViewMode("raw")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "raw" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Code className="h-3.5 w-3.5" />
          Raw JSON
        </button>
      </div>

      {/* Snapshot items */}
      <div className="space-y-4">
        {snapshot.items?.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{item.display_name || item.resource_id}</CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">{item.resource_type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">ID: {item.resource_id}</p>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-background p-4 text-xs overflow-auto max-h-64 border">
                {JSON.stringify(
                  viewMode === "normalized" ? item.normalized : item.raw_json,
                  null,
                  2
                )}
              </pre>
            </CardContent>
          </Card>
        ))}
        {!snapshot.items?.length && (
          <p className="text-sm text-muted-foreground text-center py-8">No items in this snapshot</p>
        )}
      </div>
    </div>
  );
}
