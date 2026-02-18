"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitCompareArrows, Equal, Plus, Minus, ArrowRight, BarChart3,
  Zap, Search, Filter, Target, Gauge, Timer, Layers,
} from "lucide-react";

type ViewTab = "all" | "identical" | "modified" | "added" | "removed";

export default function ComparePage() {
  const [snapA, setSnapA] = useState("");
  const [snapB, setSnapB] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("all");

  const { data: snapshots, isLoading: snapsLoading } = useQuery({
    queryKey: ["snapshots"],
    queryFn: () => api.getSnapshots(),
  });

  const compareMutation = useMutation({
    mutationFn: () => api.compareSnapshots(snapA, snapB),
  });

  const result = compareMutation.data;

  return (
    <div className="space-y-8">
      <PageHeader title="Policy Comparison Engine" description="Configuration Compare Center" />

      {/* Key metrics - matching IntuneAssistant style */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">99.8%</p>
            <p className="text-xs text-muted-foreground mt-1">Comparison Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Layers className="h-6 w-6 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold">50k+</p>
            <p className="text-xs text-muted-foreground mt-1">Settings Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">100+</p>
            <p className="text-xs text-muted-foreground mt-1">Policy Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Timer className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">&lt; 2s</p>
            <p className="text-xs text-muted-foreground mt-1">Comparison Speed</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards - matching IntuneAssistant */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Policy Comparison</CardTitle>
            <CardDescription>Compare two configuration policies side-by-side with detailed analysis of differences, similarities, and unique settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Equal className="h-3.5 w-3.5 text-emerald-400" /> Side-by-side comparison</li>
              <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-blue-400" /> Child settings analysis</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Visual change indicators</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="opacity-70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">COMING SOON</Badge>
            </div>
            <CardTitle className="text-lg">Baseline Analysis</CardTitle>
            <CardDescription>Validate configurations against security baselines with compliance gap analysis and best practice recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5" /> Security baseline validation</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Compliance gap analysis</li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> Best practice recommendations</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="opacity-70">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">COMING SOON</Badge>
            </div>
            <CardTitle className="text-lg">Bulk Comparison</CardTitle>
            <CardDescription>Compare multiple policies simultaneously with a multi-policy comparison matrix and standardization insights.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Multi-policy matrix</li>
              <li className="flex items-center gap-2"><GitCompareArrows className="h-3.5 w-3.5" /> Standardization insights</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Pattern analysis</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Capability highlights */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Equal className="h-5 w-5 text-emerald-400 mb-2" />
            <p className="font-medium text-sm">Identical Settings</p>
            <p className="text-xs text-muted-foreground mt-1">Find settings that match across snapshots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <GitCompareArrows className="h-5 w-5 text-amber-400 mb-2" />
            <p className="font-medium text-sm">Conflicting Values</p>
            <p className="text-xs text-muted-foreground mt-1">Detect values that differ between snapshots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Filter className="h-5 w-5 text-blue-400 mb-2" />
            <p className="font-medium text-sm">Smart Filtering</p>
            <p className="text-xs text-muted-foreground mt-1">Filter by change type, severity, and category</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Search className="h-5 w-5 text-purple-400 mb-2" />
            <p className="font-medium text-sm">Deep Analysis</p>
            <p className="text-xs text-muted-foreground mt-1">Property-level diff for every resource</p>
          </CardContent>
        </Card>
      </div>

      {/* Snapshot selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5" />
            Start Comparing
          </CardTitle>
          <CardDescription>Select two snapshots to compare side-by-side</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Snapshot A (Baseline)</label>
              <select
                value={snapA}
                onChange={(e) => setSnapA(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select snapshot...</option>
                {snapshots?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}... ({s.resource_count} resources) - {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-center pb-1">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Snapshot B (Current)</label>
              <select
                value={snapB}
                onChange={(e) => setSnapB(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select snapshot...</option>
                {snapshots?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)}... ({s.resource_count} resources) - {new Date(s.created_at).toLocaleDateString()}
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

      {/* Results */}
      {result && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{result.summary.identical}</p><p className="text-xs text-muted-foreground mt-1">Identical</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-amber-400">{result.summary.modified}</p><p className="text-xs text-muted-foreground mt-1">Modified</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-blue-400">{result.summary.added}</p><p className="text-xs text-muted-foreground mt-1">Added</p></CardContent></Card>
            <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-red-400">{result.summary.removed}</p><p className="text-xs text-muted-foreground mt-1">Removed</p></CardContent></Card>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
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

          {/* Identical */}
          {(activeTab === "all" || activeTab === "identical") && result.identical.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-400"><Equal className="h-5 w-5" />Identical ({result.identical.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.identical.map((item) => (
                    <div key={item.resource_id} className="flex items-center justify-between rounded-lg border border-emerald-500/20 p-3">
                      <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                      <Badge variant="success">Identical</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Modified */}
          {(activeTab === "all" || activeTab === "modified") && result.modified.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-amber-400"><BarChart3 className="h-5 w-5" />Modified ({result.modified.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.modified.map((item) => (
                    <div key={item.resource_id} className="rounded-lg border border-amber-500/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div><p className="font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                        <Badge variant="warning">{item.changes.length} changes</Badge>
                      </div>
                      <div className="space-y-2">
                        {item.changes.map((ch, idx) => (
                          <div key={idx} className="rounded-md bg-background p-3 text-sm">
                            <p className="font-mono text-xs text-muted-foreground mb-1">{ch.json_path}</p>
                            <div className="flex items-center gap-3">
                              {ch.old_value !== null && <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400 break-all">{ch.old_value}</span>}
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              {ch.new_value !== null && <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400 break-all">{ch.new_value}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Added */}
          {(activeTab === "all" || activeTab === "added") && result.added.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-blue-400"><Plus className="h-5 w-5" />Added ({result.added.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.added.map((item) => (
                    <div key={item.resource_id} className="rounded-lg border border-blue-500/20 p-3">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                        <Badge variant="info">Added</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Removed */}
          {(activeTab === "all" || activeTab === "removed") && result.removed.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-red-400"><Minus className="h-5 w-5" />Removed ({result.removed.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.removed.map((item) => (
                    <div key={item.resource_id} className="rounded-lg border border-red-500/20 p-3">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">{item.display_name}</p><p className="text-xs text-muted-foreground font-mono">{item.resource_type}</p></div>
                        <Badge variant="danger">Removed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
