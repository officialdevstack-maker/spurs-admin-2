import { createHmac, timingSafeEqual } from "node:crypto";

export const PANEL_SESSION_COOKIE = "spurs_admin_session";
export const PANEL_SESSION_MAX_AGE = 60 * 60 * 12;

export type PanelSession = { email: string; exp: number };

export function getPanelCredentials() {
  const email = process.env.PANEL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PANEL_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("PANEL_ADMIN_EMAIL and PANEL_ADMIN_PASSWORD must be configured");
  }
  return { email, password };
}

function getSessionSecret() {
  const secret = process.env.PANEL_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("PANEL_SESSION_SECRET must be at least 32 bytes");
  }
  return secret;
}

export function createPanelSession(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + PANEL_SESSION_MAX_AGE }),
  ).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPanelSession(value: string | undefined): PanelSession | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PanelSession;
    if (
      typeof session.email !== "string" ||
      typeof session.exp !== "number" ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
