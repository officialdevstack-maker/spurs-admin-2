"use client";

import * as React from "react";
import Link from "next/link";

import { listPayCheckouts, type PayCheckout, type PayListQuery } from "@/lib/pay-api";
import { formatDateTime } from "@/lib/format";

function formatAmount(amount: string, currency: string) {
  if (currency !== "NGN" || !/^\d+$/.test(amount)) return `${amount} ${currency}`;
  const whole = amount.slice(0, -2) || "0";
  const kobo = amount.slice(-2).padStart(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
}

export default function PayCheckoutsPage() {
  const [draft, setDraft] = React.useState({
    status: "",
    merchant: "",
    from: "",
    to: "",
    reference: "",
  });
  const [filters, setFilters] = React.useState<PayListQuery>({});
  const [cursorStack, setCursorStack] = React.useState<(string | null)[]>([null]);
  const [result, setResult] = React.useState<{
    key: string;
    rows?: PayCheckout[];
    nextCursor?: string | null;
    error?: string;
  } | null>(null);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;
  const query = { ...filters, ...(cursor ? { cursor } : {}) };
  const key = JSON.stringify(query);

  React.useEffect(() => {
    let active = true;
    listPayCheckouts(query)
      .then((response) => {
        if (active) setResult({ key, rows: response.data, nextCursor: response.nextCursor });
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
  }, [key]);

  const current = result?.key === key ? result : null;

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({
      status: draft.status || undefined,
      merchant: draft.merchant.trim() || undefined,
      from: draft.from || undefined,
      to: draft.to || undefined,
      reference: draft.reference.trim() || undefined,
    });
    setCursorStack([null]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay checkouts</h2>
        <p className="text-sm text-muted-foreground">
          Search checkout sessions by status, merchant, date, and reference.
        </p>
      </div>

      <form onSubmit={applyFilters} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-6">
        <select
          aria-label="Checkout status"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value })}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <input
          aria-label="Merchant"
          placeholder="Merchant"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={draft.merchant}
          onChange={(event) => setDraft({ ...draft, merchant: event.target.value })}
        />
        <input
          aria-label="From date"
          type="date"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={draft.from}
          onChange={(event) => setDraft({ ...draft, from: event.target.value })}
        />
        <input
          aria-label="To date"
          type="date"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={draft.to}
          onChange={(event) => setDraft({ ...draft, to: event.target.value })}
        />
        <input
          aria-label="Checkout reference"
          placeholder="Reference"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={draft.reference}
          onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Apply filters
        </button>
      </form>

      {current?.error && <p role="alert" className="text-sm text-destructive">{current.error}</p>}
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
            {!current ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Loading checkouts…</td></tr>
            ) : current.error ? (
              <tr><td className="px-4 py-8 text-center text-destructive" colSpan={5}>Checkouts could not be loaded.</td></tr>
            ) : current.rows?.length ? (
              current.rows.map((checkout) => (
                <tr key={checkout.reference}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      href={`/pay/checkouts/${encodeURIComponent(checkout.reference)}`}
                    >
                      {checkout.reference}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {checkout.description ?? checkout.merchantReference}
                    </p>
                  </td>
                  <td className="px-4 py-3">{checkout.merchantName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatAmount(checkout.amount, checkout.currency)}
                  </td>
                  <td className="px-4 py-3 capitalize">{checkout.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(checkout.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>No checkouts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          disabled={cursorStack.length <= 1}
          onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
        >
          Previous page
        </button>
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          disabled={!current?.nextCursor}
          onClick={() => {
            if (current?.nextCursor) setCursorStack((stack) => [...stack, current.nextCursor!]);
          }}
        >
          Next page
        </button>
      </div>
    </div>
  );
}
