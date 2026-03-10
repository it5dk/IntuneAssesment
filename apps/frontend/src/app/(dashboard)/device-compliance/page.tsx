"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldX,
  Smartphone,
  FileCheck,
  AlertTriangle,
} from "lucide-react";

type Tab = "noncompliant" | "policies" | "jailbroken";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "noncompliant", label: "Non-Compliant Devices", icon: ShieldX },
  { key: "policies", label: "Compliance Policies", icon: FileCheck },
  { key: "jailbroken", label: "Jailbroken / Rooted", icon: AlertTriangle },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function DeviceCompliancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("noncompliant");

  const { data, isLoading } = useQuery({
    queryKey: ["device-compliance"],
    queryFn: api.getDeviceCompliance,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Device Compliance"
        description="Monitor device compliance state, policies, and jailbreak status"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldX className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Non-Compliant</p>
                <p className="text-2xl font-bold">{data.summary.noncompliant}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Compliant</p>
                <p className="text-2xl font-bold">{data.summary.compliant}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Jailbroken</p>
                <p className="text-2xl font-bold">{data.summary.jailbroken}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Policies</p>
                <p className="text-2xl font-bold">{data.summary.total_policies}</p>
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
                {activeTab === "noncompliant" ? data.data.noncompliant.length
                  : activeTab === "policies" ? data.data.policies.length
                  : data.data.jailbroken.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "noncompliant" ? (
            data?.data.noncompliant.length === 0 ? <EmptyState text="No non-compliant devices" /> : (
              <div className="space-y-2">
                {data?.data.noncompliant.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{d.device_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{d.os} {d.os_version}</span>
                        <span>&middot;</span>
                        <span>{d.user}</span>
                        {d.model && <><span>&middot;</span><span>{d.model}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {d.last_sync && <span className="text-xs text-muted-foreground">{new Date(d.last_sync).toLocaleDateString()}</span>}
                      <Badge variant="danger">Non-Compliant</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "policies" ? (
            data?.data.policies.length === 0 ? <EmptyState text="No compliance policies found" /> : (
              <div className="space-y-2">
                {data?.data.policies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 truncate">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {p.last_modified && <span className="text-xs text-muted-foreground">{new Date(p.last_modified).toLocaleDateString()}</span>}
                      {p.version && <Badge variant="secondary">v{p.version}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.jailbroken.length === 0 ? <EmptyState text="No jailbroken or rooted devices" /> : (
              <div className="space-y-2">
                {data?.data.jailbroken.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{d.device_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{d.os} {d.os_version}</span>
                        <span>&middot;</span>
                        <span>{d.user}</span>
                      </div>
                    </div>
                    <Badge variant="danger">Jailbroken</Badge>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Errors */}
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
