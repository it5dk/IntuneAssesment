"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera } from "lucide-react";
import Link from "next/link";

export default function SnapshotsPage() {
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["snapshots"],
    queryFn: () => api.getSnapshots(),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Snapshots" description="Browse point-in-time configuration snapshots" />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : snapshots?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No snapshots yet. Run a monitor to create the first snapshot.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Snapshots ({snapshots?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshots?.map((snap) => (
                <Link key={snap.id} href={`/snapshots/${snap.id}`}>
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="text-sm font-mono">{snap.id}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Monitor: {snap.monitor_id.slice(0, 8)}... &middot;{" "}
                        {new Date(snap.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">{snap.resource_count} resources</span>
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
