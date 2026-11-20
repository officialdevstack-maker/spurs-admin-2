import "server-only";

import { insertAdminAudit } from "@/lib/admin-audit";
import { getPool } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export async function auditAccountsOidcClient(input: {
  admin: SessionUser;
  request: Request;
  action: "created" | "updated" | "deactivated";
  clientId: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const client = await getPool().connect();
  try {
    await insertAdminAudit(client, {
      admin: input.admin,
      request: input.request,
      action: `accounts.oidc_client.${input.action}`,
      resource: `accounts.oidc_client:${input.clientId}`,
      reason: input.reason,
      before: input.before,
      after: input.after,
    });
  } finally {
    client.release();
  }
}
