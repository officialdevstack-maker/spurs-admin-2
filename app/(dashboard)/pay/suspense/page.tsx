"use client";

import * as React from "react";

import { listPaySuspense, type PaySuspenseEntry } from "@/lib/pay-api";
import { formatDateTime } from "@/lib/format";

function formatAmount(amount: string, currency: string) {
  if (currency !== "NGN" || !/^\d+$/.test(amount)) return `${amount} ${currency}`;
  const whole = amount.slice(0, -2) || "0";
  const kobo = amount.slice(-2).padStart(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
}

export default function PaySuspensePage() {
  const [cursorStack, setCursorStack] = React.useState<(string | null)[]>([null]);
  const [result, setResult] = React.useState<{
    key: string;
    rows?: PaySuspenseEntry[];
    nextCursor?: string | null;
    error?: string;
  } | null>(null);
  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  React.useEffect(() => {
    let active = true;
    const key = cursor ?? "first";
    listPaySuspense({ cursor: cursor ?? undefined })
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
  }, [cursor]);

  const current = result?.key === (cursor ?? "first") ? result : null;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay suspense entries</h2>
        <p className="text-sm text-muted-foreground">Read-only ledger entries posted to the suspense account.</p>
      </div>
      {current?.error && <p role="alert" className="text-sm text-destructive">{current.error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Transaction</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!current ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Loading entries…</td></tr>
            ) : current.error ? (
              <tr><td className="px-4 py-8 text-center text-destructive" colSpan={5}>Entries could not be loaded.</td></tr>
            ) : current.rows?.length ? current.rows.map((entry) => (
              <tr key={`${entry.reference}-${entry.direction}-${entry.createdAt}`}>
                <td className="px-4 py-3 font-medium">{entry.reference}</td>
                <td className="px-4 py-3">{entry.type}</td>
                <td className="px-4 py-3 capitalize">{entry.direction}</td>
                <td className="px-4 py-3 tabular-nums">{formatAmount(entry.amount, entry.currency)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(entry.createdAt)}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>No suspense entries found.</td></tr>
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
