"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserX,
  UserMinus,
  UserCheck,
  Clock,
} from "lucide-react";

type Tab = "inactive" | "never" | "disabled";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "inactive", label: "Inactive (30d+)", icon: Clock },
  { key: "never", label: "Never Signed In", icon: UserMinus },
  { key: "disabled", label: "Disabled Admins", icon: UserX },
];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}

export default function InactiveAdminsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("inactive");

  const { data, isLoading } = useQuery({
    queryKey: ["inactive-admins"],
    queryFn: api.getInactiveAdmins,
  });

  const tabDataMap = {
    inactive: data?.data.inactive ?? [],
    never: data?.data.never_signed_in ?? [],
    disabled: data?.data.disabled_admins ?? [],
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inactive Admins"
        description="Identify admin accounts that haven't signed in recently or are disabled"
      />

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total Admins</p>
                <p className="text-2xl font-bold">{data.summary.total_admins}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Inactive 30d+</p>
                <p className="text-2xl font-bold">{data.summary.inactive_30d}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserMinus className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Never Signed In</p>
                <p className="text-2xl font-bold">{data.summary.never_signed_in}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserX className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold">{data.summary.disabled_admins}</p>
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
            {data && <Badge variant="secondary" className="ml-2">{tabDataMap[activeTab].length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : tabDataMap[activeTab].length === 0 ? (
            <EmptyState text={`No ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()}`} />
          ) : (
            <div className="space-y-2">
              {tabDataMap[activeTab].map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{u.upn}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {u.roles.map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {u.days_inactive !== null && (
                      <span className={`text-sm font-medium ${u.days_inactive > 90 ? "text-red-500" : u.days_inactive > 60 ? "text-orange-500" : "text-yellow-500"}`}>
                        {u.days_inactive}d inactive
                      </span>
                    )}
                    {!u.enabled && <Badge variant="danger">Disabled</Badge>}
                    {u.last_signin === null && u.enabled && <Badge variant="warning">Never signed in</Badge>}
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
