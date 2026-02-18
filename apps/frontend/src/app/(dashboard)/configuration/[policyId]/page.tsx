"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Code, FileJson } from "lucide-react";

export default function ConfigPolicyDetailPage() {
  const { policyId } = useParams<{ policyId: string }>();
  const [viewMode, setViewMode] = useState<"settings" | "raw" | "normalized">("settings");

  const { data, isLoading } = useQuery({
    queryKey: ["config-policy-settings", policyId],
    queryFn: () => api.getConfigPolicySettings(policyId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Policy not found</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={data.display_name || policyId}
        description={`${data.resource_type} - ${data.platform}`}
      />

      {/* Info card */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold">{data.settings.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Settings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm font-medium truncate">{data.platform.split(".").pop()}</p>
            <p className="text-xs text-muted-foreground mt-1">Platform</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm font-medium truncate">{data.resource_type.split(".").pop()}</p>
            <p className="text-xs text-muted-foreground mt-1">Type</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm font-mono truncate">{policyId.slice(0, 12)}...</p>
            <p className="text-xs text-muted-foreground mt-1">Policy ID</p>
          </CardContent>
        </Card>
      </div>

      {/* View mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("settings")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "settings" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
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

      {/* Content */}
      {viewMode === "settings" ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Settings ({data.settings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.settings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No configurable settings found</p>
            ) : (
              <div className="space-y-2">
                {data.settings.map((setting, idx) => (
                  <div key={idx} className="flex items-start justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-mono font-medium">{setting.key}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Type: {setting.type}</p>
                    </div>
                    <div className="ml-4 max-w-[50%] text-right shrink-0">
                      <pre className="text-xs text-foreground bg-accent rounded px-2 py-1 overflow-auto max-h-20 whitespace-pre-wrap break-all">
                        {typeof setting.value === "object"
                          ? JSON.stringify(setting.value, null, 2)
                          : String(setting.value)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{viewMode === "raw" ? "Raw JSON" : "Normalized JSON"}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-background p-4 text-xs overflow-auto max-h-[600px] border">
              {JSON.stringify(viewMode === "raw" ? data.raw : data.normalized, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
