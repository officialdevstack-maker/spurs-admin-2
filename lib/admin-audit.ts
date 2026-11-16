import "server-only";

import type { PoolClient } from "pg";

import type { SessionUser } from "@/lib/session";

export type AdminAuditValues = Record<string, unknown> | null;

export function requestIp(request: Request) {
  const value =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return value.slice(0, 128);
}

export async function insertAdminAudit(
  client: PoolClient,
  input: {
    admin: SessionUser;
    request: Request;
    action: string;
    resource: string;
    reason: string;
    before: AdminAuditValues;
    after: AdminAuditValues;
  },
) {
  await client.query(
    `insert into admin_audit_log
       (actor_user_id, actor_accounts_sub, actor_email, action, resource,
        ip_address, before_values, after_values, reason)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)`,
    [
      input.admin.id,
      input.admin.accountsSub,
      input.admin.email,
      input.action,
      input.resource,
      requestIp(input.request),
      input.before === null ? null : JSON.stringify(input.before),
      input.after === null ? null : JSON.stringify(input.after),
      input.reason,
    ],
  );
}
