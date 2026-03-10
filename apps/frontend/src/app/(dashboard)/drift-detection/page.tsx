"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitCompare,
  FileCheck,
  Settings,
  AppWindow,
} from "lucide-react";

type Tab = "profiles" | "policies" | "apps";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profiles", label: "Config Profiles", icon: Settings },
  { key: "policies", label: "Compliance Policies", icon: FileCheck },
  { key: "apps", label: "App Configurations", icon: AppWindow },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <GitCompare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function DriftDetectionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profiles");

  const { data, isLoading } = useQuery({
    queryKey: ["drift-detection"],
    queryFn: api.getDriftDetection,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Drift Detection"
        description="Detect configuration drift by comparing current state against baseline"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <GitCompare className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total Drifted</p>
                <p className="text-2xl font-bold">{data.summary.total_drifted}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Settings className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Profiles</p>
                <p className="text-2xl font-bold">{data.summary.drifted_profiles}/{data.summary.total_profiles}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Policies</p>
                <p className="text-2xl font-bold">{data.summary.drifted_policies}/{data.summary.total_policies}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AppWindow className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">App Configs</p>
                <p className="text-2xl font-bold">{data.summary.drifted_apps}/{data.summary.total_apps}</p>
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
          ) : data?.data[activeTab].length === 0 ? (
            <EmptyState text="No items found" />
          ) : (
            <div className="space-y-2">
              {data?.data[activeTab].map((item: { id: string; name: string; description: string; created: string; last_modified: string; version: number; drifted: boolean }) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {item.last_modified && <span>Modified: {new Date(item.last_modified).toLocaleString()}</span>}
                      <span>&middot;</span>
                      <span>v{item.version}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {item.drifted ? (
                      <Badge variant="danger">Drifted</Badge>
                    ) : (
                      <Badge variant="success">Baseline</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
