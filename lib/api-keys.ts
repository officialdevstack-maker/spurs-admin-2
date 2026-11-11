import "server-only";

import { createHash } from "node:crypto";

import { getPool } from "@/lib/db";

export const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

export type ApiClient = { id: number; name: string };

export async function authenticateApiKey(request: Request): Promise<ApiClient | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer (spk_[A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) return null;

  const { rows } = await getPool().query<ApiClient>(
    `update api_keys set last_used_at = now()
     where key_hash = $1 and revoked_at is null
     returning id, name`,
    [hashApiKey(match[1])],
  );
  return rows[0] ?? null;
}
