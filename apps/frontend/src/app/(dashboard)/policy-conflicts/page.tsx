"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Swords,
  Layers,
  FileX,
} from "lucide-react";

type Tab = "conflicts" | "overlaps" | "unassigned";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "conflicts", label: "Conflicts", icon: Swords },
  { key: "overlaps", label: "Overlapping Groups", icon: Layers },
  { key: "unassigned", label: "Unassigned Policies", icon: FileX },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function PolicyConflictsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("conflicts");

  const { data, isLoading } = useQuery({
    queryKey: ["policy-conflicts"],
    queryFn: api.getPolicyConflicts,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Policy Conflict Detection"
        description="Find conflicting, overlapping, and unassigned policies"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Swords className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Conflicts</p>
                <p className="text-2xl font-bold">{data.summary.total_conflicts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Swords className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">High Severity</p>
                <p className="text-2xl font-bold">{data.summary.high_severity}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Layers className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Overlaps</p>
                <p className="text-2xl font-bold">{data.summary.total_overlaps}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileX className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold">{data.summary.unassigned_policies}</p>
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
            {data && <Badge variant="secondary" className="ml-2">{data.data[activeTab].length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "conflicts" ? (
            data?.data.conflicts.length === 0 ? <EmptyState text="No policy conflicts detected" /> : (
              <div className="space-y-2">
                {data?.data.conflicts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Group: <span className="font-mono text-sm">{c.group_id}</span></p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{c.policy_type}</span>
                        <span>&middot;</span>
                        <span>{c.policy_count} conflicting policies</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.policies.map((p) => (
                          <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name}</Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={c.severity === "high" ? "danger" : c.severity === "medium" ? "warning" : "secondary"} className="ml-4">
                      {c.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "overlaps" ? (
            data?.data.overlaps.length === 0 ? <EmptyState text="No overlapping assignments" /> : (
              <div className="space-y-2">
                {data?.data.overlaps.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Group: <span className="font-mono text-sm">{o.group_id}</span></p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {o.policies.map((p) => (
                          <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name} ({p.type})</Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-4">{o.total_policies} policies</Badge>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.unassigned.length === 0 ? <EmptyState text="All policies are assigned" /> : (
              <div className="space-y-2">
                {data?.data.unassigned.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{u.name}</p>
                    </div>
                    <Badge variant="secondary">{u.type}</Badge>
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
