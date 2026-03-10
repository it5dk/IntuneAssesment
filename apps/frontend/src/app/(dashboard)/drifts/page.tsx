"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, CertificateEntry, AccessPolicyEntry } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  KeyRound,
  FileKey,
  Clock,
  Shield,
} from "lucide-react";

type Tab = "secrets" | "certificates" | "expiration" | "access";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "secrets", label: "Secrets", icon: KeyRound },
  { key: "certificates", label: "Certificates", icon: FileKey },
  { key: "expiration", label: "Expiration Monitor", icon: Clock },
  { key: "access", label: "Access Policies", icon: Shield },
];

function statusBadge(status: string) {
  const map: Record<string, "danger" | "warning" | "success" | "secondary"> = {
    expired: "danger",
    critical: "danger",
    warning: "warning",
    healthy: "success",
    unknown: "secondary",
  };
  return <Badge variant={map[status] || "secondary"}>{status}</Badge>;
}

function daysLabel(days: number | null) {
  if (days === null) return "N/A";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

function daysColor(days: number | null) {
  if (days === null) return "text-muted-foreground";
  if (days < 0) return "text-red-500";
  if (days <= 30) return "text-red-400";
  if (days <= 90) return "text-yellow-500";
  return "text-green-500";
}

function CertRow({ cert }: { cert: CertificateEntry }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{cert.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">{cert.category}</Badge>
          <span>{cert.type}</span>
          {cert.detail && (
            <>
              <span>&middot;</span>
              <span className="truncate max-w-[200px]">{cert.detail}</span>
            </>
          )}
          {cert.expires && (
            <>
              <span>&middot;</span>
              <span>{new Date(cert.expires).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <span className={`text-sm font-medium ${daysColor(cert.days_remaining)}`}>
          {daysLabel(cert.days_remaining)}
        </span>
        {statusBadge(cert.status)}
      </div>
    </div>
  );
}

function SecretsTab({ items }: { items: CertificateEntry[] }) {
  const secrets = items.filter((c) => c.type === "Client Secret");
  if (secrets.length === 0) {
    return <EmptyState text="No client secrets found" />;
  }
  return (
    <div className="space-y-2">
      {secrets.map((cert) => <CertRow key={cert.id} cert={cert} />)}
    </div>
  );
}

function CertificatesTab({ items }: { items: CertificateEntry[] }) {
  const certs = items.filter((c) => c.type !== "Client Secret");
  if (certs.length === 0) {
    return <EmptyState text="No certificates or tokens found" />;
  }
  return (
    <div className="space-y-2">
      {certs.map((cert) => <CertRow key={cert.id} cert={cert} />)}
    </div>
  );
}

function ExpirationTab({ items }: { items: CertificateEntry[] }) {
  if (items.length === 0) {
    return <EmptyState text="No items to monitor" />;
  }
  const expiring = items.filter((c) => c.status !== "healthy");
  const healthy = items.filter((c) => c.status === "healthy");

  return (
    <div className="space-y-6">
      {expiring.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Needs Attention ({expiring.length})
          </h3>
          <div className="space-y-2">
            {expiring.map((cert) => <CertRow key={cert.id} cert={cert} />)}
          </div>
        </div>
      )}
      {healthy.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Healthy ({healthy.length})
          </h3>
          <div className="space-y-2">
            {healthy.map((cert) => <CertRow key={cert.id} cert={cert} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function AccessPoliciesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["access-policies"],
    queryFn: api.getAccessPolicies,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!data?.policies.length) {
    return <EmptyState text="No access policies found" />;
  }

  return (
    <div className="space-y-2">
      {data.policies.map((policy: AccessPolicyEntry) => (
        <div
          key={policy.id}
          className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{policy.app_name}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>&rarr; {policy.resource_name}</span>
              <span>&middot;</span>
              <span className="font-mono">{policy.app_id}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {policy.application_permissions > 0 && (
              <Badge variant="danger" className="text-[10px]">
                {policy.application_permissions} App
              </Badge>
            )}
            {policy.delegated_permissions > 0 && (
              <Badge variant="info" className="text-[10px]">
                {policy.delegated_permissions} Delegated
              </Badge>
            )}
            <Badge variant="secondary">{policy.total_permissions} total</Badge>
          </div>
        </div>
      ))}
      {data.errors.length > 0 && (
        <Card className="border-yellow-500/50 mt-4">
          <CardContent className="p-4">
            {data.errors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">{e.source}: {e.error}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <KeyRound className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function KeyVaultPage() {
  const [activeTab, setActiveTab] = useState<Tab>("secrets");

  const { data, isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: api.getCertificates,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Key Vault"
        description="Manage and monitor certificates, secrets, tokens, and access policies"
      />

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold">{data.summary.expired}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold">{data.summary.critical}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Warning</p>
                <p className="text-2xl font-bold">{data.summary.warning}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold">{data.summary.healthy}</p>
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

      {/* Errors */}
      {data?.errors && data.errors.length > 0 && activeTab !== "access" && (
        <Card className="border-yellow-500/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-yellow-500 mb-2">Some sources could not be loaded:</p>
            {data.errors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">{e.source}: {e.error}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tab content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {tabs.find((t) => t.key === activeTab)?.icon &&
              (() => {
                const Icon = tabs.find((t) => t.key === activeTab)!.icon;
                return <Icon className="h-5 w-5" />;
              })()}
            {tabs.find((t) => t.key === activeTab)?.label}
            {data && activeTab !== "access" && (
              <Badge variant="secondary" className="ml-2">
                {activeTab === "secrets"
                  ? data.certificates.filter((c) => c.type === "Client Secret").length
                  : activeTab === "certificates"
                  ? data.certificates.filter((c) => c.type !== "Client Secret").length
                  : data.certificates.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && activeTab !== "access" ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : activeTab === "secrets" ? (
            <SecretsTab items={data?.certificates ?? []} />
          ) : activeTab === "certificates" ? (
            <CertificatesTab items={data?.certificates ?? []} />
          ) : activeTab === "expiration" ? (
            <ExpirationTab items={data?.certificates ?? []} />
          ) : (
            <AccessPoliciesTab />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
