"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPayPolicy,
  listPayPolicyVersions,
  rollbackPayPolicy,
  savePayPolicy,
  type PayPolicy,
  type PayPolicyVersion,
} from "@/lib/admin-api";
import { hasPermission } from "@/lib/permissions";

const msg = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export default function PayPolicyPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user?.permissions ?? [], "pay.policy.manage");
  const [policy, setPolicy] = React.useState<PayPolicy | null>(null);
  const [version, setVersion] = React.useState(0);
  const [versions, setVersions] = React.useState<PayPolicyVersion[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getPayPolicy(), listPayPolicyVersions()])
      .then(([active, history]) => {
        setPolicy(active.config);
        setVersion(active.version);
        setVersions(history);
      })
      .catch((error) => toast.error(msg(error)));
  }, []);

  function setNumber(path: "fee" | "ttl" | "grace", value: number) {
    setPolicy((current) => {
      if (!current) return current;
      if (path === "fee") return { ...current, fees: { cardFundingBps: value } };
      if (path === "ttl") return { ...current, checkout: { ...current.checkout, sessionTtlSeconds: value } };
      return { ...current, checkout: { ...current.checkout, attemptGraceSeconds: value } };
    });
  }

  function setLimit(field: keyof PayPolicy["limits"], value: string) {
    setPolicy((current) => current ? { ...current, limits: { ...current.limits, [field]: value } } : current);
  }

  async function save() {
    if (!policy) return;
    const reason = window.prompt("Reason for this policy change:");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      const saved = await savePayPolicy(policy, reason.trim());
      setPolicy(saved.config);
      setVersion(saved.version);
      setVersions(await listPayPolicyVersions());
      toast.success(`Policy version ${saved.version} saved.`);
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  async function rollback(item: PayPolicyVersion) {
    const reason = window.prompt(`Reason to roll back to version ${item.version}:`);
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      const saved = await rollbackPayPolicy(item.version, reason.trim());
      setPolicy(saved.config);
      setVersion(saved.version);
      setVersions(await listPayPolicyVersions());
      toast.success(`Rolled back to version ${item.version}.`);
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  if (!policy) return <Loader2 className="size-5 animate-spin" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay policy</h2>
        <p className="text-sm text-muted-foreground">Active version: {version || "defaults"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border p-4">
          <h3 className="font-medium">Fees and limits</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Card funding (bps)</Label>
              <Input type="number" value={policy.fees.cardFundingBps} disabled={!canWrite} onChange={(event) => setNumber("fee", Number(event.target.value))} />
            </div>
            {(Object.keys(policy.limits) as (keyof PayPolicy["limits"])[]).map((field) => (
              <div className="space-y-1.5" key={field}>
                <Label>{field}</Label>
                <Input value={policy.limits[field]} disabled={!canWrite} onChange={(event) => setLimit(field, event.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border p-4">
          <h3 className="font-medium">Checkout and methods</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Session TTL (seconds)</Label>
              <Input type="number" value={policy.checkout.sessionTtlSeconds} disabled={!canWrite} onChange={(event) => setNumber("ttl", Number(event.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bank-transfer grace (seconds)</Label>
              <Input type="number" value={policy.checkout.attemptGraceSeconds} disabled={!canWrite} onChange={(event) => setNumber("grace", Number(event.target.value))} />
            </div>
            {(["wallet", "card", "bankTransfer"] as const).map((method) => (
              <label className="flex items-center gap-2 text-sm" key={method}>
                <input
                  type="checkbox"
                  checked={policy.methods[method]}
                  disabled={!canWrite}
                  onChange={(event) => setPolicy((current) => current ? {
                    ...current,
                    methods: { ...current.methods, [method]: event.target.checked },
                  } : current)}
                />
                {method}
              </label>
            ))}
          </div>
        </section>
      </div>

      {canWrite && (
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Save policy
        </Button>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">Change history</h3>
        <div className="divide-y rounded-xl border">
          {versions.map((item) => (
            <div className="flex items-center justify-between gap-4 p-3" key={item.version}>
              <div>
                <p className="text-sm font-medium">Version {item.version}{item.rolledBackFrom ? ` (rollback of ${item.rolledBackFrom})` : ""}</p>
                <p className="text-xs text-muted-foreground">{item.reason} - {item.createdBy ?? "unknown"}</p>
              </div>
              {canWrite && item.version !== version && <Button variant="outline" size="sm" onClick={() => rollback(item)} disabled={busy}>Rollback</Button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
