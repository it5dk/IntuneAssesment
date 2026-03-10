"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  KeyRound,
  Shield,
  Lock,
  Settings,
  Monitor,
  Users,
  ArrowLeftRight,
  ShieldCheck,
  Crown,
  AlertTriangle,
  Activity,
  FileText,
  Zap,
  GitCompare,
  Gauge,
  Swords,
  Thermometer,
  Clock,
  UserX,
  Ghost,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TenantConnectButton } from "@/components/tenant-connect-button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  section?: string;
}

const navItems: NavItem[] = [
  // Core
  { label: "Overview", href: "/", icon: LayoutDashboard, section: "Core" },
  { label: "Assessments", href: "/assistant", icon: Users },
  { label: "Devices", href: "/devices", icon: Monitor },
  { label: "Configuration", href: "/configuration", icon: Settings },
  { label: "Conditional Access", href: "/conditional-access", icon: Lock },
  { label: "Compare Policies", href: "/compare", icon: ArrowLeftRight },

  // Security
  { label: "Key Vault", href: "/drifts", icon: KeyRound, section: "Security" },
  { label: "Device Compliance", href: "/device-compliance", icon: ShieldCheck },
  { label: "Privileged Access", href: "/privileged-access", icon: Crown },
  { label: "Endpoint Protection", href: "/endpoint-protection", icon: Shield },
  { label: "Security Alerts", href: "/security-alerts", icon: AlertTriangle },
  { label: "Threat Analytics", href: "/threat-analytics", icon: Activity },
  { label: "Audit Logs", href: "/audit-logs", icon: FileText },

  // Intelligence
  { label: "Drift Detection", href: "/drift-detection", icon: GitCompare, section: "Intelligence" },
  { label: "Security Score", href: "/security-score", icon: Gauge },
  { label: "Policy Conflicts", href: "/policy-conflicts", icon: Swords },
  { label: "Tenant Risk", href: "/tenant-risk", icon: Thermometer },
  { label: "Expiring Permissions", href: "/expiring-permissions", icon: Clock },
  { label: "Inactive Admins", href: "/inactive-admins", icon: UserX },
  { label: "Shadow Apps", href: "/shadow-apps", icon: Ghost },

  // Automation
  { label: "Automation", href: "/automation", icon: Zap, section: "Automation" },
];

export function Sidebar() {
  const pathname = usePathname();
  let lastSection = "";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Drift Control</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={item.href}>
              {showSection && (
                <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-6 py-4">
        <TenantConnectButton />
        <div className="mt-3">
        <p className="text-xs text-muted-foreground">Drift Control v1.0</p>
        <p className="text-xs text-muted-foreground">Single Tenant</p>
        </div>
      </div>
    </aside>
  );
}
