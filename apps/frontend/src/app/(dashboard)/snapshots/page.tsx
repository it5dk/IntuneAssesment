"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Camera, Equal, GitCompareArrows, Minus, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

type ViewTab = "all" | "identical" | "modified" | "added" | "removed";

export default function SnapshotsPage() {
  const [snapA, setSnapA] = useState("");
  const [snapB, setSnapB] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const resultsRef = useRef<HTMLDivElement>(null);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["snapshots"],
    queryFn: () => api.getSnapshots(),
  });
  const compareMutation = useMutation({
    mutationFn: () => api.compareSnapshots(snapA, snapB),
    onSuccess: () => {
      setActiveTab("all");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    },
  });
  const result = compareMutation.data;

  return (
    <div className="space-y-8">
      <PageHeader title="Snapshots" description="Browse point-in-time configuration snapshots" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-primary" />
            Policy Comparison
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare two configuration policies side-by-side with detailed analysis of differences, similarities, and unique settings.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Snapshot A (Baseline)</label>
              <select
                value={snapA}
                onChange={(e) => setSnapA(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select snapshot...</option>
                {snapshots?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}... ({s.resource_count}) - {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-center pb-1">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Snapshot B (Current)</label>
              <select
                value={snapB}
                onChange={(e) => setSnapB(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select snapshot...</option>
                {snapshots?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}... ({s.resource_count}) - {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => compareMutation.mutate()}
              disabled={!snapA || !snapB || snapA === snapB || compareMutation.isPending}
              size="lg"
            >
              <Zap className="mr-2 h-4 w-4" />
              {compareMutation.isPending ? "Comparing..." : "Start Comparing"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <div ref={resultsRef} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{result.summary.identical}</p><p className="text-xs text-muted-foreground mt-1">Identical</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-amber-400">{result.summary.modified}</p><p className="text-xs text-muted-foreground mt-1">Modified</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-blue-400">{result.summary.added}</p><p className="text-xs text-muted-foreground mt-1">Added</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-red-400">{result.summary.removed}</p><p className="text-xs text-muted-foreground mt-1">Removed</p></CardContent></Card>
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              { key: "all", label: "All", count: result.summary.identical + result.summary.modified + result.summary.added + result.summary.removed },
              { key: "identical", label: "Identical", count: result.summary.identical },
              { key: "modified", label: "Modified", count: result.summary.modified },
              { key: "added", label: "Added", count: result.summary.added },
              { key: "removed", label: "Removed", count: result.summary.removed },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {(activeTab === "all" || activeTab === "identical") && result.identical.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-400"><Equal className="h-5 w-5" />Identical ({result.identical.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.identical.map((item) => (
                  <div key={item.resource_id} className="flex items-center justify-between rounded-lg border border-emerald-500/20 p-3">
                    <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                    <Badge variant="success">Identical</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {(activeTab === "all" || activeTab === "modified") && result.modified.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-amber-400"><BarChart3 className="h-5 w-5" />Modified ({result.modified.length})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {result.modified.map((item) => (
                  <div key={item.resource_id} className="rounded-lg border border-amber-500/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div><p className="font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                      <Badge variant="warning">{item.changes.length} changes</Badge>
                    </div>
                    <div className="space-y-2">
                      {item.changes.map((ch, idx) => (
                        <div key={idx} className="rounded-md bg-background p-3 text-sm">
                          <p className="mb-1 font-mono text-xs text-muted-foreground">{ch.json_path}</p>
                          <div className="flex items-center gap-3">
                            {ch.old_value !== null && <span className="break-all rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">{ch.old_value}</span>}
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {ch.new_value !== null && <span className="break-all rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">{ch.new_value}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {(activeTab === "all" || activeTab === "added") && result.added.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-blue-400"><Plus className="h-5 w-5" />Added ({result.added.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.added.map((item) => (
                  <div key={item.resource_id} className="rounded-lg border border-blue-500/20 p-3">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                      <Badge variant="info">Added</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {(activeTab === "all" || activeTab === "removed") && result.removed.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-red-400"><Minus className="h-5 w-5" />Removed ({result.removed.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.removed.map((item) => (
                  <div key={item.resource_id} className="rounded-lg border border-red-500/20 p-3">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                      <Badge variant="danger">Removed</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

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
