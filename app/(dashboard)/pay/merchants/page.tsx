"use client";

import * as React from "react";

import { listPayMerchants, type PayMerchant } from "@/lib/pay-api";
import { formatDateTime } from "@/lib/format";

function formatAmount(amount: string) {
  if (!/^\d+$/.test(amount)) return `${amount} NGN`;
  const whole = amount.slice(0, -2) || "0";
  const kobo = amount.slice(-2).padStart(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
}

export default function PayMerchantsPage() {
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [result, setResult] = React.useState<{
    key: string;
    rows?: PayMerchant[];
    error?: string;
  } | null>(null);
  const key = `${status}\u0000${search}`;

  React.useEffect(() => {
    let active = true;
    listPayMerchants({ status: status || undefined, search: search.trim() || undefined })
      .then((response) => {
        if (active) setResult({ key, rows: response.data });
      })
      .catch((cause: unknown) => {
        if (active) {
          setResult({
            key,
            error: cause instanceof Error ? cause.message : "Something went wrong.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [status, search, key]);

  const current = result?.key === key ? result : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay merchants</h2>
        <p className="text-sm text-muted-foreground">Merchant status and checkout volume.</p>
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
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {current?.error && <p role="alert" className="text-sm text-destructive">{current.error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Checkouts</th>
              <th className="px-4 py-3 font-medium">Paid checkouts</th>
              <th className="px-4 py-3 font-medium">Paid volume</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!current ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Loading merchants…</td></tr>
            ) : current.error ? (
              <tr><td className="px-4 py-8 text-center text-destructive" colSpan={6}>Merchants could not be loaded.</td></tr>
            ) : current.rows?.length ? current.rows.map((merchant) => (
              <tr key={merchant.id}>
                <td className="px-4 py-3 font-medium">{merchant.name}</td>
                <td className="px-4 py-3 capitalize">{merchant.status}</td>
                <td className="px-4 py-3 tabular-nums">{merchant.checkoutCount.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums">{merchant.paidCheckoutCount.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums">{formatAmount(merchant.paidVolume)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(merchant.createdAt)}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No merchants found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
