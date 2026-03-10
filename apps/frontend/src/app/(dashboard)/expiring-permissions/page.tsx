"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  Key,
  ShieldAlert,
  Users,
} from "lucide-react";

type Tab = "secrets" | "grants" | "assignments";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "secrets", label: "Expiring Secrets", icon: Key },
  { key: "grants", label: "OAuth Grants", icon: ShieldAlert },
  { key: "assignments", label: "App Role Assignments", icon: Users },
];

function statusBadge(status: string) {
  const map: Record<string, "danger" | "warning" | "success" | "secondary"> = {
    expired: "danger",
    critical: "danger",
    warning: "warning",
    healthy: "success",
  };
  return <Badge variant={map[status] || "secondary"}>{status}</Badge>;
}

function daysLabel(days: number | null) {
  if (days === null) return "N/A";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function ExpiringPermissionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("secrets");

  const { data, isLoading } = useQuery({
    queryKey: ["expiring-permissions"],
    queryFn: api.getExpiringPermissions,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expiring Permissions"
        description="OAuth grants, app secrets, and role assignments nearing expiration"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold">{data.summary.expired}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Critical (&le;30d)</p>
                <p className="text-2xl font-bold">{data.summary.critical}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Key className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Expiring Secrets</p>
                <p className="text-2xl font-bold">{data.summary.expiring_secrets}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Role Assignments</p>
                <p className="text-2xl font-bold">{data.summary.app_role_assignments}</p>
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "secrets" ? (
            data?.data.expiring_secrets.length === 0 ? <EmptyState text="No expiring secrets found" /> : (
              <div className="space-y-2">
                {data?.data.expiring_secrets.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.app_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{s.type}</span>
                        {s.hint && <><span>&middot;</span><span>{s.hint}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className={`text-sm font-medium ${s.days_remaining !== null && s.days_remaining < 0 ? "text-red-500" : "text-yellow-500"}`}>
                        {daysLabel(s.days_remaining)}
                      </span>
                      {statusBadge(s.status)}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "grants" ? (
            data?.data.oauth_grants.length === 0 ? <EmptyState text="No OAuth grants found" /> : (
              <div className="space-y-2">
                {data?.data.oauth_grants.map((g) => (
                  <div key={g.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate font-mono text-sm">{g.client_id}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{g.consent_type}</span>
                        <span>&middot;</span>
                        <span className="truncate max-w-[300px]">{g.scope}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {g.days_remaining !== null && (
                        <span className="text-sm font-medium">{daysLabel(g.days_remaining)}</span>
                      )}
                      {statusBadge(g.status)}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.app_role_assignments.length === 0 ? <EmptyState text="No app role assignments found" /> : (
              <div className="space-y-2">
                {data?.data.app_role_assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.principal_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">&rarr; {a.resource_name}</p>
                    </div>
                    {a.created && <span className="text-xs text-muted-foreground ml-4">{new Date(a.created).toLocaleDateString()}</span>}
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
