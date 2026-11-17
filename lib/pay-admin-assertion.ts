import "server-only";

import { randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

import type { SessionUser } from "@/lib/session";

let signingKey: ReturnType<typeof importPKCS8> | undefined;

async function getSigningKey() {
  const pem = process.env.PAY_ADMIN_IDENTITY_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!pem) throw new Error("PAY_ADMIN_IDENTITY_PRIVATE_KEY is not configured.");
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

export async function createPayAdminAssertion(admin: SessionUser, request: Request) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    actor_id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: admin.permissions,
    auth_time: Math.floor(admin.authTime.getTime() / 1000),
    ip: requestIp(request),
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer("admin-2")
    .setAudience("spurs-pay")
    .setSubject(String(admin.id))
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(await getSigningKey());
}
