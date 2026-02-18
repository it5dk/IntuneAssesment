"use client";

import { useRef, useState } from "react";
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
  Activity, Zap, Eye, Users, RefreshCw,
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
  const [activeModule, setActiveModule] = useState<"inventory" | "health" | "filtering" | "bulk">("inventory");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [complianceFilter, setComplianceFilter] = useState("");
  const [osFilter, setOsFilter] = useState("");
  const [advancedEncryptedOnly, setAdvancedEncryptedOnly] = useState(false);
  const [advancedWithUserOnly, setAdvancedWithUserOnly] = useState(false);
  const [advancedStaleOnly, setAdvancedStaleOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "last_sync_desc" | "compliance" | "os">("last_sync_desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const inventoryRef = useRef<HTMLDivElement | null>(null);
  const healthRef = useRef<HTMLDivElement | null>(null);
  const filteringRef = useRef<HTMLDivElement | null>(null);
  const bulkRef = useRef<HTMLDivElement | null>(null);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary, isFetching: summaryFetching } = useQuery({
    queryKey: ["device-summary"],
    queryFn: api.getDeviceSummary,
    refetchInterval: activeModule === "inventory" ? 15000 : false,
  });

  const { data: devicesData, isLoading, refetch: refetchDevices, isFetching: devicesFetching } = useQuery({
    queryKey: ["devices", page, pageSize, complianceFilter, osFilter, searchQuery],
    queryFn: () =>
      api.getDevices({
        page,
        page_size: pageSize,
        compliance_state: complianceFilter || undefined,
        os: osFilter || undefined,
        search: searchQuery || undefined,
      }),
    refetchInterval: activeModule === "inventory" ? 15000 : false,
  });

  const devices = devicesData?.devices ?? [];
  const filteredDevices = devices.filter((d) => {
    if (advancedEncryptedOnly && !d.is_encrypted) return false;
    if (advancedWithUserOnly && !d.user) return false;
    if (advancedStaleOnly) {
      if (!d.last_sync) return false;
      const lastSync = new Date(d.last_sync);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (lastSync > sevenDaysAgo) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "name") return (a.device_name || "").localeCompare(b.device_name || "");
    if (sortBy === "os") return (a.os || "").localeCompare(b.os || "");
    if (sortBy === "compliance") return (a.compliance_state || "").localeCompare(b.compliance_state || "");
    const aSync = a.last_sync ? new Date(a.last_sync).getTime() : 0;
    const bSync = b.last_sync ? new Date(b.last_sync).getTime() : 0;
    return bSync - aSync;
  });
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
    if (selectedIds.size === filteredDevices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDevices.map((d) => d.id)));
    }
  };

  const exportCsv = (rows: typeof devices) => {
    const csv = [
      ["Device Name", "OS", "OS Version", "Compliance", "Encrypted", "Model", "User", "Serial Number", "Last Sync"].join(","),
      ...rows.map((d) =>
        [d.device_name, d.os, d.os_version, d.compliance_state, d.is_encrypted, d.model, d.user, d.serial_number, d.last_sync]
          .map((v) => `"${String(v ?? "").replaceAll("\"", "\"\"")}"`)
          .join(",")
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
  const exportSelected = () => exportCsv(filteredDevices.filter((d) => selectedIds.has(d.id)));
  const exportCurrentView = () => exportCsv(filteredDevices);
  const selectedDevices = filteredDevices.filter((d) => selectedIds.has(d.id));
  const selectedByCompliance = selectedDevices.reduce<Record<string, number>>((acc, d) => {
    acc[d.compliance_state] = (acc[d.compliance_state] || 0) + 1;
    return acc;
  }, {});
  const selectedByOs = selectedDevices.reduce<Record<string, number>>((acc, d) => {
    acc[d.os] = (acc[d.os] || 0) + 1;
    return acc;
  }, {});

  const syncStatus = (lastSync?: string | null) => {
    if (!lastSync) return { label: "Unknown", cls: "text-muted-foreground" };
    const dt = new Date(lastSync);
    const diffHours = (Date.now() - dt.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 24) return { label: "Fresh", cls: "text-emerald-400" };
    if (diffHours <= 72) return { label: "Aging", cls: "text-amber-400" };
    return { label: "Stale", cls: "text-red-400" };
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
        <button
          className="text-left"
          onClick={() => {
            setActiveModule("inventory");
            inventoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "inventory" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "inventory" ? "default" : "secondary"} className="text-[10px]">{activeModule === "inventory" ? "ACTIVE" : "CORE"}</Badge>
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
        </button>
        <button
          className="text-left"
          onClick={() => {
            setActiveModule("health");
            healthRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "health" ? "border-primary/70" : "hover:border-primary/40"}`}>
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
        </button>
        <button
          className="text-left"
          onClick={() => {
            setActiveModule("filtering");
            filteringRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "filtering" ? "border-primary/70" : "hover:border-primary/40"}`}>
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
        </button>
        <button
          className="text-left"
          onClick={() => {
            setActiveModule("bulk");
            bulkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "bulk" ? "border-primary/70" : "hover:border-primary/40"}`}>
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
        </button>
      </div>

      {activeModule === "health" && (
        <Card ref={healthRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Health Analytics
            </CardTitle>
            <CardDescription>Compliance tracking, health dashboard, and encryption status across managed devices.</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Compliance Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Compliant: <span className="font-semibold">{summary?.compliance?.compliant ?? 0}</span></p>
                    <p>Non-compliant: <span className="font-semibold">{summary?.compliance?.noncompliant ?? 0}</span></p>
                    <p>Unknown: <span className="font-semibold">{summary?.compliance?.unknown ?? 0}</span></p>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Health Dashboard</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Total devices: <span className="font-semibold">{summary?.total ?? 0}</span></p>
                    <p>Compliance rate: <span className="font-semibold">
                      {summary?.total ? `${Math.round(((summary.compliance?.compliant ?? 0) / summary.total) * 100)}%` : "0%"}
                    </span></p>
                    <p>Inventory snapshot: <span className="font-semibold">Live</span></p>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Encryption Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Encrypted: <span className="font-semibold">{summary?.encryption?.encrypted ?? 0}</span></p>
                    <p>Not encrypted: <span className="font-semibold">{summary?.encryption?.not_encrypted ?? 0}</span></p>
                    <p>Coverage: <span className="font-semibold">
                      {summary?.total ? `${Math.round(((summary.encryption?.encrypted ?? 0) / summary.total) * 100)}%` : "0%"}
                    </span></p>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeModule === "filtering" && (
        <Card ref={filteringRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Smart Filtering
            </CardTitle>
            <CardDescription>
              Filter devices by compliance state, OS, encryption, and custom search queries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground mb-1">Multi-criteria filters</p>
              <p>Use search + compliance + OS + encryption/stale toggles together for precise targeting.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground mb-1">OS breakdown</p>
              <p>Use the OS cards below to quickly validate platform distribution and filter focus.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground mb-1">Compliance view</p>
              <p>Switch compliance states to isolate non-compliant or unknown devices for remediation.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeModule === "bulk" && (
        <Card ref={bulkRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Bulk Operations
            </CardTitle>
            <CardDescription>Select multiple devices for bulk export and group-level analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Multi-select</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Select rows in the inventory table to build your batch set.
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Group analysis</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Analyze selected devices by compliance and OS for quick triage.
                </CardContent>
              </Card>
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Batch export</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Export selected devices or current filtered view to CSV.
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Selected devices: {selectedDevices.length}</p>
              {selectedDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No devices selected yet. Use checkboxes in Device Overview.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">By compliance</p>
                    <div className="space-y-1 text-xs">
                      {Object.entries(selectedByCompliance).map(([state, count]) => (
                        <div key={state} className="flex items-center justify-between">
                          <span>{state}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">By OS</p>
                    <div className="space-y-1 text-xs">
                      {Object.entries(selectedByOs).map(([os, count]) => (
                        <div key={os} className="flex items-center justify-between">
                          <span>{os}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCurrentView} disabled={filteredDevices.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Batch export current view
              </Button>
              <Button variant="outline" onClick={exportSelected} disabled={selectedDevices.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Batch export selected ({selectedDevices.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
      <Card ref={inventoryRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Device Overview
          </CardTitle>
          <CardDescription>Managed device inventory with health analytics, filtering, and bulk operations</CardDescription>
          {activeModule === "inventory" && (
            <p className="text-xs text-primary">Inventory mode active: list auto-refreshes every 15s.</p>
          )}
          <div className="text-xs text-muted-foreground">
            Snapshot: {devicesData?.snapshot_at ? new Date(devicesData.snapshot_at).toLocaleString() : "N/A"}
          </div>
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
              title="Sort devices"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "last_sync_desc" | "compliance" | "os")}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="last_sync_desc">Sort: Last sync (newest)</option>
              <option value="name">Sort: Name</option>
              <option value="compliance">Sort: Compliance</option>
              <option value="os">Sort: OS</option>
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

            <label className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs">
              <input type="checkbox" checked={advancedEncryptedOnly} onChange={(e) => setAdvancedEncryptedOnly(e.target.checked)} />
              Encrypted only
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs">
              <input type="checkbox" checked={advancedWithUserOnly} onChange={(e) => setAdvancedWithUserOnly(e.target.checked)} />
              Has user
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs">
              <input type="checkbox" checked={advancedStaleOnly} onChange={(e) => setAdvancedStaleOnly(e.target.checked)} />
              Last sync &gt; 7d
            </label>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setComplianceFilter("noncompliant");
                setAdvancedEncryptedOnly(false);
                setAdvancedStaleOnly(false);
                setPage(1);
              }}
            >
              Non-compliant quick view
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdvancedEncryptedOnly(false);
                setAdvancedStaleOnly(true);
                setPage(1);
              }}
            >
              Stale sync quick view
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setComplianceFilter("");
                setOsFilter("");
                setAdvancedEncryptedOnly(false);
                setAdvancedWithUserOnly(false);
                setAdvancedStaleOnly(false);
                setSortBy("last_sync_desc");
                setSelectedIds(new Set());
                setPage(1);
              }}
            >
              Clear filters
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refetchDevices();
                refetchSummary();
              }}
              disabled={devicesFetching || summaryFetching}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${devicesFetching || summaryFetching ? "animate-spin" : ""}`} />
              Refresh now
            </Button>

            {filteredDevices.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportCurrentView}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export Current View ({filteredDevices.length})
              </Button>
            )}

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
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No devices found for current filters. Try adjusting search/advanced filters.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Devices ({filteredDevices.length} shown / {total} total)</p>
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
                  <CheckSquare className={`h-4 w-4 ${selectedIds.size === filteredDevices.length ? "text-primary" : ""}`} />
                </button>
                <span className="w-[200px]">Device</span>
                <span className="w-[80px]">OS</span>
                <span className="w-[100px]">Compliance</span>
                <span className="flex-1">User</span>
                <span className="w-[170px]">Last Sync</span>
                <span className="w-[80px] text-right">Encrypted</span>
              </div>

              {/* Device rows */}
              <div className="divide-y">
                {filteredDevices.map((device) => (
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
                    <div className="w-[170px]">
                      <p className="text-xs text-muted-foreground truncate">
                        {device.last_sync ? new Date(device.last_sync).toLocaleString() : "N/A"}
                      </p>
                      <p className={`text-[10px] ${syncStatus(device.last_sync).cls}`}>{syncStatus(device.last_sync).label}</p>
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
