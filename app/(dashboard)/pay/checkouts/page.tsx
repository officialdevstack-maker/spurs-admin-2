"use client";

import * as React from "react";

import { listPayCheckouts, type PayCheckout } from "@/lib/pay-api";
import { formatDateTime } from "@/lib/format";

type CheckoutFilter = "all" | PayCheckout["status"];

function formatAmount(checkout: PayCheckout) {
  if (checkout.currency !== "NGN") return `${checkout.amount} ${checkout.currency}`;
  if (!/^\d+$/.test(checkout.amount)) return `${checkout.amount} ${checkout.currency}`;
  const whole = checkout.amount.slice(0, -2) || "0";
  const kobo = checkout.amount.slice(-2).padStart(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
}

export default function PayCheckoutsPage() {
  const [status, setStatus] = React.useState<CheckoutFilter>("all");
  const [response, setResponse] = React.useState<{
    status: CheckoutFilter;
    rows?: PayCheckout[];
    error?: string;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    listPayCheckouts(status === "all" ? undefined : status)
      .then((result) => {
        if (active) setResponse({ status, rows: result.data });
      })
      .catch((cause: unknown) => {
        if (active) {
          setResponse({
            status,
            error: cause instanceof Error ? cause.message : "Something went wrong.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [status]);

  const current = response?.status === status ? response : null;
  const rows = current?.rows ?? null;
  const error = current?.error ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pay checkouts</h2>
          <p className="text-sm text-muted-foreground">
            Read-only view of recent checkout sessions.
          </p>
        </div>
        <select
          aria-label="Checkout status"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as CheckoutFilter)}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Checkout</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows === null && !error ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Loading checkouts…</td></tr>
            ) : error ? (
              <tr><td className="px-4 py-8 text-center text-destructive" colSpan={5}>Checkouts could not be loaded.</td></tr>
            ) : rows && rows.length ? (
              rows.map((checkout) => (
                <tr key={checkout.reference}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{checkout.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {checkout.description ?? checkout.merchantReference}
                    </p>
                  </td>
                  <td className="px-4 py-3">{checkout.merchantName}</td>
                  <td className="px-4 py-3 tabular-nums">{formatAmount(checkout)}</td>
                  <td className="px-4 py-3 capitalize">{checkout.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(checkout.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                  No checkouts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
