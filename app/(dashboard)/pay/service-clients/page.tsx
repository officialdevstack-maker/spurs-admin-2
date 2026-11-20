"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addServiceClient,
  listServiceClients,
  revokeServiceClient,
  type ServiceClientRow,
} from "@/lib/admin-api";
import { hasPermission } from "@/lib/permissions";

const msg = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export default function PayServiceClientsPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user?.permissions ?? [], "pay.service_clients.manage");
  const [rows, setRows] = React.useState<ServiceClientRow[]>([]);
  const [clientId, setClientId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  async function reload() {
    setLoading(true);
    try {
      setRows(await listServiceClients());
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let active = true;
    listServiceClients()
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((error) => {
        if (active) toast.error(msg(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function grant() {
    const reason = window.prompt("Reason for granting Pay service access:");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      setRows(await addServiceClient({ clientId: clientId.trim(), product: "wallet", reason: reason.trim() }));
      setClientId("");
      toast.success("Service client granted.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row: ServiceClientRow) {
    const reason = window.prompt(`Reason to revoke ${row.clientId}:`);
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await revokeServiceClient(row.clientId, reason.trim());
      await reload();
      toast.success("Service client revoked.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay service clients</h2>
        <p className="text-sm text-muted-foreground">
          Grant Accounts clients access to the Pay service API. Pay&apos;s own client and the pay product are blocked.
        </p>
      </div>

      {canWrite && (
        <div className="flex max-w-xl items-end gap-3 rounded-xl border p-4">
          <div className="flex-1 space-y-1.5">
            <Label>Accounts client ID</Label>
            <Input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="wallet-client" />
          </div>
          <Button onClick={grant} disabled={busy || !clientId.trim()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Grant wallet access
          </Button>
        </div>
      )}

      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <div className="divide-y rounded-xl border">
          {rows.map((row) => (
            <div className="flex items-center justify-between gap-4 p-3" key={row.clientId}>
              <div>
                <p className="text-sm font-medium">{row.clientId}</p>
                <p className="text-xs text-muted-foreground">
                  Product: {row.product} - {row.revokedAt ? "revoked" : "active"}
                </p>
              </div>
              {canWrite && !row.revokedAt && (
                <Button variant="outline" size="sm" onClick={() => revoke(row)} disabled={busy}>Revoke</Button>
              )}
            </div>
          ))}
          {!rows.length && <p className="p-4 text-sm text-muted-foreground">No service clients configured.</p>}
        </div>
      )}
    </div>
  );
}
