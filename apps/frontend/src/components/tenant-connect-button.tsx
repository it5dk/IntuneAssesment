"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const GLOBAL_TENANT_CONNECTION_KEY = "global_tenant_connection_v1";
const TENANT_COMPARE_PREFS_KEY = "compare_tenant_prefs_v1";
const GLOBAL_TENANT_SECRET_SESSION_KEY = "global_tenant_connection_secret_v1";

type TenantConnection = {
  label: string;
  tenantId: string;
  clientId: string;
};

export function TenantConnectButton() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<TenantConnection | null>(null);
  const [label, setLabel] = useState("Tenant A");
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GLOBAL_TENANT_CONNECTION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<TenantConnection>;
      const tenant = {
        label: saved.label || "Tenant A",
        tenantId: saved.tenantId || "",
        clientId: saved.clientId || "",
      };
      setConnected(tenant);
      setLabel(tenant.label);
      setTenantId(tenant.tenantId);
      setClientId(tenant.clientId);

      const secret = window.sessionStorage.getItem(GLOBAL_TENANT_SECRET_SESSION_KEY);
      if (secret) setClientSecret(secret);
    } catch {
      // Ignore bad cache.
    }
  }, []);

  const onSave = () => {
    const next: TenantConnection = {
      label: label.trim() || "Tenant A",
      tenantId: tenantId.trim(),
      clientId: clientId.trim(),
    };
    setConnected(next);
    window.localStorage.setItem(GLOBAL_TENANT_CONNECTION_KEY, JSON.stringify(next));
    window.sessionStorage.setItem(GLOBAL_TENANT_SECRET_SESSION_KEY, clientSecret);

    // Keep compare page defaults aligned with the global connection.
    try {
      const raw = window.localStorage.getItem(TENANT_COMPARE_PREFS_KEY);
      const existing = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      window.localStorage.setItem(
        TENANT_COMPARE_PREFS_KEY,
        JSON.stringify({
          ...existing,
          tenantALabel: next.label,
          tenantATenantId: next.tenantId,
          tenantAClientId: next.clientId,
        }),
      );
    } catch {
      // Ignore compare preference cache errors.
    }

    window.dispatchEvent(new CustomEvent("tenant-connection-updated"));
    window.dispatchEvent(new CustomEvent("tenant-data-reload"));
    setOpen(false);
    window.location.reload();
  };

  const onReload = () => {
    window.dispatchEvent(new CustomEvent("tenant-data-reload"));
    window.location.reload();
  };

  const onLogoff = () => {
    setConnected(null);
    setLabel("Tenant A");
    setTenantId("");
    setClientId("");
    setClientSecret("");
    window.localStorage.removeItem(GLOBAL_TENANT_CONNECTION_KEY);
    window.sessionStorage.removeItem(GLOBAL_TENANT_SECRET_SESSION_KEY);
    try {
      const raw = window.localStorage.getItem(TENANT_COMPARE_PREFS_KEY);
      if (raw) {
        const existing = JSON.parse(raw) as Record<string, string>;
        delete existing.tenantALabel;
        delete existing.tenantATenantId;
        delete existing.tenantAClientId;
        window.localStorage.setItem(TENANT_COMPARE_PREFS_KEY, JSON.stringify(existing));
      }
    } catch {
      // Ignore compare preference cache errors.
    }
    window.dispatchEvent(new CustomEvent("tenant-connection-updated"));
    window.dispatchEvent(new CustomEvent("tenant-data-reload"));
    window.location.reload();
  };

  return (
    <>
      <div className="space-y-2">
        <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
          {connected ? "Connected Tenant" : "Connect Tenant"}
        </Button>
        {connected ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="w-full" onClick={onReload}>
              Reload
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={onLogoff}>
              Logoff
            </Button>
          </div>
        ) : null}
        {connected ? (
          <div className="space-y-1">
            <Badge variant="success" className="w-full justify-center">
              Connected
            </Badge>
            <p className="text-[10px] text-muted-foreground truncate">{connected.label}</p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">No tenant connected</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border-primary/30">
          <DialogHeader>
            <DialogTitle>Connect Tenant</DialogTitle>
            <DialogDescription>
              Save tenant credentials for reuse across the dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-primary/30 bg-card p-6">
            <p className="mb-4 text-xl font-semibold">Tenant A</p>
            <div className="space-y-3">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Tenant A"
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm"
              />
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Tenant ID"
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm"
              />
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID"
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm"
              />
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client Secret"
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={!tenantId.trim() || !clientId.trim() || !clientSecret.trim()}
            >
              Connect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
