"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  Users,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

type Tab = "roles" | "pim" | "alerts";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "roles", label: "Role Assignments", icon: Users },
  { key: "pim", label: "PIM Activations", icon: UserCheck },
  { key: "alerts", label: "Privileged Alerts", icon: ShieldAlert },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function PrivilegedAccessPage() {
  const [activeTab, setActiveTab] = useState<Tab>("roles");

  const { data, isLoading } = useQuery({
    queryKey: ["privileged-access"],
    queryFn: api.getPrivilegedAccess,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Privileged Access"
        description="Monitor directory role assignments, PIM activations, and privileged alerts"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Crown className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Roles</p>
                <p className="text-2xl font-bold">{data.summary.total_roles}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Assignments</p>
                <p className="text-2xl font-bold">{data.summary.total_assignments}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">PIM Active</p>
                <p className="text-2xl font-bold">{data.summary.active_pim}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Alerts</p>
                <p className="text-2xl font-bold">{data.summary.alerts}</p>
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
                {activeTab === "roles" ? data.data.role_assignments.length
                  : activeTab === "pim" ? data.data.pim_activations.length
                  : data.data.alerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "roles" ? (
            data?.data.role_assignments.length === 0 ? <EmptyState text="No role assignments found" /> : (
              <div className="space-y-2">
                {data?.data.role_assignments.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.member_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.member_upn}</p>
                    </div>
                    <Badge variant="secondary">{r.role_name}</Badge>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "pim" ? (
            data?.data.pim_activations.length === 0 ? <EmptyState text="No PIM activations found" /> : (
              <div className="space-y-2">
                {data?.data.pim_activations.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.action}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{p.principal_id}</span>
                        {p.created && <><span>&middot;</span><span>{new Date(p.created).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <Badge variant={p.status === "Provisioned" ? "success" : "secondary"}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.alerts.length === 0 ? <EmptyState text="No privileged alerts" /> : (
              <div className="space-y-2">
                {data?.data.alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.type} eligibility</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{a.principal_id}</span>
                        {a.created && <><span>&middot;</span><span>{new Date(a.created).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <Badge variant="warning">{a.status}</Badge>
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
