"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AppWindow, FolderTree, Search, ListFilter } from "lucide-react";

type TabView = "all" | "apps" | "groups";

function intentBadge(intent: string) {
  const map: Record<string, "success" | "danger" | "info" | "warning"> = {
    required: "danger",
    available: "success",
    uninstall: "warning",
    apply: "info",
  };
  return <Badge variant={map[intent] || "secondary"}>{intent}</Badge>;
}

export default function AssignmentsPage() {
  const [tab, setTab] = useState<TabView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ["assignments-all", typeFilter, searchQuery],
    queryFn: () => api.getAllAssessments({
      type_filter: typeFilter || undefined,
      search: searchQuery || undefined,
    }),
    enabled: tab === "all",
  });

  const { data: appData, isLoading: appLoading } = useQuery({
    queryKey: ["assignments-apps", searchQuery],
    queryFn: () => api.getAppAssessments(searchQuery || undefined),
    enabled: tab === "apps",
  });

  const { data: groupData, isLoading: groupLoading } = useQuery({
    queryKey: ["assignments-groups", searchQuery],
    queryFn: () => api.getGroupAssessments(searchQuery || undefined),
    enabled: tab === "groups",
  });

  const isLoading = tab === "all" ? allLoading : tab === "apps" ? appLoading : groupLoading;

  return (
    <div className="space-y-8">
      <PageHeader title="Assignments" description="Manage policy, app, and configuration assignments across users and groups" />

      {/* Tab cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button onClick={() => setTab("all")} className="text-left">
          <Card className={`transition-colors ${tab === "all" ? "border-primary" : "hover:border-primary/50"}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <ListFilter className="h-5 w-5 text-primary" />
                <p className="font-medium text-sm">All Assignments</p>
              </div>
              <p className="text-xs text-muted-foreground">Comprehensive view with filtering by type, status, and target</p>
              {allData && <p className="text-lg font-bold mt-2">{allData.total}</p>}
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setTab("apps")} className="text-left">
          <Card className={`transition-colors ${tab === "apps" ? "border-primary" : "hover:border-primary/50"}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <AppWindow className="h-5 w-5 text-amber-400" />
                <p className="font-medium text-sm">App Assignments</p>
              </div>
              <p className="text-xs text-muted-foreground">Application deployment tracking and distribution monitoring</p>
              {appData && <p className="text-lg font-bold mt-2">{appData.total} apps</p>}
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setTab("groups")} className="text-left">
          <Card className={`transition-colors ${tab === "groups" ? "border-primary" : "hover:border-primary/50"}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-5 w-5 text-emerald-400" />
                <p className="font-medium text-sm">Group Assignments</p>
              </div>
              <p className="text-xs text-muted-foreground">Group-specific policy and configuration insights</p>
              {groupData && <p className="text-lg font-bold mt-2">{groupData.total} groups</p>}
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {tab === "all" && (
          <div className="flex gap-2">
            {["", "app", "group"].map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "" ? "All Types" : f === "app" ? "Apps" : "Groups"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          {/* All Assignments view */}
          {tab === "all" && (
            <Card>
              <CardHeader>
                <CardTitle>All Assignments ({allData?.total ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!allData?.assignments.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No assignments found. Run App Assessment or Group Assessment monitors first.</p>
                ) : (
                  <div className="space-y-2">
                    {allData.assignments.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shrink-0">
                            {a.type === "app" ? <AppWindow className="h-4 w-4" /> : <FolderTree className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.source_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {a.target_group_id ? `Group: ${a.target_group_id.slice(0, 8)}...` : "All users/devices"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Badge variant="secondary" className="text-xs">{a.type}</Badge>
                          {intentBadge(a.intent)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* App Assignments view */}
          {tab === "apps" && (
            <Card>
              <CardHeader>
                <CardTitle>App Assignments ({appData?.total ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!appData?.apps.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No app assignments found</p>
                ) : (
                  <div className="space-y-3">
                    {appData.apps.map((app) => (
                      <div key={app.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{app.display_name}</p>
                            <p className="text-xs text-muted-foreground">{app.publisher}</p>
                          </div>
                          <Badge variant="secondary">{app.assignment_count} assignments</Badge>
                        </div>
                        {app.assignments.length > 0 && (
                          <div className="space-y-1.5">
                            {app.assignments.map((a, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-1.5 text-xs">
                                <span className="text-muted-foreground truncate">
                                  {a.target_group_id ? `Group: ${a.target_group_id.slice(0, 12)}...` : "All users/devices"}
                                </span>
                                {intentBadge(a.intent)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Group Assignments view */}
          {tab === "groups" && (
            <Card>
              <CardHeader>
                <CardTitle>Group Assignments ({groupData?.total ?? 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!groupData?.groups.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No group assignments found</p>
                ) : (
                  <div className="space-y-3">
                    {groupData.groups.map((group) => (
                      <div key={group.group_id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium font-mono text-sm">{group.group_id}</p>
                          </div>
                          <Badge variant="secondary">{group.assignment_count} policies</Badge>
                        </div>
                        {group.assignments.length > 0 && (
                          <div className="space-y-1.5">
                            {group.assignments.map((a, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-1.5 text-xs">
                                <span className="truncate">{a.policy_name}</span>
                                <Badge variant="outline" className="text-[10px] ml-2">{a.policy_type.split("/").pop()}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
