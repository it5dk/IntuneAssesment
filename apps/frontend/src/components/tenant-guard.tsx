"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GLOBAL_TENANT_CONNECTION_KEY = "global_tenant_connection_v1";

function hasConnectedTenant(): boolean {
  try {
    const raw = window.localStorage.getItem(GLOBAL_TENANT_CONNECTION_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as { tenantId?: string; clientId?: string };
    return Boolean(saved.tenantId && saved.clientId);
  } catch {
    return false;
  }
}

export function TenantGuard({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const refresh = () => setConnected(hasConnectedTenant());
    refresh();
    window.addEventListener("tenant-connection-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tenant-connection-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Tenant Connected</CardTitle>
          <CardDescription>
            Connect a tenant from the left sidebar to load dashboard data.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Existing view data has been unloaded.
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

