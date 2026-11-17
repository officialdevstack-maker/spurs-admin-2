import "server-only";

import { createPayAdminAssertion } from "@/lib/pay-admin-assertion";
import type { SessionUser } from "@/lib/session";

function getBaseUrl() {
  const value = process.env.PAY_API_URL;
  if (!value) throw new Error("PAY_API_URL is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PAY_API_URL must use HTTP or HTTPS");
  }
  return new URL(url.origin);
}

export async function payFetch(
  path: string,
  admin: SessionUser,
  request: Request,
  init: { method?: "GET" | "POST"; body?: unknown; reason?: string; requestId?: string } = {},
) {
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${await createPayAdminAssertion(admin, request)}`,
  });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.reason) headers.set("x-admin-audit-reason", init.reason);
  if (init.requestId) headers.set("x-admin-request-id", init.requestId);
  const target = new URL(path, getBaseUrl());
  return fetch(target, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}
