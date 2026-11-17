"use client";

import * as React from "react";
import Link from "next/link";

import { getPayCheckout, type PayCheckoutDetail } from "@/lib/pay-api";
import { formatDateTime } from "@/lib/format";

function formatAmount(amount: string, currency: string) {
  if (currency !== "NGN" || !/^\d+$/.test(amount)) return `${amount} ${currency}`;
  const whole = amount.slice(0, -2) || "0";
  const kobo = amount.slice(-2).padStart(2, "0");
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${kobo}`;
}

export default function CheckoutDetail({ reference }: { reference: string }) {
  const [detail, setDetail] = React.useState<PayCheckoutDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getPayCheckout(reference)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Something went wrong.");
      });
    return () => {
      active = false;
    };
  }, [reference]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!detail) return <p className="text-sm text-muted-foreground">Loading checkout…</p>;

  const { session, attempts, transaction, timeline } = detail;
  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-muted-foreground hover:underline" href="/pay/checkouts">
          ← Checkouts
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{session.reference}</h2>
        <p className="text-sm text-muted-foreground">{session.merchantName}</p>
      </div>

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Status</p><p className="capitalize">{session.status}</p></div>
        <div><p className="text-xs text-muted-foreground">Amount</p><p>{formatAmount(session.amount, session.currency)}</p></div>
        <div><p className="text-xs text-muted-foreground">Merchant reference</p><p>{session.merchantReference}</p></div>
        <div><p className="text-xs text-muted-foreground">Description</p><p>{session.description ?? "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Created</p><p>{formatDateTime(session.createdAt)}</p></div>
        <div><p className="text-xs text-muted-foreground">Expires</p><p>{formatDateTime(session.expiresAt)}</p></div>
        <div><p className="text-xs text-muted-foreground">Paid</p><p>{formatDateTime(session.paidAt)}</p></div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Attempts and methods</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Started</th><th className="px-4 py-3 font-medium">Resolved</th></tr>
            </thead>
            <tbody className="divide-y">
              {attempts.length ? attempts.map((attempt, index) => (
                <tr key={`${attempt.createdAt}-${index}`}>
                  <td className="px-4 py-3 capitalize">{attempt.method.replace("_", " ")}</td>
                  <td className="px-4 py-3 capitalize">{attempt.status}</td>
                  <td className="px-4 py-3">{formatDateTime(attempt.createdAt)}</td>
                  <td className="px-4 py-3">{formatDateTime(attempt.resolvedAt)}</td>
                </tr>
              )) : <tr><td className="px-4 py-5 text-muted-foreground" colSpan={4}>No attempts recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Ledger transaction</h3>
        {transaction ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Reference:</span> {transaction.reference}
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">Type:</span> {transaction.type}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="py-2 font-medium">Account</th><th className="py-2 font-medium">Direction</th><th className="py-2 font-medium">Amount</th><th className="py-2 font-medium">Posted</th></tr>
                </thead>
                <tbody className="divide-y">
                  {transaction.entries.map((entry, index) => (
                    <tr key={`${entry.createdAt}-${index}`}>
                      <td className="py-2">{entry.accountCode ?? entry.accountKind}</td>
                      <td className="py-2 capitalize">{entry.direction}</td>
                      <td className="py-2 tabular-nums">{formatAmount(entry.amount, transaction.currency)}</td>
                      <td className="py-2">{formatDateTime(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">No ledger transaction is linked.</p>}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Timeline</h3>
        <ol className="space-y-3 border-l pl-4">
          {timeline.map((event, index) => (
            <li key={`${event.type}-${event.at}-${index}`} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
              <p className="text-sm capitalize">{event.type.replaceAll("_", " ")}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(event.at)}
                {event.method ? ` · ${event.method.replace("_", " ")}` : ""}
                {event.status ? ` · ${event.status}` : ""}
                {event.direction ? ` · ${event.direction} ${event.amount ?? ""}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
