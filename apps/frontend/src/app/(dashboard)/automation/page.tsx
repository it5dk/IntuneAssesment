"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  RefreshCw,
  FileCode,
  BookOpen,
} from "lucide-react";

type Tab = "remediation" | "runbooks" | "playbooks";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "remediation", label: "Auto Remediation", icon: RefreshCw },
  { key: "runbooks", label: "Runbooks", icon: FileCode },
  { key: "playbooks", label: "Security Playbooks", icon: BookOpen },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("remediation");

  const { data, isLoading } = useQuery({
    queryKey: ["automation"],
    queryFn: api.getAutomation,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Automation & Remediation"
        description="Auto remediation policies, runbooks, and security playbooks"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Remediation</p>
                <p className="text-2xl font-bold">{data.summary.remediation_policies}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileCode className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Scripts</p>
                <p className="text-2xl font-bold">{data.summary.scripts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Playbooks</p>
                <p className="text-2xl font-bold">{data.summary.playbooks}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
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

      {/* Tab content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = tabs.find((t) => t.key === activeTab)!.icon; return <Icon className="h-5 w-5" />; })()}
            {tabs.find((t) => t.key === activeTab)?.label}
            {data && (
              <Badge variant="secondary" className="ml-2">
                {data.data[activeTab].length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "remediation" ? (
            data?.data.remediation.length === 0 ? <EmptyState text="No auto remediation policies" /> : (
              <div className="space-y-2">
                {data?.data.remediation.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-1 truncate">{r.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant="secondary">{r.action_count} action(s)</Badge>
                      {r.last_modified && <span className="text-xs text-muted-foreground">{new Date(r.last_modified).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "runbooks" ? (
            data?.data.runbooks.length === 0 ? <EmptyState text="No runbooks found" /> : (
              <div className="space-y-2">
                {data?.data.runbooks.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {s.file_name && <span>{s.file_name}</span>}
                        {s.run_as && <><span>&middot;</span><span>Run as: {s.run_as}</span></>}
                        {s.created && <><span>&middot;</span><span>{new Date(s.created).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {s.signature_check && <Badge variant="success">Signed</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.playbooks.length === 0 ? <EmptyState text="No security playbooks found" /> : (
              <div className="space-y-2">
                {data?.data.playbooks.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {p.publisher && <span>{p.publisher}</span>}
                        {p.description && <><span>&middot;</span><span className="truncate max-w-[300px]">{p.description}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {p.is_global && <Badge variant="secondary">Global</Badge>}
                      {p.last_modified && <span className="text-xs text-muted-foreground">{new Date(p.last_modified).toLocaleDateString()}</span>}
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
