import { SignJWT } from "jose";
import { cookies } from "next/headers";

import { getPool } from "@/lib/db";
import {
  getSessionKey,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "@/lib/session-token";

export type SessionUser = { id: number; email: string; name: string };

export async function createSession(id: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getAdmin(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload?.sub || !/^[1-9]\d*$/.test(payload.sub)) return null;
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id)) return null;

  const { rows } = await getPool().query<{
    id: number;
    fullname: string;
    email: string;
  }>(
    `select id, fullname, email from users
     where id = $1 and is_admin = true and suspended_at is null`,
    [id],
  );
  const user = rows[0];
  return user ? { id: Number(user.id), email: user.email, name: user.fullname } : null;
}
