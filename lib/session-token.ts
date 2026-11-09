import { jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function verifySessionToken(token: string): Promise<JWTPayload | null> {
  const key = getSessionKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}
