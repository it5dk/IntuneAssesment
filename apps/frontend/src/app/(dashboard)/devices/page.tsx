"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Monitor, Smartphone, ShieldCheck, Lock, Search,
  ChevronLeft, ChevronRight, Download, CheckSquare,
  Gauge, Target, Timer, Layers, BarChart3, Filter,
  Activity, Zap, Eye, Users,
} from "lucide-react";

function complianceBadge(state: string) {
  const map: Record<string, "success" | "danger" | "warning" | "secondary"> = {
    compliant: "success",
    noncompliant: "danger",
    inGracePeriod: "warning",
    unknown: "secondary",
    configManager: "secondary",
  };
  return <Badge variant={map[state] || "secondary"}>{state}</Badge>;
}

function osIcon(os: string) {
  const o = os.toLowerCase();
  if (o.includes("windows")) return <Monitor className="h-4 w-4" />;
  if (o.includes("ios") || o.includes("macos")) return <Smartphone className="h-4 w-4" />;
  if (o.includes("android")) return <Smartphone className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function DevicesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [complianceFilter, setComplianceFilter] = useState("");
  const [osFilter, setOsFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["device-summary"],
    queryFn: api.getDeviceSummary,
  });

  const { data: devicesData, isLoading } = useQuery({
    queryKey: ["devices", page, pageSize, complianceFilter, osFilter, searchQuery],
    queryFn: () =>
      api.getDevices({
        page,
        page_size: pageSize,
        compliance_state: complianceFilter || undefined,
        os: osFilter || undefined,
        search: searchQuery || undefined,
      }),
  });

  const devices = devicesData?.devices ?? [];
  const total = devicesData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === devices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(devices.map((d) => d.id)));
    }
  };

  const exportSelected = () => {
    const selected = devices.filter((d) => selectedIds.has(d.id));
    const csv = [
      ["Device Name", "OS", "OS Version", "Compliance", "Encrypted", "Model", "User", "Serial Number", "Last Sync"].join(","),
      ...selected.map((d) =>
        [d.device_name, d.os, d.os_version, d.compliance_state, d.is_encrypted, d.model, d.user, d.serial_number, d.last_sync].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devices-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Device Management Center" description="Endpoint Inventory & Health Analytics" />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            {summaryLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (
              <p className="text-2xl font-bold">{summary?.total ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total Devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            {summaryLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (
              <p className="text-2xl font-bold">{summary?.compliance?.compliant ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Compliant</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-red-400" />
            {summaryLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (
              <p className="text-2xl font-bold">{summary?.compliance?.noncompliant ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Non-Compliant</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Lock className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            {summaryLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : (
              <p className="text-2xl font-bold">{summary?.encryption?.encrypted ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Encrypted</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Device Inventory</CardTitle>
            <CardDescription>Complete inventory of all managed devices with real-time sync status and metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5 text-primary" /> Real-time device list</li>
              <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-blue-400" /> Advanced search</li>
              <li className="flex items-center gap-2"><Download className="h-3.5 w-3.5 text-amber-400" /> CSV export</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Health Analytics</CardTitle>
            <CardDescription>Monitor device health, compliance rates, and encryption status across your fleet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-emerald-400" /> Compliance tracking</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Health dashboards</li>
              <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-blue-400" /> Encryption status</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Smart Filtering</CardTitle>
            <CardDescription>Filter devices by compliance state, OS, encryption, and custom search queries.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-primary" /> Multi-criteria filters</li>
              <li className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-amber-400" /> OS breakdown</li>
              <li className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-emerald-400" /> Compliance view</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px]">CORE</Badge>
            </div>
            <CardTitle className="text-lg">Bulk Operations</CardTitle>
            <CardDescription>Select multiple devices for bulk export and group-level analysis.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><CheckSquare className="h-3.5 w-3.5 text-primary" /> Multi-select</li>
              <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-blue-400" /> Group analysis</li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-400" /> Batch export</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* OS breakdown */}
      {summary && Object.keys(summary.os_breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.os_breakdown).map(([os, count]) => (
            <Card key={os} className="flex-1 min-w-[120px]">
              <CardContent className="p-4 flex items-center gap-2">
                {osIcon(os)}
                <div>
                  <p className="text-sm font-medium">{count}</p>
                  <p className="text-xs text-muted-foreground">{os}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Device Overview card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Device Overview
          </CardTitle>
          <CardDescription>Managed device inventory with health analytics, filtering, and bulk operations</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search, filters, bulk actions */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>

            <select
              value={complianceFilter}
              onChange={(e) => { setComplianceFilter(e.target.value); setPage(1); }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Compliance</option>
              <option value="compliant">Compliant</option>
              <option value="noncompliant">Non-Compliant</option>
              <option value="unknown">Unknown</option>
            </select>

            <select
              value={osFilter}
              onChange={(e) => { setOsFilter(e.target.value); setPage(1); }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">All OS</option>
              <option value="Windows">Windows</option>
              <option value="iOS">iOS</option>
              <option value="Android">Android</option>
              <option value="macOS">macOS</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={250}>250 per page</option>
              <option value={500}>500 per page</option>
            </select>

            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={exportSelected}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Selected ({selectedIds.size})
              </Button>
            )}
          </div>

          {/* Devices table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No devices found. Run a Managed Devices monitor first.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Devices ({total})</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Page {page} of {totalPages}</span>
                  <Button size="icon" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Table header */}
              <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                <button onClick={toggleSelectAll} className="shrink-0">
                  <CheckSquare className={`h-4 w-4 ${selectedIds.size === devices.length ? "text-primary" : ""}`} />
                </button>
                <span className="w-[200px]">Device</span>
                <span className="w-[80px]">OS</span>
                <span className="w-[100px]">Compliance</span>
                <span className="flex-1">User</span>
                <span className="w-[80px] text-right">Encrypted</span>
              </div>

              {/* Device rows */}
              <div className="divide-y">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    onClick={() => toggleSelect(device.id)}
                    className={`flex items-center gap-3 px-3 py-3 text-sm cursor-pointer transition-colors ${
                      selectedIds.has(device.id) ? "bg-accent/50" : "hover:bg-accent/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(device.id)}
                      onChange={() => toggleSelect(device.id)}
                      className="shrink-0 rounded border-border"
                    />
                    <div className="w-[200px] min-w-0">
                      <p className="font-medium truncate">{device.device_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{device.model}</p>
                    </div>
                    <div className="w-[80px] flex items-center gap-1.5">
                      {osIcon(device.os)}
                      <span className="text-xs truncate">{device.os}</span>
                    </div>
                    <div className="w-[100px]">
                      {complianceBadge(device.compliance_state)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{device.user || "\u2014"}</p>
                    </div>
                    <div className="w-[80px] text-right">
                      {device.is_encrypted ? (
                        <Lock className="h-4 w-4 text-emerald-400 inline" />
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
