"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, AuditLogEntry } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Users,
  Settings,
  Smartphone,
  ShieldCheck,
} from "lucide-react";

type Tab = "directory" | "policy" | "device" | "admin";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "directory", label: "Directory Changes", icon: Users },
  { key: "policy", label: "Policy Changes", icon: Settings },
  { key: "device", label: "Device Actions", icon: Smartphone },
  { key: "admin", label: "Admin Activity", icon: ShieldCheck },
];

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{entry.activity}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{entry.actor || "System"}</span>
          {entry.target?.name && (
            <>
              <span>&rarr;</span>
              <span className="truncate max-w-[200px]">{entry.target.name}</span>
            </>
          )}
          {entry.timestamp && (
            <>
              <span>&middot;</span>
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <Badge variant={entry.result === "success" ? "success" : entry.result === "failure" ? "danger" : "secondary"}>
          {entry.result}
        </Badge>
        <Badge variant="secondary">{entry.category}</Badge>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("directory");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: api.getAuditLogs,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Logs"
        description="Directory changes, policy changes, device actions, and admin activity"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{data.summary.total_events}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Directory</p>
                <p className="text-2xl font-bold">{data.summary.directory_changes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Settings className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Policy</p>
                <p className="text-2xl font-bold">{data.summary.policy_changes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Device</p>
                <p className="text-2xl font-bold">{data.summary.device_actions}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Admin</p>
                <p className="text-2xl font-bold">{data.summary.admin_activity}</p>
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
          ) : data?.data[activeTab].length === 0 ? (
            <EmptyState text={`No ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()} found`} />
          ) : (
            <div className="space-y-2">
              {data?.data[activeTab].map((entry: AuditLogEntry) => (
                <AuditRow key={entry.id} entry={entry} />
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
