"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Bug,
  Flame,
  HardDrive,
  ShieldCheck,
} from "lucide-react";

type Tab = "antivirus" | "firewall" | "encryption" | "asr";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "antivirus", label: "Antivirus Status", icon: Bug },
  { key: "firewall", label: "Firewall Status", icon: Flame },
  { key: "encryption", label: "Disk Encryption", icon: HardDrive },
  { key: "asr", label: "Attack Surface Reduction", icon: Shield },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function EndpointProtectionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("antivirus");

  const { data, isLoading } = useQuery({
    queryKey: ["endpoint-protection"],
    queryFn: api.getEndpointProtection,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Endpoint Protection"
        description="Monitor antivirus, firewall, encryption, and attack surface reduction"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Bug className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Malware</p>
                <p className="text-2xl font-bold">{data.summary.malware_detections}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Flame className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Firewall</p>
                <p className="text-2xl font-bold">{data.summary.firewall_policies}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Encrypted</p>
                <p className="text-2xl font-bold">{data.summary.encrypted_devices}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Not Encrypted</p>
                <p className="text-2xl font-bold">{data.summary.unencrypted_devices}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">ASR Policies</p>
                <p className="text-2xl font-bold">{data.summary.asr_policies}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Encryption Pol.</p>
                <p className="text-2xl font-bold">{data.summary.encryption_policies}</p>
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
          ) : activeTab === "antivirus" ? (
            data?.data.antivirus.length === 0 ? <EmptyState text="No malware detections" /> : (
              <div className="space-y-2">
                {data?.data.antivirus.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{m.category}</span>
                        <span>&middot;</span>
                        <span>{m.device_count} device(s)</span>
                        {m.last_change && <><span>&middot;</span><span>{new Date(m.last_change).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant={m.severity === "high" || m.severity === "severe" ? "danger" : m.severity === "moderate" ? "warning" : "secondary"}>
                        {m.severity}
                      </Badge>
                      <Badge variant="secondary">{m.state}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Firewall, Encryption, ASR all share the same config policy shape
            data?.data[activeTab].length === 0 ? (
              <EmptyState text={`No ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()} policies found`} />
            ) : (
              <div className="space-y-2">
                {data?.data[activeTab].map((c: { id: string; name: string; description: string; last_modified: string | null; version: number | null }) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.description && <p className="text-xs text-muted-foreground mt-1 truncate">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {c.last_modified && <span className="text-xs text-muted-foreground">{new Date(c.last_modified).toLocaleDateString()}</span>}
                      {c.version && <Badge variant="secondary">v{c.version}</Badge>}
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
