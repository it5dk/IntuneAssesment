"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ghost,
  Users,
  ShieldAlert,
  Archive,
} from "lucide-react";

type Tab = "consented" | "thirdparty" | "stale";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "consented", label: "User Consented", icon: Users },
  { key: "thirdparty", label: "Third-Party Apps", icon: ShieldAlert },
  { key: "stale", label: "Stale Apps", icon: Archive },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <Ghost className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function ShadowAppsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("consented");

  const { data, isLoading } = useQuery({
    queryKey: ["shadow-apps"],
    queryFn: api.getShadowApps,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shadow Apps"
        description="Discover user-consented, third-party, and stale applications"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Ghost className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total Shadow</p>
                <p className="text-2xl font-bold">{data.summary.total_shadow}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">User Consented</p>
                <p className="text-2xl font-bold">{data.summary.user_consented_apps}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Third-Party</p>
                <p className="text-2xl font-bold">{data.summary.third_party_apps}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Archive className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Stale Apps</p>
                <p className="text-2xl font-bold">{data.summary.stale_apps}</p>
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
          ) : activeTab === "consented" ? (
            data?.data.user_consented.length === 0 ? <EmptyState text="No user-consented apps found" /> : (
              <div className="space-y-2">
                {data?.data.user_consented.map((app) => (
                  <div key={app.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{app.app_name}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {app.scopes.slice(0, 5).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                        {app.scopes.length > 5 && <Badge variant="secondary" className="text-[10px]">+{app.scopes.length - 5} more</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant="info">{app.user_count} user(s)</Badge>
                      <Badge variant="secondary">{app.scope_count} scope(s)</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "thirdparty" ? (
            data?.data.high_privilege.length === 0 ? <EmptyState text="No third-party apps found" /> : (
              <div className="space-y-2">
                {data?.data.high_privilege.map((app) => (
                  <div key={app.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{app.app_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{app.publisher}</span>
                        {app.created && <><span>&middot;</span><span>{new Date(app.created).toLocaleDateString()}</span></>}
                        {app.days_old !== null && <><span>&middot;</span><span>{app.days_old}d old</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {app.verified ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Unverified</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            data?.data.stale_apps.length === 0 ? <EmptyState text="No stale apps found" /> : (
              <div className="space-y-2">
                {data?.data.stale_apps.map((app) => (
                  <div key={app.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{app.app_name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{app.app_id}</span>
                        {app.created && <><span>&middot;</span><span>Created {new Date(app.created).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {app.days_old !== null && (
                        <span className={`text-sm font-medium ${app.days_old > 365 ? "text-red-500" : "text-yellow-500"}`}>
                          {app.days_old}d old
                        </span>
                      )}
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
