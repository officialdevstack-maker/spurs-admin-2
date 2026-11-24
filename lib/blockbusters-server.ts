import "server-only";

import { randomUUID } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";

import type { SessionUser } from "@/lib/session";

let signingKey: ReturnType<typeof importPKCS8> | undefined;

async function getSigningKey() {
  const pem = process.env.BLOCKBUSTERS_ADMIN_IDENTITY_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!pem) throw new Error("BLOCKBUSTERS_ADMIN_IDENTITY_PRIVATE_KEY is not configured.");
  signingKey ??= importPKCS8(pem, "RS256");
  return signingKey;
}

function requestIp(request: Request) {
  const value =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return value.slice(0, 128);
}

async function createAssertion(admin: SessionUser, request: Request, requestId: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    actor_id: admin.id,
    permissions: admin.permissions,
    ip: requestIp(request),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer("admin-2")
    .setAudience("blockbusters")
    .setSubject(admin.email)
    .setJti(requestId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(await getSigningKey());
}

function getBaseUrl() {
  const value = process.env.BLOCKBUSTERS_API_URL;
  if (!value) throw new Error("BLOCKBUSTERS_API_URL is not configured.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("BLOCKBUSTERS_API_URL must use HTTP or HTTPS.");
  }
  return new URL(url.origin);
}

export async function blockbustersFetch(
  path: string,
  admin: SessionUser,
  request: Request,
  init: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    reason?: string;
    requestId?: string;
  } = {},
) {
  const requestId = init.requestId ?? randomUUID();
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${await createAssertion(admin, request, requestId)}`,
  });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.reason) headers.set("x-admin-audit-reason", init.reason);
  if (init.method && init.method !== "GET") headers.set("x-admin-request-id", requestId);
  return fetch(new URL(path, getBaseUrl()), {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}
