"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePayMerchantStatus, createPayMerchant } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { listPayMerchants, type PayMerchant } from "@/lib/pay-api";
import { hasPermission } from "@/lib/permissions";

const msg = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

function formatAmount(amount: string) {
  if (!/^\d+$/.test(amount)) return `${amount} NGN`;
  const whole = amount.slice(0, -2) || "0";
  const kobo = amount.slice(-2).padStart(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
}

const STATUS_STYLE: Record<PayMerchant["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-accent text-accent-foreground",
  suspended: "bg-destructive/10 text-destructive",
};

export default function PayMerchantsPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user?.permissions ?? [], "pay.write");
  const canApprove = hasPermission(user?.permissions ?? [], "pay.approve");

  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [result, setResult] = React.useState<{
    key: string;
    rows?: PayMerchant[];
    error?: string;
  } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const key = `${status}\u0000${search}\u0000${reload}`;

  React.useEffect(() => {
    let active = true;
    listPayMerchants({ status: status || undefined, search: search.trim() || undefined })
      .then((response) => active && setResult({ key, rows: response.data }))
      .catch((cause: unknown) => active && setResult({ key, error: msg(cause) }));
    return () => {
      active = false;
    };
  }, [status, search, reload, key]);

  const current = result?.key === key ? result : null;
  const error = current?.error;

  async function act(merchant: PayMerchant, action: "approve" | "suspend" | "reactivate") {
    const reason = window.prompt(`Reason to ${action} ${merchant.name}:`)?.trim();
    if (!reason) return;
    setBusy(merchant.id);
    try {
      await changePayMerchantStatus(merchant.id, action, reason);
      toast.success(`${merchant.name}: ${action} done.`);
      setReload((value) => value + 1);
    } catch (cause) {
      toast.error(msg(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pay merchants</h2>
          <p className="text-sm text-muted-foreground">Create, approve and suspend merchants.</p>
        </div>
        {canWrite && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> New merchant
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search merchants"
          placeholder="Search merchant"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Merchant status"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Paid checkouts</th>
              <th className="px-4 py-3 font-medium">Paid volume</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!current && !error ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Loading merchants…</td></tr>
            ) : error ? (
              <tr><td className="px-4 py-8 text-center text-destructive" colSpan={6}>Merchants could not be loaded.</td></tr>
            ) : current?.rows?.length ? (
              current.rows.map((merchant) => (
                <tr key={merchant.id}>
                  <td className="px-4 py-3">
                    <Link className="font-medium hover:underline" href={`/pay/merchants/${merchant.id}`}>
                      {merchant.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{merchant.clientId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[merchant.status]}`}>
                      {merchant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {merchant.paidCheckoutCount.toLocaleString()} / {merchant.checkoutCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatAmount(merchant.paidVolume)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(merchant.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {merchant.status === "pending" && canApprove && (
                        <Button size="sm" disabled={busy === merchant.id} onClick={() => act(merchant, "approve")}>
                          Approve
                        </Button>
                      )}
                      {merchant.status === "active" && canWrite && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === merchant.id}
                          onClick={() => act(merchant, "suspend")}
                        >
                          Suspend
                        </Button>
                      )}
                      {merchant.status === "suspended" && canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === merchant.id}
                          onClick={() => act(merchant, "reactivate")}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No merchants found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <NewMerchantDialog
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => setReload((value) => value + 1)}
      />
    </div>
  );
}

function NewMerchantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = React.useState({ name: "", returnUrl: "", reason: "" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });
  const [issued, setIssued] = React.useState<{ clientId: string; clientSecret: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await createPayMerchant(form);
      if (!result.credentials) throw new Error("Merchant was created without credentials. Contact an administrator.");
      setIssued(result.credentials);
      toast.success(`${form.name} was created and is waiting for approval.`);
      onCreated();
    } catch (cause) {
      setError(msg(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{issued ? "Save merchant credentials" : "New merchant"}</DialogTitle>
            <DialogDescription>
              {issued
                ? "The client secret is shown once. Copy and securely share it with the merchant now."
                : "Credentials are provisioned automatically. The merchant stays pending until a different admin approves it."}
            </DialogDescription>
          </DialogHeader>
          {issued ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="issued-client-id">Client ID</Label>
                <Input id="issued-client-id" readOnly value={issued.clientId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issued-client-secret">Client secret (one-time)</Label>
                <Input id="issued-client-secret" readOnly type="password" value={issued.clientSecret} />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(issued.clientSecret).then(
                  () => toast.success("Client secret copied."),
                  () => toast.error("Could not copy the client secret."),
                )}
              >
                Copy client secret
              </Button>
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" required value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-url">Return URL</Label>
            <Input
              id="m-url"
              type="url"
              required
              placeholder="https://"
              value={form.returnUrl}
              onChange={set("returnUrl")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-reason">Reason</Label>
            <Input id="m-reason" required maxLength={1000} value={form.reason} onChange={set("reason")} />
          </div>
            </>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              {issued ? "Done" : "Cancel"}
            </Button>
            {!issued && (
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create merchant
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
