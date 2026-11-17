"use client";

import * as React from "react";

import { listPayWebhooks, type PayWebhookEvent } from "@/lib/pay-api";
import { formatDateTime } from "@/lib/format";

export default function PayWebhooksPage() {
  const [status, setStatus] = React.useState("");
  const [rows, setRows] = React.useState<PayWebhookEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setRows(null);
    setError(null);
    listPayWebhooks({ status: status || undefined })
      .then((result) => {
        if (active) setRows(result.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Something went wrong.");
      });
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pay webhook events</h2>
        <p className="text-sm text-muted-foreground">Delivery processing status and sanitized errors.</p>
      </div>
      <select
        aria-label="Webhook status"
        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">All statuses</option>
        <option value="received">Received</option>
        <option value="processed">Processed</option>
        <option value="failed">Failed</option>
      </select>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Last error</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Processed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows === null && !error ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Loading events…</td></tr>
            ) : error ? (
              <tr><td className="px-4 py-8 text-center text-destructive" colSpan={6}>Webhook events could not be loaded.</td></tr>
            ) : rows?.length ? rows.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{event.type}</p>
                  <p className="text-xs text-muted-foreground">{event.id}</p>
                </td>
                <td className="px-4 py-3 capitalize">{event.status}</td>
                <td className="px-4 py-3 tabular-nums">{event.attempts}</td>
                <td className="max-w-sm px-4 py-3 text-muted-foreground">{event.lastError ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(event.receivedAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(event.processedAt)}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No webhook events found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
