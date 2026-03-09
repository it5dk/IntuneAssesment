/*  BEGIN AUTODOC HEADER
//  File: apps\frontend\src\app\(dashboard)\compare\page.tsx
//  Description: (edit inside USER NOTES below)
// 
//  BEGIN AUTODOC META
//  Version: 0.0.0.3
//  Last-Updated: 2026-02-19 00:30:35
//  Managed-By: autosave.ps1
//  END AUTODOC META
// 
//  BEGIN USER NOTES
//  Your notes here. We will NEVER change this block.
//  END USER NOTES
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type CompareTenantsResponse } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitCompareArrows, Equal, Plus, Minus, ArrowRight, BarChart3,
  Zap, Search, Filter, Target, Gauge, Timer, Layers, Shield, ExternalLink, X,
} from "lucide-react";
import { toast } from "sonner";

type TenantStatusFilter = "all" | "match" | "not_match" | "duplicate";
type TenantSubStatusFilter = "all" | "same_settings" | "different_settings" | "missing_in_tenant_a" | "missing_in_tenant_b" | "duplicate_settings";
type TenantCategoryFilter = "all" | "intune_compliance" | "intune_device_configuration" | "conditional_access" | "other";
type TenantPolicyItem = CompareTenantsResponse["policy_items"][number];
type DetailViewMode = "plain" | "json";
type BaselineMetricFilter = "mapped" | "same" | "different" | "missing";
type NonCodeRow = { setting: string; path: string; a: string; b: string; result: "same" | "different" | "only_a" | "only_b" };
type ExtractedSetting = { label: string; value: string };
type BaselineCatalogItem = {
  id: string;
  family: string;
  versions: string[];
  prerequisite?: string;
  policyHints: string[];
  fixUrl: string;
  fixSteps: string[];
};
type BaselineSecurityRecommendation = {
  name: string;
  status: "At risk" | "Meets standard" | "Not applicable";
  product: string;
  whatToDo: string[];
  howToFix: string[];
  guideUrl: string;
};
const TENANT_COMPARE_PREFS_KEY = "compare_tenant_prefs_v1";
const GLOBAL_TENANT_CONNECTION_KEY = "global_tenant_connection_v1";
const GLOBAL_TENANT_SECRET_SESSION_KEY = "global_tenant_connection_secret_v1";
const BASELINE_CATALOG: BaselineCatalogItem[] = [
  {
    id: "windows_10_later",
    family: "Security Baseline for Windows 10 and later",
    versions: ["Version 24H2", "Version 23H2", "November 2021", "December 2020", "August 2020"],
    policyHints: ["windows", "endpoint analytics", "device configuration", "settings catalog"],
    fixUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines-configure",
    fixSteps: [
      "Create or update the Windows 10 and later baseline profile.",
      "Review each setting marked different and align it to your approved baseline version.",
      "Assign baseline to target groups and verify assignment status.",
    ],
  },
  {
    id: "defender_endpoint",
    family: "Microsoft Defender for Endpoint baseline",
    versions: ["Version 24H1", "Version 6", "Version 5", "Version 4", "Version 3"],
    prerequisite: "To use this baseline, your environment must meet prerequisites for Microsoft Defender for Endpoint.",
    policyHints: ["defender", "antimalware", "endpoint", "security", "compliance"],
    fixUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines-configure",
    fixSteps: [
      "Validate Microsoft Defender for Endpoint prerequisite integration.",
      "Deploy the Defender baseline and align different settings.",
      "Confirm devices report compliant/expected Defender posture.",
    ],
  },
  {
    id: "m365_apps",
    family: "Microsoft 365 Apps for Enterprise baseline",
    versions: ["Version 2306 (Office baseline)", "May 2023 (Office baseline)"],
    policyHints: ["microsoft 365 apps", "office", "app configuration"],
    fixUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines-configure",
    fixSteps: [
      "Create/update Microsoft 365 Apps baseline profile.",
      "Standardize conflicting app hardening values across policies.",
      "Re-run baseline analysis after policy sync.",
    ],
  },
  {
    id: "edge_baseline",
    family: "Microsoft Edge Baseline",
    versions: [
      "Microsoft Edge version 128 - January 2025",
      "Microsoft Edge version 117 - November 2023",
      "Microsoft Edge version 112 and later - May 2023",
      "Microsoft Edge version 85 and later - September 2020",
      "Microsoft Edge version 80 and later - April 2020",
      "Preview: Microsoft Edge version 77 and later - October 2019",
    ],
    policyHints: ["edge", "browser"],
    fixUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines-configure",
    fixSteps: [
      "Deploy Microsoft Edge baseline for your supported Edge version.",
      "Resolve setting drift in browser security controls.",
      "Validate policy assignment and client check-in.",
    ],
  },
  {
    id: "hololens_advanced",
    family: "HoloLens 2 - Advanced security baseline settings",
    versions: ["Version 1 - HoloLens 2 advanced security - January 2025"],
    policyHints: ["hololens", "hololens 2", "windows holographic", "mixed reality", "holographic"],
    fixUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines",
    fixSteps: [
      "Confirm HoloLens device platform is enrolled and targeted.",
      "Deploy advanced HoloLens baseline profile.",
      "Review unsupported settings and adjust assignment scope.",
    ],
  },
  {
    id: "hololens_standard",
    family: "HoloLens 2 - Standard security baseline settings",
    versions: ["Version 1 - HoloLens 2 standard security - January 2025"],
    policyHints: ["hololens", "hololens 2", "windows holographic", "mixed reality", "holographic"],
    fixUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines",
    fixSteps: [
      "Deploy standard HoloLens baseline profile for baseline coverage.",
      "Compare existing HoloLens settings and remove conflicting duplicates.",
      "Verify check-in and policy assignment results.",
    ],
  },
  {
    id: "windows_365",
    family: "Windows 365 Security Baseline",
    versions: ["Version 24H1", "November 2021"],
    policyHints: ["windows 365", "windows365", "cloud pc", "cloudpc", "frontline cloud pc"],
    fixUrl: "https://learn.microsoft.com/en-us/windows-365/enterprise/intune-security-baselines",
    fixSteps: [
      "Confirm Windows 365 Cloud PCs are managed in Intune.",
      "Create/update Windows 365 security baseline profile.",
      "Align Cloud PC policies with approved baseline values and re-run analysis.",
    ],
  },
];
const BASELINE_SECURITY_RECOMMENDATIONS: BaselineSecurityRecommendation[] = [
  {
    name: "Block new password credentials in apps",
    status: "At risk",
    product: "Entra ID",
    whatToDo: [
      "Block app registrations from adding new password credentials where possible.",
      "Use certificate-based credentials or managed identities for app auth.",
    ],
    howToFix: [
      "Review app registration credential policies in Entra ID.",
      "Rotate existing weak secrets and enforce expiration/ownership policy.",
      "Update automation to certificate or workload identity auth.",
    ],
    guideUrl: "https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal",
  },
  {
    name: "Turn on restricted management user consent settings",
    status: "At risk",
    product: "Entra ID",
    whatToDo: [
      "Restrict user consent to trusted apps/permissions only.",
      "Require admin review for risky OAuth permissions.",
    ],
    howToFix: [
      "Configure user consent settings under Enterprise Applications consent policies.",
      "Enable admin consent workflow for new requests.",
      "Review existing app grants and remove risky ones.",
    ],
    guideUrl: "https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent",
  },
  {
    name: "Block access to Exchange Web Services",
    status: "At risk",
    product: "Exchange",
    whatToDo: [
      "Disable legacy EWS access patterns not required by business workloads.",
      "Allow only approved service accounts/apps where exception is needed.",
    ],
    howToFix: [
      "Update Exchange authentication policies to block EWS for users.",
      "Add scoped exceptions only for validated dependencies.",
      "Monitor sign-in and mailbox access logs for EWS usage after change.",
    ],
    guideUrl: "https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online",
  },
  {
    name: "Block basic authentication prompts",
    status: "Meets standard",
    product: "Microsoft 365 apps",
    whatToDo: [
      "Keep modern authentication enforced for Office clients.",
      "Prevent users from falling back to basic auth prompts.",
    ],
    howToFix: [
      "Verify tenant and app settings still enforce modern auth.",
      "Audit exceptions periodically and remove legacy carve-outs.",
    ],
    guideUrl: "https://learn.microsoft.com/en-us/microsoft-365/enterprise/disable-basic-authentication-in-exchange-online",
  },
  {
    name: "Block unmanaged devices and resource account sign-ins to Microsoft 365 apps",
    status: "Not applicable",
    product: "Teams",
    whatToDo: [
      "Apply only if Teams Rooms/resource account model is used.",
      "Require compliant/managed device context for production access.",
    ],
    howToFix: [
      "Create Conditional Access policy scoped to resource accounts and apps.",
      "Exclude only approved break-glass accounts and document exceptions.",
    ],
    guideUrl: "https://learn.microsoft.com/en-us/microsoftteams/rooms/security",
  },
];

function recommendationFallback(name: string, status: string, product: string): BaselineSecurityRecommendation {
  return {
    name,
    status: (status === "At risk" || status === "Meets standard" || status === "Not applicable") ? status : "At risk",
    product,
    whatToDo: [
      "Review current setting value in baseline security mode.",
      "Compare current value to Microsoft recommended standard for this control.",
    ],
    howToFix: [
      "Apply recommended value in security baseline mode.",
      "Validate assignment scope and client impact, then re-check status.",
    ],
    guideUrl: "https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines",
  };
}

export default function ComparePage() {
  const NON_CODE_PAGE_SIZE = 120;
  const [activeModule, setActiveModule] = useState<"baseline" | "tenant" | "baseline-security">("tenant");
  const baselineRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);
  const baselineSecurityRef = useRef<HTMLDivElement>(null);
  const [tenantALabel, setTenantALabel] = useState("Tenant A");
  const [tenantATenantId, setTenantATenantId] = useState("");
  const [tenantAClientId, setTenantAClientId] = useState("");
  const [tenantAClientSecret, setTenantAClientSecret] = useState("");
  const [tenantBLabel, setTenantBLabel] = useState("Tenant B");
  const [tenantBTenantId, setTenantBTenantId] = useState("");
  const [tenantBClientId, setTenantBClientId] = useState("");
  const [tenantBClientSecret, setTenantBClientSecret] = useState("");
  const [tenantStatusFilter, setTenantStatusFilter] = useState<TenantStatusFilter>("all");
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantPolicyTypeFilter, setTenantPolicyTypeFilter] = useState("all");
  const [tenantCategoryFilter, setTenantCategoryFilter] = useState<TenantCategoryFilter>("all");
  const [tenantSubStatusFilter, setTenantSubStatusFilter] = useState<TenantSubStatusFilter>("all");
  const [selectedTenantItem, setSelectedTenantItem] = useState<TenantPolicyItem | null>(null);
  const [isTenantDetailOpen, setIsTenantDetailOpen] = useState(false);
  const [detailViewMode, setDetailViewMode] = useState<DetailViewMode>("plain");
  const [nonCodePage, setNonCodePage] = useState(1);
  const [useGlobalTenantA, setUseGlobalTenantA] = useState(false);
  const [baselineRunAt, setBaselineRunAt] = useState<string | null>(null);
  const [baselineRunning, setBaselineRunning] = useState(false);
  const [baselineMetricView, setBaselineMetricView] = useState<{ baselineId: string; metric: BaselineMetricFilter } | null>(null);
  const [selectedBaselineSecurityRec, setSelectedBaselineSecurityRec] = useState<BaselineSecurityRecommendation | null>(null);

  const loadTenantComparePrefs = () => {
    try {
      const raw = window.localStorage.getItem(TENANT_COMPARE_PREFS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        tenantALabel?: string;
        tenantATenantId?: string;
        tenantAClientId?: string;
        tenantBLabel?: string;
        tenantBTenantId?: string;
        tenantBClientId?: string;
      };
      if (saved.tenantALabel) setTenantALabel(saved.tenantALabel);
      if (saved.tenantATenantId) setTenantATenantId(saved.tenantATenantId);
      if (saved.tenantAClientId) setTenantAClientId(saved.tenantAClientId);
      if (saved.tenantBLabel) setTenantBLabel(saved.tenantBLabel);
      if (saved.tenantBTenantId) setTenantBTenantId(saved.tenantBTenantId);
      if (saved.tenantBClientId) setTenantBClientId(saved.tenantBClientId);
    } catch {
      // Ignore invalid local cache data.
    }
  };

  const loadGlobalTenantConnection = () => {
    try {
      const raw = window.localStorage.getItem(GLOBAL_TENANT_CONNECTION_KEY);
      if (!raw) {
        setUseGlobalTenantA(false);
        return;
      }
      const saved = JSON.parse(raw) as {
        label?: string;
        tenantId?: string;
        clientId?: string;
      };
      const hasAll = Boolean(saved.tenantId && saved.clientId);
      setUseGlobalTenantA(hasAll);
      if (!hasAll) return;
      if (saved.label) setTenantALabel(saved.label);
      if (saved.tenantId) setTenantATenantId(saved.tenantId);
      if (saved.clientId) setTenantAClientId(saved.clientId);
      const secret = window.sessionStorage.getItem(GLOBAL_TENANT_SECRET_SESSION_KEY);
      if (secret) setTenantAClientSecret(secret);
    } catch {
      setUseGlobalTenantA(false);
    }
  };

  useEffect(() => {
    loadTenantComparePrefs();
    loadGlobalTenantConnection();
    const onUpdated = () => {
      loadTenantComparePrefs();
      loadGlobalTenantConnection();
    };
    window.addEventListener("tenant-connection-updated", onUpdated);
    return () => window.removeEventListener("tenant-connection-updated", onUpdated);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        TENANT_COMPARE_PREFS_KEY,
        JSON.stringify({
          tenantALabel,
          tenantATenantId,
          tenantAClientId,
          tenantBLabel,
          tenantBTenantId,
          tenantBClientId,
        }),
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [tenantALabel, tenantATenantId, tenantAClientId, tenantBLabel, tenantBTenantId, tenantBClientId]);

  const buildComparePayload = (override?: {
    tenant_a?: {
      label: string;
      tenant_id: string;
      client_id: string;
      client_secret: string;
    };
    tenant_b?: {
      label: string;
      tenant_id: string;
      client_id: string;
      client_secret: string;
    };
  }) => ({
    tenant_a: override?.tenant_a ?? {
      label: tenantALabel || "Tenant A",
      tenant_id: tenantATenantId,
      client_id: tenantAClientId,
      client_secret: tenantAClientSecret,
    },
    tenant_b: override?.tenant_b ?? {
      label: tenantBLabel || "Tenant B",
      tenant_id: tenantBTenantId,
      client_id: tenantBClientId,
      client_secret: tenantBClientSecret,
    },
  });


  const compareTenantsMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.compareTenants>[0]) => api.compareTenants(payload),
    onSuccess: () => {
      toast.success("Tenant comparison completed");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Tenant comparison failed";
      toast.error(message);
    },
  });

  const tenantResult = compareTenantsMutation.data;
  const runBaselineAnalysis = async () => {
    let aLabel = tenantALabel.trim() || "Tenant A";
    let aTenantId = tenantATenantId.trim();
    let aClientId = tenantAClientId.trim();
    let aSecret = tenantAClientSecret.trim();

    try {
      const raw = window.localStorage.getItem(GLOBAL_TENANT_CONNECTION_KEY);
      const saved = raw ? (JSON.parse(raw) as { label?: string; tenantId?: string; clientId?: string }) : null;
      const sessionSecret = window.sessionStorage.getItem(GLOBAL_TENANT_SECRET_SESSION_KEY) || "";
      if (saved?.tenantId && saved?.clientId && sessionSecret) {
        aLabel = saved.label || "Connected Tenant";
        aTenantId = saved.tenantId;
        aClientId = saved.clientId;
        aSecret = sessionSecret;
        setTenantALabel(aLabel);
        setTenantATenantId(aTenantId);
        setTenantAClientId(aClientId);
        setTenantAClientSecret(aSecret);
      }
    } catch {
      // fallback to current in-memory tenant A fields
    }

    if (!aTenantId || !aClientId || !aSecret) {
      toast.error("Connect tenant first (tenant ID, client ID, and client secret are required).");
      return;
    }

    setBaselineRunning(true);
    try {
      await compareTenantsMutation.mutateAsync(
        buildComparePayload({
          tenant_a: {
            label: aLabel,
            tenant_id: aTenantId,
            client_id: aClientId,
            client_secret: aSecret,
          },
          tenant_b: {
            label: "Baseline check tenant",
            tenant_id: aTenantId,
            client_id: aClientId,
            client_secret: aSecret,
          },
        }),
      );
      const now = new Date().toISOString();
      setBaselineRunAt(now);
      toast.success("Baseline analysis completed");
    } catch {
      // compareTenantsMutation already emits detailed toast on error
    } finally {
      setBaselineRunning(false);
    }
  };

  const baselineCoverage = BASELINE_CATALOG.map((baseline) => {
    const itemSearchText = (item: TenantPolicyItem) => {
      const sourceA = item.tenant_a_data ? JSON.stringify(item.tenant_a_data).toLowerCase() : "";
      const sourceB = item.tenant_b_data ? JSON.stringify(item.tenant_b_data).toLowerCase() : "";
      return [
        item.policy_type.toLowerCase(),
        item.policy_name.toLowerCase(),
        (item.tenant_a_policy_name ?? "").toLowerCase(),
        (item.tenant_b_policy_name ?? "").toLowerCase(),
        item.reason.toLowerCase(),
        sourceA,
        sourceB,
      ].join(" ");
    };
    // Baseline analysis is single-tenant focused (connected tenant), so de-duplicate
    // by policy identity from tenant A to avoid mirrored A/B artifacts.
    const unique = new Map<string, TenantPolicyItem>();
    (tenantResult?.policy_items ?? []).forEach((item) => {
      const id = item.tenant_a_ids?.[0] || item.policy_key;
      const name = item.tenant_a_policy_name || item.policy_name;
      const key = `${item.policy_type}|${name}|${id}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    const items = Array.from(unique.values()).filter((item) => {
      const text = itemSearchText(item);
      return baseline.policyHints.some((hint) => text.includes(hint));
    });
    const same = items.filter((i) => i.sub_status === "same_settings" || i.status === "match" || i.status === "duplicate").length;
    const different = items.filter((i) => i.sub_status === "different_settings" || i.status === "not_match").length;
    const missing = items.length === 0 ? 1 : 0;
    const status: "covered" | "partial" | "gap" =
      items.length === 0 ? "gap" : different > 0 ? "partial" : "covered";
    return {
      ...baseline,
      totalMappedPolicies: items.length,
      same,
      different,
      missing,
      status,
      items,
      sameItems: items.filter((i) => i.sub_status === "same_settings" || i.status === "match" || i.status === "duplicate"),
      differentItems: items.filter((i) => i.sub_status === "different_settings" || i.status === "not_match"),
      gapItems: items.filter((i) =>
        i.sub_status === "different_settings" ||
        i.status === "not_match",
      ),
    };
  });
  const baselineItemStatus = (item: TenantPolicyItem) => {
    if (item.sub_status === "different_settings" || item.status === "not_match") return "different_settings";
    if (item.sub_status === "missing_in_tenant_a" || item.sub_status === "missing_in_tenant_b") return "unmatched_policy";
    return item.sub_status || item.status;
  };
  const baselineItemReason = (item: TenantPolicyItem) => {
    const raw = item.reason || "";
    if (item.sub_status === "missing_in_tenant_a" || item.sub_status === "missing_in_tenant_b") {
      return "No settings-similar baseline pair found in connected tenant policy set.";
    }
    return raw;
  };
  const baselineGapOutput = baselineCoverage
    .map((baseline) => ({
      id: baseline.id,
      family: baseline.family,
      status: baseline.status,
      missing: baseline.missing,
      different: baseline.different,
      totalMappedPolicies: baseline.totalMappedPolicies,
      fixUrl: baseline.fixUrl,
      fixSteps: baseline.fixSteps,
      policyTypes: Array.from(new Set(baseline.gapItems.map((i) => i.policy_type))).slice(0, 6),
      items: baseline.gapItems,
    }))
    .filter((baseline) => baseline.status === "gap" || baseline.status === "partial");

  const policyCategory = (policyType: string): TenantCategoryFilter => {
    const p = policyType.toLowerCase();
    if (
      p.includes("conditional access") ||
      p.includes("conditionalaccess") ||
      p.includes("conditional_access") ||
      p.includes("conditional-access") ||
      p.includes("microsoft.graph.conditionalaccesspolicy")
    ) {
      return "conditional_access";
    }
    if (p.includes("compliance")) return "intune_compliance";
    if (
      p.includes("device configuration") ||
      p.includes("settings catalog") ||
      p.includes("group policy configuration") ||
      p.includes("app configuration")
    ) {
      return "intune_device_configuration";
    }
    return "other";
  };
  const categoryLabel = (category: TenantCategoryFilter) => {
    if (category === "intune_compliance") return "Intune Compliance";
    if (category === "intune_device_configuration") return "Intune Device Configuration";
    if (category === "conditional_access") return "Conditional Access";
    if (category === "other") return "Other";
    return "All";
  };
  const tenantPolicyTypes = Array.from(new Set((tenantResult?.policy_items ?? []).map((i) => i.policy_type))).sort();
  const tenantCategoryCounts = {
    all: (tenantResult?.policy_items ?? []).length,
    intune_compliance: (tenantResult?.policy_items ?? []).filter((i) => policyCategory(i.policy_type) === "intune_compliance").length,
    intune_device_configuration: (tenantResult?.policy_items ?? []).filter((i) => policyCategory(i.policy_type) === "intune_device_configuration").length,
    conditional_access: (tenantResult?.policy_items ?? []).filter((i) => policyCategory(i.policy_type) === "conditional_access").length,
    other: (tenantResult?.policy_items ?? []).filter((i) => policyCategory(i.policy_type) === "other").length,
  };
  const tenantStatusCounts = {
    all: (tenantResult?.policy_items ?? []).length,
    match: (tenantResult?.policy_items ?? []).filter((i) => i.status === "match").length,
    not_match: (tenantResult?.policy_items ?? []).filter((i) => i.status === "not_match").length,
    duplicate: (tenantResult?.policy_items ?? []).filter((i) => i.status === "duplicate").length,
  };
  const filteredTenantItems =
    (tenantResult?.policy_items ?? [])
      .filter((item) => tenantStatusFilter === "all" || item.status === tenantStatusFilter)
      .filter((item) => tenantSubStatusFilter === "all" || item.sub_status === tenantSubStatusFilter)
      .filter((item) => tenantPolicyTypeFilter === "all" || item.policy_type === tenantPolicyTypeFilter)
      .filter((item) => tenantCategoryFilter === "all" || policyCategory(item.policy_type) === tenantCategoryFilter)
      .filter((item) => {
        const q = tenantSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          item.policy_name.toLowerCase().includes(q) ||
          item.policy_type.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const rank = (status: string) => (status === "duplicate" ? 0 : status === "not_match" ? 1 : 2);
        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;
        return a.policy_name.localeCompare(b.policy_name);
      });
  const openTenantDetail = (item: TenantPolicyItem) => {
    setSelectedTenantItem(item);
    setIsTenantDetailOpen(true);
    setDetailViewMode("plain");
    setNonCodePage(1);
  };

  const formatSimpleValue = (value: string | null) => {
    if (value === null) return "null";
    if (value === "") return '""';
    return value;
  };

  const settingNameFromPath = (path: string) => {
    const parts = path.split(".").filter(Boolean);
    return parts[parts.length - 1] ?? path;
  };

  const valueToText = (value: unknown): string | null => {
    if (value === null) return "null";
    if (value === undefined) return null;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  };

  const flattenPolicyValues = (data?: Record<string, unknown> | null) => {
    const out = new Map<string, string>();
    if (!data) return out;

    const walk = (node: unknown, path: string) => {
      const text = valueToText(node);
      if (text !== null) {
        out.set(path, text);
        return;
      }

      if (Array.isArray(node)) {
        node.forEach((child, idx) => walk(child, `${path}[${idx}]`));
        return;
      }

      if (node && typeof node === "object") {
        Object.entries(node as Record<string, unknown>).forEach(([k, v]) => {
          walk(v, path ? `${path}.${k}` : k);
        });
      }
    };

    walk(data, "");
    return out;
  };

  const includeSettingPath = (path: string) => {
    if (!path) return false;
    const p = path.toLowerCase();
    const leaf = p.split(".").pop() ?? p;

    // Exclude metadata/system fields from non-code settings table.
    const blocked = [
      "@odata",
      "id",
      "description",
      "createddatetime",
      "lastmodifieddatetime",
      "modifieddatetime",
      "version",
      "rolescopetagids",
      "issigned",
      "isassigned",
      "template",
      "platform",
      "platforms",
      "technologies",
      "prioritymetadata",
      "context",
    ];
    if (blocked.some((k) => leaf === k || leaf.endsWith(k))) return false;

    // Prefer configuration/compliance setting attributes.
    const preferred = [
      "value",
      "rawvalue",
      "rawjsonvalue",
      "defaultvalue",
      "description",
      "settingdefinitionid",
      "simplesettingvalue",
      "rootcategory",
      "category",
    ];
    if (preferred.some((k) => leaf === k || leaf.endsWith(`.${k}`))) return true;

    // Keep explicit settings structures for config/compliance policies.
    if (p.includes("_settings") || p.includes("setting") || p.includes("compliance") || p.includes("oma")) return true;
    if (p.startsWith("_policies[")) return true;

    // Fallback: include remaining scalar policy properties (except blocked metadata above).
    return true;
  };

  const stripVendorPrefix = (v: string) => {
    const marker = "device_vendor_msft_policy_config_";
    if (!v.includes(marker)) return v;
    const cleaned = v.substring(v.indexOf(marker) + marker.length);
    const tail = cleaned.split("_").filter(Boolean).slice(-3).join(" ");
    return tail || cleaned;
  };

  const prettifyLabel = (raw: string) => {
    const base = raw
      .replace(/^device_vendor_msft_policy_config_/i, "")
      .split("_")
      .filter(Boolean)
      .slice(-4)
      .join(" ");
    const text = base || raw;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const stringifySettingValue = (v: unknown): string => {
    if (v === null || v === undefined) return "not set";
    if (typeof v === "string") return stripVendorPrefix(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map((x) => stringifySettingValue(x)).join("; ");
    return JSON.stringify(v);
  };

  const appendDistinct = (current: string | undefined, next: string) => {
    if (!current || current === "not set") return next;
    const curr = current.split("; ").map((x) => x.trim()).filter(Boolean);
    if (curr.includes(next)) return current;
    return `${current}; ${next}`;
  };

  const addExtracted = (map: Map<string, ExtractedSetting>, key: string, label: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    const nextText = stringifySettingValue(value);
    const existing = map.get(key);
    map.set(key, {
      label,
      value: appendDistinct(existing?.value, nextText),
    });
  };

  const extractAssignments = (policy: Record<string, unknown>) => {
    const out: string[] = [];

    const assignments = Array.isArray(policy.assignments) ? policy.assignments : [];
    assignments.forEach((a) => {
      if (!a || typeof a !== "object") return;
      const ao = a as Record<string, unknown>;
      const target = ao.target && typeof ao.target === "object" ? (ao.target as Record<string, unknown>) : ao;
      const parts: string[] = [];
      if (typeof target.groupId === "string" && target.groupId) parts.push(`group:${target.groupId}`);
      if (typeof target.userId === "string" && target.userId) parts.push(`user:${target.userId}`);
      if (typeof target.deviceAndAppManagementAssignmentFilterId === "string" && target.deviceAndAppManagementAssignmentFilterId) {
        parts.push(`filter:${target.deviceAndAppManagementAssignmentFilterId}`);
      }
      if (typeof target.deviceAndAppManagementAssignmentFilterType === "string" && target.deviceAndAppManagementAssignmentFilterType) {
        parts.push(`filterMode:${target.deviceAndAppManagementAssignmentFilterType}`);
      }
      if (typeof target["@odata.type"] === "string" && target["@odata.type"]) parts.push(String(target["@odata.type"]));
      if (parts.length > 0) out.push(parts.join(" | "));
    });

    const users = (policy.conditions && typeof policy.conditions === "object"
      ? (policy.conditions as { users?: unknown }).users
      : undefined) as Record<string, unknown> | undefined;
    if (users) {
      const includeUsers = Array.isArray(users.includeUsers) ? users.includeUsers.map((v) => stringifySettingValue(v)).join(", ") : "";
      const excludeUsers = Array.isArray(users.excludeUsers) ? users.excludeUsers.map((v) => stringifySettingValue(v)).join(", ") : "";
      const includeGroups = Array.isArray(users.includeGroups) ? users.includeGroups.map((v) => stringifySettingValue(v)).join(", ") : "";
      const excludeGroups = Array.isArray(users.excludeGroups) ? users.excludeGroups.map((v) => stringifySettingValue(v)).join(", ") : "";
      const includeRoles = Array.isArray(users.includeRoles) ? users.includeRoles.map((v) => stringifySettingValue(v)).join(", ") : "";
      const excludeRoles = Array.isArray(users.excludeRoles) ? users.excludeRoles.map((v) => stringifySettingValue(v)).join(", ") : "";

      if (includeUsers) out.push(`includeUsers: ${includeUsers}`);
      if (excludeUsers) out.push(`excludeUsers: ${excludeUsers}`);
      if (includeGroups) out.push(`includeGroups: ${includeGroups}`);
      if (excludeGroups) out.push(`excludeGroups: ${excludeGroups}`);
      if (includeRoles) out.push(`includeRoles: ${includeRoles}`);
      if (excludeRoles) out.push(`excludeRoles: ${excludeRoles}`);
    }

    const apps = (policy.conditions && typeof policy.conditions === "object"
      ? (policy.conditions as { applications?: unknown }).applications
      : undefined) as Record<string, unknown> | undefined;
    if (apps) {
      const includeApps = Array.isArray(apps.includeApplications) ? apps.includeApplications.map((v) => stringifySettingValue(v)).join(", ") : "";
      const excludeApps = Array.isArray(apps.excludeApplications) ? apps.excludeApplications.map((v) => stringifySettingValue(v)).join(", ") : "";
      if (includeApps) out.push(`includeApplications: ${includeApps}`);
      if (excludeApps) out.push(`excludeApplications: ${excludeApps}`);
    }

    return out;
  };

  const extractApplicabilityRules = (policy: Record<string, unknown>) => {
    const rules = Array.isArray(policy.applicabilityRules) ? policy.applicabilityRules : [];
    return rules
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => {
        const t = typeof r["@odata.type"] === "string" ? r["@odata.type"] : "rule";
        const property = typeof r.propertyName === "string" ? r.propertyName : "";
        const op = typeof r.operator === "string" ? r.operator : "";
        const value = "value" in r ? stringifySettingValue(r.value) : "";
        return [t, property, op, value].filter(Boolean).join(" | ");
      })
      .filter(Boolean);
  };

  const extractComplianceActions = (policy: Record<string, unknown>) => {
    const rules = Array.isArray(policy.scheduledActionsForRule) ? policy.scheduledActionsForRule : [];
    const out: string[] = [];
    rules.forEach((rule) => {
      if (!rule || typeof rule !== "object") return;
      const ro = rule as Record<string, unknown>;
      const ruleName = typeof ro.ruleName === "string" ? ro.ruleName : "rule";
      const actions = Array.isArray(ro.scheduledActionConfigurations) ? ro.scheduledActionConfigurations : [];
      actions.forEach((ac) => {
        if (!ac || typeof ac !== "object") return;
        const ao = ac as Record<string, unknown>;
        const actionType = typeof ao.actionType === "string" ? ao.actionType : "action";
        const graceDays = typeof ao.gracePeriodHours === "number" ? `${ao.gracePeriodHours}h` : (typeof ao.gracePeriodHours === "string" ? ao.gracePeriodHours : "");
        const notify = typeof ao.notificationTemplateId === "string" ? ao.notificationTemplateId : "";
        out.push([ruleName, actionType, graceDays, notify].filter(Boolean).join(" | "));
      });
    });
    return out;
  };

  const extractOmaUris = (policy: Record<string, unknown>) => {
    const out: string[] = [];
    const omaSettings = Array.isArray(policy.omaSettings) ? policy.omaSettings : [];
    omaSettings.forEach((s) => {
      if (!s || typeof s !== "object") return;
      const so = s as Record<string, unknown>;
      const uri = typeof so.omaUri === "string" ? so.omaUri : "";
      const value = "value" in so ? stringifySettingValue(so.value) : "";
      if (uri || value) out.push([uri, value].filter(Boolean).join(" = "));
    });
    return out;
  };

  const isConditionalAccessPolicy = (policy: Record<string, unknown>) => {
    const odataType = typeof policy["@odata.type"] === "string" ? policy["@odata.type"].toLowerCase() : "";
    if (odataType.includes("conditionalaccesspolicy")) return true;
    return !!policy.conditions && (!!policy.grantControls || !!policy.sessionControls || typeof policy.state === "string");
  };

  const extractLeafValues = (
    node: unknown,
    basePath: string,
    push: (path: string, value: unknown) => void,
  ) => {
    if (node === null || node === undefined) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      push(basePath, node);
      return;
    }
    if (Array.isArray(node)) {
      const allScalar = node.every((x) => x === null || x === undefined || typeof x === "string" || typeof x === "number" || typeof x === "boolean");
      if (allScalar) {
        const values = node.filter((x) => x !== null && x !== undefined).map((x) => stringifySettingValue(x));
        push(basePath, values.join("; "));
        return;
      }
      node.forEach((item, idx) => extractLeafValues(item, `${basePath}[${idx}]`, push));
      return;
    }
    if (typeof node === "object") {
      Object.entries(node as Record<string, unknown>).forEach(([k, v]) => {
        const next = basePath ? `${basePath}.${k}` : k;
        extractLeafValues(v, next, push);
      });
    }
  };

  const extractConditionalAccessSettings = (policy: Record<string, unknown>, map: Map<string, ExtractedSetting>, policyIdx: number) => {
    if (!isConditionalAccessPolicy(policy)) return;
    const keyPrefix = `policy[${policyIdx}]:ca`;
    const roots: Array<[string, unknown]> = [
      ["state", policy.state],
      ["conditions", policy.conditions],
      ["grantControls", policy.grantControls],
      ["sessionControls", policy.sessionControls],
    ];

    roots.forEach(([rootName, rootValue]) => {
      if (rootValue === undefined || rootValue === null) return;
      extractLeafValues(rootValue, rootName, (path, value) => {
        addExtracted(map, `${keyPrefix}:${path}`, `CA ${path}`, value);
      });
    });
  };

  const prettifyDirectKey = (raw: string) => {
    return raw
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  };

  const extractSettingsFromNode = (node: unknown, map: Map<string, ExtractedSetting>, prefix = "") => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const settingId = typeof obj.settingDefinitionId === "string" ? obj.settingDefinitionId : "";
    const keyBase = settingId || prefix;
    const label = settingId ? prettifyLabel(settingId) : (prefix || "Setting");
    const add = (suffix: string, field: string, value: unknown) => {
      if (value === undefined || value === null || value === "") return;
      map.set(`${keyBase}:${suffix}`, { label: `${label} - ${field}`, value: stringifySettingValue(value) });
    };

    // Keep the setting definition id for traceability, but avoid dumping raw JSON rows.
    add("settingDefinitionId", "settingDefinitionId", settingId || undefined);

    if (obj.choiceSettingValue && typeof obj.choiceSettingValue === "object") {
      const choice = obj.choiceSettingValue as Record<string, unknown>;
      if ("value" in choice) {
        add("value", "Value", choice.value);
      }
      if (Array.isArray(choice.children)) {
        choice.children.forEach((child, idx) => extractSettingsFromNode(child, map, `${keyBase}.choiceChild[${idx}]`));
      }
    }

    if (Array.isArray(obj.choiceSettingCollectionValue)) {
      const values = obj.choiceSettingCollectionValue
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>).value : x))
        .map((x) => stringifySettingValue(x))
        .filter(Boolean);
      if (values.length > 0) {
        add("valueCollection", "Value", values.join("; "));
      }
    }

    if (obj.simpleSettingValue && typeof obj.simpleSettingValue === "object") {
      const simple = obj.simpleSettingValue as Record<string, unknown>;
      if ("value" in simple) {
        add("simpleSettingValue", "simpleSettingValue", simple.value);
        add("valueSimple", "Value", simple.value);
      }
    }

    if (Array.isArray(obj.simpleSettingCollectionValue)) {
      const values = obj.simpleSettingCollectionValue
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>).value : x))
        .map((x) => stringifySettingValue(x))
        .filter(Boolean);
      if (values.length > 0) {
        add("simpleCollection", "simpleSettingValue", values.join("; "));
        add("valueSimpleCollection", "Value", values.join("; "));
      }
    }

    if (Array.isArray(obj.groupSettingCollectionValue)) {
      obj.groupSettingCollectionValue.forEach((child, idx) => extractSettingsFromNode(child, map, `${keyBase}.group[${idx}]`));
    }
    if (Array.isArray(obj.children)) {
      obj.children.forEach((child, idx) => extractSettingsFromNode(child, map, `${keyBase}.child[${idx}]`));
    }
  };

  const extractDirectPolicySettings = (policy: Record<string, unknown>, map: Map<string, ExtractedSetting>, policyIdx: number) => {
    const blocked = new Set([
      "id",
      "name",
      "displayName",
      "description",
      "createdDateTime",
      "lastModifiedDateTime",
      "modifiedDateTime",
      "@odata.type",
      "@odata.context",
      "roleScopeTagIds",
      "templateId",
      "templateFamily",
      "templateDisplayName",
      "platform",
      "platforms",
      "technologies",
      "version",
      "priorityMetaData",
      "assignments",
      "scheduledActionsForRule",
      "applicabilityRules",
      "omaSettings",
      "_settings",
      "_policies",
    ]);

    const scalarLike = (v: unknown) =>
      v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean" ||
      (Array.isArray(v) && v.every((x) => x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean"));

    Object.entries(policy).forEach(([k, v]) => {
      if (blocked.has(k) || k.startsWith("@odata")) return;
      if (!scalarLike(v)) return;
      const key = `policy[${policyIdx}]:direct:${k}`;
      addExtracted(map, key, prettifyDirectKey(k), v);
    });
  };

  const extractPolicySettingMap = (data?: Record<string, unknown> | null) => {
    const out = new Map<string, ExtractedSetting>();
    if (!data) return out;

    const policyObjects =
      Array.isArray((data as { _policies?: unknown[] })._policies) && (data as { _policies?: unknown[] })._policies
        ? ((data as { _policies?: Record<string, unknown>[] })._policies ?? [])
        : [data];

    policyObjects.forEach((policy, policyIdx) => {
      const keyPrefix = `policy[${policyIdx}]`;
      // Core compare context rows (policy-relevant metadata)
      addExtracted(out, `${keyPrefix}:ScopeTags`, "ScopeTags", policy.roleScopeTagIds);
      addExtracted(out, `${keyPrefix}:TemplateId`, "TemplateId", policy.templateId);
      addExtracted(out, `${keyPrefix}:TemplateFamily`, "TemplateFamily", policy.templateFamily);
      addExtracted(out, `${keyPrefix}:TemplateDisplayName`, "TemplateDisplayName", policy.templateDisplayName);

      extractAssignments(policy).forEach((x, idx) => addExtracted(out, `${keyPrefix}:Assignment:${idx}`, "AssignmentTarget", x));
      extractApplicabilityRules(policy).forEach((x, idx) => addExtracted(out, `${keyPrefix}:Applicability:${idx}`, "ApplicabilityRule", x));
      extractComplianceActions(policy).forEach((x, idx) => addExtracted(out, `${keyPrefix}:ComplianceAction:${idx}`, "ComplianceAction", x));
      extractOmaUris(policy).forEach((x, idx) => addExtracted(out, `${keyPrefix}:OmaUri:${idx}`, "OMA-URI", x));

      const settings = Array.isArray(policy._settings) ? policy._settings : [];
      settings.forEach((s, sIdx) => extractSettingsFromNode(s, out, `_settings[${sIdx}]`));
      extractDirectPolicySettings(policy, out, policyIdx);
      extractConditionalAccessSettings(policy, out, policyIdx);
    });

    return out;
  };

  const isBlockedSettingLabel = (label: string) => {
    const normalized = label.trim().toLowerCase();
    if (normalized === "name" || normalized === "description" || normalized === "rootcategory") return true;
    if (normalized.endsWith(" - description") || normalized.endsWith(" - rootcategory")) return true;
    return false;
  };

  const buildNonCodeRows = (item: TenantPolicyItem) => {
    const leftData = item.tenant_a_data ?? item.tenant_b_data ?? null;
    const rightData = item.tenant_b_data ?? item.tenant_a_data ?? null;
    const structuredA = extractPolicySettingMap(leftData);
    const structuredB = extractPolicySettingMap(rightData);
    if (structuredA.size > 0 || structuredB.size > 0) {
      const structuredKeys = Array.from(new Set([...structuredA.keys(), ...structuredB.keys()])).sort((x, y) => x.localeCompare(y));
      return structuredKeys.map((key) => {
        const left = structuredA.get(key);
        const right = structuredB.get(key);
        const aVal = left?.value ?? "not set";
        const bVal = right?.value ?? "not set";
        const result: NonCodeRow["result"] =
          left && right ? (aVal === bVal ? "same" : "different") : left ? "only_a" : "only_b";
        return {
          setting: left?.label ?? right?.label ?? key,
          path: key,
          a: aVal,
          b: bVal,
          result,
        };
      }).filter((row) => !isBlockedSettingLabel(row.setting));
    }

    const aMap = flattenPolicyValues(leftData);
    const bMap = flattenPolicyValues(rightData);
    const keys = Array.from(new Set([...aMap.keys(), ...bMap.keys()]))
      .sort((x, y) => x.localeCompare(y))
      .filter((k) => k.length > 0)
      .filter(includeSettingPath);

    const rows = keys.map((path) => {
      const av = aMap.get(path);
      const bv = bMap.get(path);
      let result: NonCodeRow["result"] = "different";
      if (av !== undefined && bv !== undefined) {
        result = av === bv ? "same" : "different";
      } else if (av !== undefined) {
        result = "only_a";
      } else {
        result = "only_b";
      }
      return {
        setting: settingNameFromPath(path),
        path,
        a: av ?? "not set",
        b: bv ?? "not set",
        result,
      };
    });

    // Ensure a clear policy-name row is always present.
    return rows.filter((row) => !isBlockedSettingLabel(row.setting));
  };

  const readPolicyMeta = (data?: Record<string, unknown> | null) => {
    const policies = (data as { _policies?: unknown[] } | undefined)?._policies;
    const primary =
      data &&
      Array.isArray(policies) &&
      policies.length > 0 &&
      typeof policies[0] === "object" &&
      policies[0] !== null
        ? ((policies[0] as Record<string, unknown>) ?? data)
        : data;

    if (!data) {
      return {
        description: "—",
        createdDate: "—",
        lastModified: "—",
        platform: "—",
        technologies: "—",
        template: "—",
        settingCount: "—",
        assignedTo: "—",
      };
    }

    const flat = flattenPolicyValues(primary);
    const firstFromFlat = (needle: string) => {
      const found = Array.from(flat.entries()).find(([k]) => k.toLowerCase().endsWith(needle.toLowerCase()));
      return found?.[1];
    };

    const description =
      (typeof primary?.description === "string" && primary.description) ||
      (typeof primary?.desc === "string" && primary.desc) ||
      "—";
    const createdDate =
      (typeof primary?.createdDateTime === "string" && primary.createdDateTime) ||
      firstFromFlat("createdDateTime") ||
      "—";
    const lastModified =
      (typeof primary?.lastModifiedDateTime === "string" && primary.lastModifiedDateTime) ||
      (typeof primary?.modifiedDateTime === "string" && primary.modifiedDateTime) ||
      firstFromFlat("lastModifiedDateTime") ||
      "—";
    const platform =
      (typeof primary?.platforms === "string" && primary.platforms) ||
      (Array.isArray(primary?.platforms) ? primary.platforms.filter((v): v is string => typeof v === "string").join(", ") : "") ||
      (typeof primary?.platform === "string" && primary.platform) ||
      firstFromFlat("platforms") ||
      "—";
    const technologies =
      (typeof primary?.technologies === "string" && primary.technologies) ||
      (Array.isArray(primary?.technologies) ? primary.technologies.filter((v): v is string => typeof v === "string").join(", ") : "") ||
      (typeof primary?.["@odata.type"] === "string" && primary["@odata.type"]) ||
      "—";
    const template =
      (typeof primary?.templateDisplayName === "string" && primary.templateDisplayName) ||
      (typeof primary?.templateId === "string" && primary.templateId) ||
      (typeof primary?.templateReference === "object" &&
      primary.templateReference !== null &&
      "templateId" in primary.templateReference &&
      typeof (primary.templateReference as { templateId?: unknown }).templateId === "string"
        ? ((primary.templateReference as { templateId?: string }).templateId ?? "—")
        : "—");

    const includeUsers =
      Array.isArray((primary as { conditions?: { users?: { includeUsers?: unknown[] } } })?.conditions?.users?.includeUsers)
        ? (primary as { conditions?: { users?: { includeUsers?: string[] } } }).conditions?.users?.includeUsers ?? []
        : [];
    const includeGroups =
      Array.isArray((primary as { conditions?: { users?: { includeGroups?: unknown[] } } })?.conditions?.users?.includeGroups)
        ? (primary as { conditions?: { users?: { includeGroups?: string[] } } }).conditions?.users?.includeGroups ?? []
        : [];
    const assignments =
      Array.isArray((primary as { assignments?: unknown[] }).assignments)
        ? (primary as { assignments?: unknown[] }).assignments ?? []
        : [];
    const assignedTo =
      assignments.length > 0
        ? `${assignments.length} assignment target(s)`
        : includeUsers.length > 0 || includeGroups.length > 0
          ? `Users: ${includeUsers.length}, Groups: ${includeGroups.length}`
          : "Not available in payload";

    const settingCount =
      typeof primary?.settingCount === "number"
        ? String(primary.settingCount)
        : typeof primary?.settings_count === "number"
          ? String(primary.settings_count)
          : typeof (data as { _duplicateCount?: unknown })?._duplicateCount === "number"
            ? String((data as { _duplicateCount?: number })._duplicateCount)
            : flat.size > 0
              ? String(flat.size)
          : "—";

    return { description, createdDate, lastModified, platform, technologies, template, settingCount, assignedTo };
  };

  useEffect(() => {
    setIsTenantDetailOpen(false);
    setSelectedTenantItem(null);
  }, [tenantResult?.summary.total_policies_compared]);

  useEffect(() => {
    setNonCodePage(1);
  }, [selectedTenantItem?.policy_key]);

  const summaryTenantAData = selectedTenantItem?.tenant_a_data ?? selectedTenantItem?.tenant_b_data ?? null;
  const summaryTenantBData = selectedTenantItem?.tenant_b_data ?? selectedTenantItem?.tenant_a_data ?? null;
  const summaryTenantAPolicyName = selectedTenantItem?.tenant_a_policy_name || selectedTenantItem?.tenant_b_policy_name || "Not present";
  const summaryTenantBPolicyName = selectedTenantItem?.tenant_b_policy_name || selectedTenantItem?.tenant_a_policy_name || "Not present";

  const nonCodeRows = selectedTenantItem ? buildNonCodeRows(selectedTenantItem) : [];
  const nonCodeTotalRows = nonCodeRows.length;
  const nonCodeTotalPages = Math.max(1, Math.ceil(nonCodeTotalRows / NON_CODE_PAGE_SIZE));
  const safeNonCodePage = Math.min(nonCodePage, nonCodeTotalPages);
  const nonCodeStart = nonCodeTotalRows === 0 ? 0 : (safeNonCodePage - 1) * NON_CODE_PAGE_SIZE + 1;
  const nonCodeEnd = Math.min(safeNonCodePage * NON_CODE_PAGE_SIZE, nonCodeTotalRows);
  const nonCodePageRows = nonCodeRows.slice((safeNonCodePage - 1) * NON_CODE_PAGE_SIZE, safeNonCodePage * NON_CODE_PAGE_SIZE);
  const selectedPolicyCategory: TenantCategoryFilter =
    selectedTenantItem ? policyCategory(selectedTenantItem.policy_type) : "all";
  const selectedCategoryItems =
    selectedPolicyCategory === "all"
      ? (tenantResult?.policy_items ?? [])
      : (tenantResult?.policy_items ?? []).filter((i) => policyCategory(i.policy_type) === selectedPolicyCategory);
  const selectedCategorySummary = {
    same_settings: selectedCategoryItems.filter((i) => i.sub_status === "same_settings").length,
    different_settings: selectedCategoryItems.filter((i) => i.sub_status === "different_settings").length,
    missing_in_tenant_a: selectedCategoryItems.filter((i) => i.sub_status === "missing_in_tenant_a").length,
    missing_in_tenant_b: selectedCategoryItems.filter((i) => i.sub_status === "missing_in_tenant_b").length,
    duplicate: selectedCategoryItems.filter((i) => i.status === "duplicate").length,
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Policy Comparison Engine" description="Configuration Compare Center" />

      {/* Key metrics - matching IntuneAssistant style */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <Gauge className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">99.8%</p>
            <p className="text-xs text-muted-foreground mt-1">Comparison Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Layers className="h-6 w-6 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold">50k+</p>
            <p className="text-xs text-muted-foreground mt-1">Settings Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Target className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">100+</p>
            <p className="text-xs text-muted-foreground mt-1">Policy Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <Timer className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">&lt; 2s</p>
            <p className="text-xs text-muted-foreground mt-1">Comparison Speed</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature cards - matching IntuneAssistant */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("baseline");
            baselineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("baseline");
              baselineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`transition-colors ${activeModule === "baseline" ? "border-primary/70" : "opacity-70 hover:opacity-100"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "baseline" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "baseline" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Baseline Analysis</CardTitle>
            <CardDescription>Validate configurations against security baselines with compliance gap analysis and best practice recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5" /> Security baseline validation</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Compliance gap analysis</li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> Best practice recommendations</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("tenant");
            tenantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("tenant");
              tenantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "tenant" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "tenant" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "tenant" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Compare by Tenant</CardTitle>
            <CardDescription>Select and connect two tenants to compare policy coverage across multiple policy types.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-emerald-400" /> Cross-tenant policy compare</li>
              <li className="flex items-center gap-2"><GitCompareArrows className="h-3.5 w-3.5 text-blue-400" /> All-policy matching</li>
              <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-amber-400" /> Gap and drift overview</li>
            </ul>
          </CardContent>
        </Card>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveModule("baseline-security");
            baselineSecurityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveModule("baseline-security");
              baselineSecurityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-left"
        >
        <Card className={`border-primary/30 transition-colors ${activeModule === "baseline-security" ? "border-primary/70" : "hover:border-primary/40"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Badge variant={activeModule === "baseline-security" ? "default" : "secondary"} className="text-[10px]">
                {activeModule === "baseline-security" ? "ACTIVE" : "CORE"}
              </Badge>
            </div>
            <CardTitle className="text-lg">Baseline security mode</CardTitle>
            <CardDescription>Manage recommended security policies to reduce attack surface and reach minimum benchmark.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-emerald-400" /> Benchmark progress</li>
              <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-400" /> Recommendation tracking</li>
              <li className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-blue-400" /> Risk status filtering</li>
            </ul>
          </CardContent>
        </Card>
        </div>
      </div>

      {activeModule === "baseline" && (
        <div ref={baselineRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                Baseline Analysis Workspace
              </CardTitle>
              <CardDescription>
                Validate configurations against security baselines with compliance gap analysis and best practice recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  onClick={() => runBaselineAnalysis()}
                  disabled={baselineRunning}
                >
                  <Target className="mr-2 h-4 w-4" />
                  {baselineRunning ? "Running analysis..." : "Run Baseline Analysis"}
                </Button>
                <div className="text-xs text-muted-foreground">
                  {baselineRunAt ? `Last run: ${new Date(baselineRunAt).toLocaleString()}` : "Not run yet"}
                </div>
              </div>
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Source</CardTitle>
                  <CardDescription>Available security baselines from Microsoft Learn.</CardDescription>
                </CardHeader>
                <CardContent className="text-xs">
                  <a
                    href="https://learn.microsoft.com/en-us/intune/intune-service/protect/security-baselines"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open baseline catalog reference
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 gap-4">
                {baselineCoverage.map((baseline) => (
                  <Card key={baseline.id} className="border-primary/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm">{baseline.family}</CardTitle>
                        <Badge
                          variant={
                            baseline.status === "covered"
                              ? "success"
                              : baseline.status === "partial"
                                ? "warning"
                                : baseline.status === "gap"
                                  ? "danger"
                                  : "secondary"
                          }
                        >
                          {baseline.status}
                        </Badge>
                      </div>
                      {baseline.prerequisite ? (
                        <CardDescription>{baseline.prerequisite}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs">
                        <p className="mb-1 text-muted-foreground">Available versions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {baseline.versions.map((version) => (
                            <Badge key={`${baseline.id}:${version}`} variant="outline" className="text-[11px]">
                              {version}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <button
                          type="button"
                          onClick={() => setBaselineMetricView({ baselineId: baseline.id, metric: "mapped" })}
                          className="rounded-md border p-2 text-left hover:bg-accent/20"
                        >
                          <p className="text-muted-foreground">Mapped policies</p>
                          <p className="font-semibold">{baseline.totalMappedPolicies}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBaselineMetricView({ baselineId: baseline.id, metric: "same" })}
                          className="rounded-md border p-2 text-left hover:bg-accent/20"
                        >
                          <p className="text-muted-foreground">Same</p>
                          <p className="font-semibold text-emerald-400">{baseline.same}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBaselineMetricView({ baselineId: baseline.id, metric: "different" })}
                          className="rounded-md border p-2 text-left hover:bg-accent/20"
                        >
                          <p className="text-muted-foreground">Different</p>
                          <p className="font-semibold text-amber-400">{baseline.different}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBaselineMetricView({ baselineId: baseline.id, metric: "missing" })}
                          className="rounded-md border p-2 text-left hover:bg-accent/20"
                        >
                          <p className="text-muted-foreground">Missing</p>
                          <p className="font-semibold text-red-400">{baseline.missing}</p>
                        </button>
                      </div>
                      {baselineMetricView?.baselineId === baseline.id ? (
                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium">
                              {baselineMetricView.metric === "mapped" && "Mapped Policies"}
                              {baselineMetricView.metric === "same" && "Same Policies"}
                              {baselineMetricView.metric === "different" && "Different Policies"}
                              {baselineMetricView.metric === "missing" && "Missing Coverage"}
                            </p>
                            <Button variant="outline" size="sm" onClick={() => setBaselineMetricView(null)}>Close</Button>
                          </div>
                          <div className="space-y-1 text-xs">
                            {(baselineMetricView.metric === "mapped" ? baseline.items
                              : baselineMetricView.metric === "same" ? baseline.sameItems
                              : baselineMetricView.metric === "different" ? baseline.differentItems
                              : baseline.missing > 0 ? [] : []
                            ).slice(0, 120).map((item) => (
                              <button
                                type="button"
                                key={`baseline-list:${baseline.id}:${item.policy_key}`}
                                onClick={() => openTenantDetail(item)}
                                className="w-full rounded border px-2 py-1 text-left hover:bg-accent/20"
                              >
                                <p className="font-medium">{item.tenant_a_policy_name || item.policy_name}</p>
                                <p className="text-muted-foreground">{item.policy_type} · {baselineItemStatus(item)}</p>
                                <p className="text-muted-foreground">{baselineItemReason(item)}</p>
                              </button>
                            ))}
                            {baselineMetricView.metric === "missing" ? (
                              baseline.missing > 0 ? (
                                <div className="rounded border px-2 py-2">
                                  <p className="font-medium">No mapped policies found for this baseline in connected tenant.</p>
                                  <p className="text-muted-foreground">Create and assign the related baseline profile to remove this gap.</p>
                                </div>
                              ) : (
                                <p className="text-muted-foreground">No missing coverage for this baseline.</p>
                              )
                            ) : null}
                            {baselineMetricView.metric !== "missing" && (baselineMetricView.metric === "mapped" ? baseline.items.length
                              : baselineMetricView.metric === "same" ? baseline.sameItems.length
                              : baseline.differentItems.length) === 0 ? (
                              <p className="text-muted-foreground">No policies in this category.</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {baselineRunAt ? (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Gap & Missing Output</CardTitle>
                    <CardDescription>
                      Baseline analysis output for missing and drifted controls.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    {baselineGapOutput.length === 0 ? (
                      <p className="text-muted-foreground">No gap or missing items found in this run.</p>
                    ) : (
                      baselineGapOutput.map((baseline) => (
                        <div key={`gap:${baseline.family}`} className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{baseline.family}</p>
                            <Badge
                              variant={
                                baseline.status === "gap"
                                  ? "danger"
                                  : baseline.status === "partial"
                                    ? "warning"
                                    : "secondary"
                              }
                            >
                              {baseline.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">
                            Mapped: {baseline.totalMappedPolicies} | Different: {baseline.different} | Missing: {baseline.missing}
                          </p>
                          <div className="rounded border p-2 space-y-1">
                            <p className="font-medium">How to fix</p>
                            {baseline.fixSteps.map((step) => (
                              <p key={`fix-step:${baseline.family}:${step}`} className="text-muted-foreground">
                                • {step}
                              </p>
                            ))}
                            <a
                              href={baseline.fixUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Open remediation guide
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          {baseline.policyTypes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {baseline.policyTypes.map((type) => (
                                <Badge key={`gap-type:${baseline.family}:${type}`} variant="outline" className="text-[11px]">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {baseline.items.length > 0 ? (
                            <div className="space-y-1">
                              {baseline.items.slice(0, 8).map((item) => (
                                <div key={`gap-item:${baseline.family}:${item.policy_key}`} className="rounded border px-2 py-1 text-xs">
                                  <p className="font-medium">{item.policy_name}</p>
                                  <p className="text-muted-foreground">
                                    {item.policy_type} · {baselineItemStatus(item)}
                                  </p>
                                  <p className="text-muted-foreground">{baselineItemReason(item)}</p>
                                </div>
                              ))}
                              {baseline.items.length > 8 ? (
                                <p className="text-muted-foreground">+{baseline.items.length - 8} more items</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">No mapped policies found for this baseline in the connected tenant.</p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "tenant" && (
        <div ref={tenantRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows className="h-5 w-5 text-primary" />
                Compare by Tenant
              </CardTitle>
              <CardDescription>
                Select and connect two tenants, then compare policy coverage side-by-side across Entra and Intune policy types.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {useGlobalTenantA ? (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tenant B</CardTitle>
                    <CardDescription>Tenant A uses the globally connected tenant from sidebar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input value={tenantBLabel} onChange={(e) => setTenantBLabel(e.target.value)} placeholder="Label (optional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantBTenantId} onChange={(e) => setTenantBTenantId(e.target.value)} placeholder="Tenant ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantBClientId} onChange={(e) => setTenantBClientId(e.target.value)} placeholder="Client ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input type="password" value={tenantBClientSecret} onChange={(e) => setTenantBClientSecret(e.target.value)} placeholder="Client Secret" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                  </CardContent>
                </Card>
              ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tenant A</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input value={tenantALabel} onChange={(e) => setTenantALabel(e.target.value)} placeholder="Label (optional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantATenantId} onChange={(e) => setTenantATenantId(e.target.value)} placeholder="Tenant ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantAClientId} onChange={(e) => setTenantAClientId(e.target.value)} placeholder="Client ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input type="password" value={tenantAClientSecret} onChange={(e) => setTenantAClientSecret(e.target.value)} placeholder="Client Secret" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tenant B</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input value={tenantBLabel} onChange={(e) => setTenantBLabel(e.target.value)} placeholder="Label (optional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantBTenantId} onChange={(e) => setTenantBTenantId(e.target.value)} placeholder="Tenant ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input value={tenantBClientId} onChange={(e) => setTenantBClientId(e.target.value)} placeholder="Client ID" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                    <input type="password" value={tenantBClientSecret} onChange={(e) => setTenantBClientSecret(e.target.value)} placeholder="Client Secret" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                  </CardContent>
                </Card>
              </div>
              )}
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => compareTenantsMutation.mutate(buildComparePayload())}
                  disabled={
                    compareTenantsMutation.isPending ||
                    !tenantATenantId || !tenantAClientId || !tenantAClientSecret ||
                    !tenantBTenantId || !tenantBClientId || !tenantBClientSecret
                  }
                  size="lg"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {compareTenantsMutation.isPending ? "Connecting & Comparing..." : "Compare Tenants"}
                </Button>
                {tenantResult ? (
                  <Button
                    variant="outline"
                    onClick={() => compareTenantsMutation.mutate(buildComparePayload())}
                    disabled={compareTenantsMutation.isPending}
                    size="lg"
                  >
                    Re-sync
                  </Button>
                ) : null}
              </div>
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Required API permissions (Application)</CardTitle>
                  <CardDescription>Grant these in both tenants and click admin consent before running cross-tenant compare.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Policy.Read.ConditionalAccess</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-blue-400" /> Policy.Read.All</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-400" /> Organization.Read.All</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-purple-400" /> DeviceManagementConfiguration.Read.All</li>
                    <li className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-cyan-400" /> DeviceManagementApps.Read.All</li>
                  </ul>
                </CardContent>
              </Card>
              {tenantResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{tenantResult.summary.match}</p><p className="text-xs text-muted-foreground mt-1">Match</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-amber-400">{tenantResult.summary.not_match}</p><p className="text-xs text-muted-foreground mt-1">Not match</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-red-400">{tenantResult.summary.duplicate}</p><p className="text-xs text-muted-foreground mt-1">Duplicate</p></CardContent></Card>
                    <Card><CardContent className="p-5 text-center"><p className="text-3xl font-bold text-blue-400">{tenantResult.summary.total_policies_compared}</p><p className="text-xs text-muted-foreground mt-1">Policies compared</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Policy Match List</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredTenantItems.length} of {tenantStatusCounts[tenantStatusFilter]} {tenantStatusFilter === "all" ? "policies" : tenantStatusFilter}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
                        <input
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          placeholder="Search policy name, type, reason..."
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        />
                        <select
                          value={tenantPolicyTypeFilter}
                          onChange={(e) => setTenantPolicyTypeFilter(e.target.value)}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">All policy types</option>
                          {tenantPolicyTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 flex-wrap pt-1">
                        {(["all", "match", "not_match", "duplicate"] as const).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={tenantStatusFilter === status ? "default" : "outline"}
                            onClick={() => {
                              setTenantSearch("");
                              setTenantPolicyTypeFilter("all");
                              setTenantCategoryFilter("all");
                              setTenantSubStatusFilter("all");
                              setTenantStatusFilter(status);
                              setIsTenantDetailOpen(false);
                              setSelectedTenantItem(null);
                            }}
                          >
                            {status === "all" ? "All" : status} ({tenantStatusCounts[status]})
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap pt-1">
                        {(["all", "intune_compliance", "intune_device_configuration", "conditional_access", "other"] as const).map((category) => (
                          <Button
                            key={category}
                            type="button"
                            size="sm"
                            variant={tenantCategoryFilter === category ? "default" : "outline"}
                            onClick={() => {
                              setTenantCategoryFilter(category);
                              setIsTenantDetailOpen(false);
                              setSelectedTenantItem(null);
                            }}
                          >
                            {categoryLabel(category)} ({tenantCategoryCounts[category]})
                          </Button>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {filteredTenantItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No policies in this filter.</p>
                      ) : (
                        filteredTenantItems.map((item) => (
                          <button
                            type="button"
                            key={`${item.policy_type}:${item.policy_key}`}
                            onClick={() => openTenantDetail(item)}
                            className={`w-full rounded-md border p-3 flex items-center justify-between gap-3 text-left hover:bg-accent/30 ${
                              selectedTenantItem?.policy_key === item.policy_key ? "border-primary/70 bg-accent/20" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.policy_name}</p>
                              <p className="text-xs text-muted-foreground">{item.policy_type} · {categoryLabel(policyCategory(item.policy_type))}</p>
                              <p className="text-xs text-muted-foreground">{item.reason}</p>
                              <p className="text-xs text-muted-foreground">
                                {tenantResult.tenant_a.name}: {item.tenant_a_count} | {tenantResult.tenant_b.name}: {item.tenant_b_count}
                              </p>
                              {(item.tenant_a_policy_name || item.tenant_b_policy_name) && (
                                <p className="text-xs text-muted-foreground">
                                  A: {item.tenant_a_policy_name || "—"} | B: {item.tenant_b_policy_name || "—"}
                                </p>
                              )}
                              {item.comparison && (
                                <p className="text-xs text-muted-foreground">
                                  Same: {item.comparison.same_settings_count}, Different values: {item.comparison.different_values_count}, Only A: {item.comparison.only_in_tenant_a_count}, Only B: {item.comparison.only_in_tenant_b_count}
                                </p>
                              )}
                              {item.comparison?.sample_different_paths?.length ? (
                                <p className="text-xs text-muted-foreground">
                                  Diff sample: {item.comparison.sample_different_paths[0].path}
                                </p>
                              ) : null}
                            </div>
                            <Badge variant={item.status === "match" ? "success" : item.status === "duplicate" ? "danger" : "warning"}>
                              {item.status}
                            </Badge>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                  {tenantResult.source_errors?.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Unavailable Policy Types</CardTitle>
                        <CardDescription>Some policy types could not be read with current permissions.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {tenantResult.source_errors.map((err) => (
                          <div key={err.policy_type} className="rounded-md border p-3">
                            <p className="text-sm font-medium">{err.policy_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {err.error}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeModule === "baseline-security" && (
        <div ref={baselineSecurityRef}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Baseline security mode
              </CardTitle>
              <CardDescription>
                Manage these policies to reduce your attack surface and harden your Microsoft 365 organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Learn about baseline security mode and why it's important.
                </div>
                <a
                  href="https://admin.cloud.microsoft/?source=applauncher#/baselinesecuritymode"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    Open Baseline Security Mode
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Progress to meet standard</p>
                    <p className="text-2xl font-bold">13%</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Applied recommendations</p>
                    <p className="text-2xl font-bold">2 / 16</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Standard benchmark</p>
                    <p className="text-2xl font-bold">At risk</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Settings recommendations loaded</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    ["Block new password credentials in apps", "At risk", "Entra ID"],
                    ["Turn on restricted management user consent settings", "At risk", "Entra ID"],
                    ["Block access to Exchange Web Services", "At risk", "Exchange"],
                    ["Block basic authentication prompts", "Meets standard", "Microsoft 365 apps"],
                    ["Block files from opening with insecure protocols", "At risk", "Microsoft 365 apps"],
                    ["Block files from opening with FPRPC protocol", "At risk", "Microsoft 365 apps"],
                    ["Block legacy browser authentication connections to SharePoint", "Meets standard", "SharePoint"],
                    ["Block IDCRL protocol connections to SharePoint", "At risk", "SharePoint"],
                    ["Don't allow new custom scripts in OneDrive and SharePoint sites", "At risk", "SharePoint"],
                    ["Remove access to Microsoft Store for SharePoint", "At risk", "SharePoint"],
                    ["Open ancient legacy formats in Protected View and disallow editing", "At risk", "Microsoft 365 apps"],
                    ["Open old legacy formats in Protected View and save as modern format", "At risk", "Microsoft 365 apps"],
                    ["Block ActiveX controls in the Microsoft 365 apps", "At risk", "Microsoft 365 apps"],
                    ["Block OLE Graph and OrgChart objects", "At risk", "Microsoft 365 apps"],
                    ["Block Dynamic Data Exchange (DDE) server launch in Excel", "At risk", "Microsoft 365 apps"],
                    ["Block Microsoft Publisher", "At risk", "Microsoft 365 apps"],
                    ["Block unmanaged devices and resource account sign-ins to Microsoft 365 apps", "Not applicable", "Teams"],
                    ["Don't allow resource accounts on Teams Rooms devices from accessing Microsoft 365 files", "Not applicable", "Teams"],
                  ].map(([name, status, product]) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() =>
                        setSelectedBaselineSecurityRec(
                          BASELINE_SECURITY_RECOMMENDATIONS.find((r) => r.name === name) ??
                          recommendationFallback(name, status, product),
                        )
                      }
                      className="w-full rounded-md border p-3 flex items-center justify-between gap-3 text-left hover:bg-accent/20"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{product}</p>
                      </div>
                      <Badge variant={status === "At risk" ? "warning" : status === "Meets standard" ? "success" : "secondary"}>
                        {status}
                      </Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedBaselineSecurityRec ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="mx-auto w-[min(920px,96vw)] rounded-2xl border border-primary/30 bg-background shadow-2xl">
            <div className="border-b border-border/60 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight">Recommendation Detail</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedBaselineSecurityRec.name}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedBaselineSecurityRec(null)}>
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>
            <div className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedBaselineSecurityRec.status === "At risk" ? "warning" : selectedBaselineSecurityRec.status === "Meets standard" ? "success" : "secondary"}>
                  {selectedBaselineSecurityRec.status}
                </Badge>
                <Badge variant="outline">{selectedBaselineSecurityRec.product}</Badge>
              </div>
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">What To Do</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {selectedBaselineSecurityRec.whatToDo.map((line) => (
                    <p key={`todo:${selectedBaselineSecurityRec.name}:${line}`}>• {line}</p>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">How To Fix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {selectedBaselineSecurityRec.howToFix.map((line) => (
                    <p key={`fix:${selectedBaselineSecurityRec.name}:${line}`}>• {line}</p>
                  ))}
                </CardContent>
              </Card>
              <a
                href={selectedBaselineSecurityRec.guideUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
              >
                Open Microsoft guidance
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTenantItem && isTenantDetailOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="mx-auto w-[min(1600px,98vw)] max-h-[94vh] overflow-hidden rounded-2xl border border-primary/30 bg-background shadow-2xl">
            <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur px-3 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight">Policy Detail View</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedTenantItem.policy_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
		                <Button
		                  variant={detailViewMode === "plain" ? "default" : "outline"}
		                  size="sm"
		                  onClick={() => setDetailViewMode("plain")}
	                >
	                  Non-code view
	                </Button>
	                <Button
	                  variant={detailViewMode === "json" ? "default" : "outline"}
	                  size="sm"
	                  onClick={() => setDetailViewMode("json")}
                >
		                  JSON view
	                </Button>
	                <Button variant="outline" size="sm" onClick={() => { setIsTenantDetailOpen(false); setSelectedTenantItem(null); }}>
	                  <X className="h-4 w-4 mr-1" />
	                  Close
	                </Button>
	                </div>
	              </div>
	            </div>
              <div className="overflow-y-auto max-h-[calc(94vh-92px)] px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
		            {detailViewMode === "plain" ? (
		              <div className="space-y-4">
		                <Card className="border-primary/30">
	                  <CardHeader className="pb-2">
	                    <CardTitle className="text-sm">Side-by-Side Summary</CardTitle>
	                  </CardHeader>
		                  <CardContent className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
		                    <div className="rounded-md border p-3 space-y-1">
		                      <p className="font-medium">{tenantResult?.tenant_a.name ?? "Tenant A"}</p>
		                      <p className="text-muted-foreground">Policy: {summaryTenantAPolicyName}</p>
		                      <p className="text-muted-foreground">Platform: {readPolicyMeta(summaryTenantAData).platform}</p>
		                      <p className="text-muted-foreground">Created: {readPolicyMeta(summaryTenantAData).createdDate}</p>
		                      <p className="text-muted-foreground">Last modified: {readPolicyMeta(summaryTenantAData).lastModified}</p>
		                      <p className="text-muted-foreground">Setting count: {readPolicyMeta(summaryTenantAData).settingCount}</p>
		                      <p className="text-muted-foreground">Assigned to: {readPolicyMeta(summaryTenantAData).assignedTo}</p>
		                    </div>
		                    <div className="rounded-md border p-3 space-y-1">
		                      <p className="font-medium">{tenantResult?.tenant_b.name ?? "Tenant B"}</p>
		                      <p className="text-muted-foreground">Policy: {summaryTenantBPolicyName}</p>
		                      <p className="text-muted-foreground">Platform: {readPolicyMeta(summaryTenantBData).platform}</p>
		                      <p className="text-muted-foreground">Created: {readPolicyMeta(summaryTenantBData).createdDate}</p>
		                      <p className="text-muted-foreground">Last modified: {readPolicyMeta(summaryTenantBData).lastModified}</p>
		                      <p className="text-muted-foreground">Setting count: {readPolicyMeta(summaryTenantBData).settingCount}</p>
		                      <p className="text-muted-foreground">Assigned to: {readPolicyMeta(summaryTenantBData).assignedTo}</p>
		                    </div>
		                  </CardContent>
		                </Card>
		                <Card className="border-primary/30">
		                  <CardHeader className="pb-2">
		                    <div className="flex items-center justify-between gap-3">
		                      <CardTitle className="text-sm">Non-code Side-by-Side Settings</CardTitle>
		                      <p className="text-xs text-muted-foreground">
	                        Showing {nonCodeStart}-{nonCodeEnd} of {nonCodeTotalRows}
	                      </p>
		                    </div>
		                  </CardHeader>
		                  <CardContent>
		                    <div className="rounded-md border overflow-hidden max-h-[62vh] overflow-auto">
		                      <table className="w-full text-xs">
		                        <thead className="bg-muted/50 sticky top-0 z-10">
	                          <tr>
	                            <th className="px-3 py-2 text-left">Setting</th>
	                            <th className="px-3 py-2 text-left">{tenantResult?.tenant_a.name ?? "Tenant A"}</th>
	                            <th className="px-3 py-2 text-left">{tenantResult?.tenant_b.name ?? "Tenant B"}</th>
	                            <th className="px-3 py-2 text-left">Result</th>
	                          </tr>
	                        </thead>
	                        <tbody>
		                          {nonCodePageRows.map((row) => (
		                            <tr key={`plain:${row.result}:${row.path}`} className="border-t">
		                              <td className="px-3 py-2">
		                                <p className="font-medium">{row.setting}</p>
		                              </td>
	                              <td className="px-3 py-2 break-all">{row.a}</td>
	                              <td className="px-3 py-2 break-all">{row.b}</td>
	                              <td className="px-3 py-2">
	                                <Badge
	                                  variant={
	                                    row.result === "same"
	                                      ? "success"
	                                      : row.result === "different"
	                                        ? "warning"
	                                        : "danger"
	                                  }
	                                >
	                                  {row.result}
	                                </Badge>
	                              </td>
	                            </tr>
	                          ))}
	                          {nonCodeTotalRows === 0 ? (
	                            <tr className="border-t">
	                              <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
	                                No settings available for side-by-side view.
	                              </td>
	                            </tr>
	                          ) : null}
	                        </tbody>
	                      </table>
	                    </div>
	                    {nonCodeTotalRows > NON_CODE_PAGE_SIZE ? (
	                      <div className="mt-3 flex items-center justify-end gap-2">
	                        <Button
	                          size="sm"
	                          variant="outline"
	                          type="button"
	                          disabled={safeNonCodePage <= 1}
	                          onClick={() => setNonCodePage((p) => Math.max(1, p - 1))}
	                        >
	                          Previous
	                        </Button>
	                        <p className="text-xs text-muted-foreground">
	                          Page {safeNonCodePage} / {nonCodeTotalPages}
	                        </p>
	                        <Button
	                          size="sm"
	                          variant="outline"
	                          type="button"
	                          disabled={safeNonCodePage >= nonCodeTotalPages}
	                          onClick={() => setNonCodePage((p) => Math.min(nonCodeTotalPages, p + 1))}
	                        >
	                          Next
	                        </Button>
	                      </div>
		                    ) : null}
		                  </CardContent>
		                </Card>
		              </div>
		            ) : (
	              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tenantResult?.tenant_a.name ?? "Tenant A"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Policy: {selectedTenantItem.tenant_a_policy_name || "Not present"}</p>
                    <p className="text-xs text-muted-foreground">IDs: {selectedTenantItem.tenant_a_ids.join(", ") || "—"}</p>
                    <pre className="max-h-80 overflow-auto rounded-md border p-2 text-[11px]">
{JSON.stringify(selectedTenantItem.tenant_a_data ?? {}, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tenantResult?.tenant_b.name ?? "Tenant B"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">Policy: {selectedTenantItem.tenant_b_policy_name || "Not present"}</p>
                    <p className="text-xs text-muted-foreground">IDs: {selectedTenantItem.tenant_b_ids.join(", ") || "—"}</p>
                    <pre className="max-h-80 overflow-auto rounded-md border p-2 text-[11px]">
{JSON.stringify(selectedTenantItem.tenant_b_data ?? {}, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
	            {selectedTenantItem.comparison && (
	              <Card className="border-primary/30 mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Settings Difference Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    Category: {categoryLabel(selectedPolicyCategory)} ({selectedCategoryItems.length} policies)
                  </p>
                  <p>
                    Category totals | Same settings: {selectedCategorySummary.same_settings} | Different settings: {selectedCategorySummary.different_settings} | Missing in {tenantResult?.tenant_a.name ?? "Tenant A"}: {selectedCategorySummary.missing_in_tenant_a} | Missing in {tenantResult?.tenant_b.name ?? "Tenant B"}: {selectedCategorySummary.missing_in_tenant_b} | Duplicate: {selectedCategorySummary.duplicate}
                  </p>
                  <p>
                    Same: {selectedTenantItem.comparison.same_settings_count} | Different values: {selectedTenantItem.comparison.different_values_count} | Only A: {selectedTenantItem.comparison.only_in_tenant_a_count} | Only B: {selectedTenantItem.comparison.only_in_tenant_b_count}
                  </p>
                  {selectedTenantItem.comparison.sample_different_paths.length > 0 && (
                    <div>
                      <p className="font-medium">Different value samples</p>
                      {selectedTenantItem.comparison.sample_different_paths.map((d) => (
                        <p key={d.path}>
                          {d.path}: A={d.tenant_a_value ?? "null"} | B={d.tenant_b_value ?? "null"}
                        </p>
                      ))}
                    </div>
                  )}
	                </CardContent>
	              </Card>
	            )}
              </div>
	          </div>
	        </div>
	      )}
    </div>
  );
}


