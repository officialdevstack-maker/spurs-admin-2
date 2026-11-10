import { NextResponse } from "next/server";
import type { PoolClient } from "pg";

import { getPool } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { canGrant, isSuperAdmin } from "@/lib/permissions";

type RoleAccess = { dashboards: string[]; permissions: string[] };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    const guard = await requirePermission(request, "admins.manage");
    if ("error" in guard) return guard.error;

    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id." }, { status: 404 });
    }
    if (id === guard.admin.id) {
      return NextResponse.json(
        { message: "You can't change your own role or status." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { roleId?: unknown; suspended?: unknown }
      | null;
    const hasRole = body?.roleId !== undefined;
    const hasSuspend = typeof body?.suspended === "boolean";
    if (!hasRole && !hasSuspend) {
      return NextResponse.json({ message: "Nothing to update." }, { status: 422 });
    }

    const roleId = hasRole ? Number(body!.roleId) : null;
    if (hasRole && (!Number.isInteger(roleId) || (roleId as number) < 1)) {
      return NextResponse.json({ message: "Invalid role." }, { status: 422 });
    }

    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("select pg_advisory_xact_lock(719402, 2)");

    const { rows: targetRows } = await client.query<
      RoleAccess & { admin_suspended_at: Date | null }
    >(
      `select u.admin_suspended_at,
              coalesce(r.dashboards, '{}') as dashboards,
              coalesce(r.permissions, '{}') as permissions
       from users u left join admin_roles r on r.id = u.role_id
       where u.id = $1 and u.is_admin = true`,
      [id],
    );
    const target = targetRows[0];
    if (!target) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json({ message: "Admin not found." }, { status: 404 });
    }
    if (!canGrant(guard.admin, target)) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json(
        { message: "You can't modify an admin with more access than you have." },
        { status: 403 },
      );
    }

    let nextAccess: RoleAccess = target;
    if (hasRole) {
      const { rows } = await client.query<RoleAccess>(
        `select dashboards, coalesce(permissions, '{}') as permissions
         from admin_roles where id = $1`,
        [roleId],
      );
      if (!rows.length) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return NextResponse.json({ message: "Admin or role not found." }, { status: 404 });
      }
      if (!canGrant(guard.admin, rows[0])) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return NextResponse.json(
          { message: "You can't assign a role with more access than you have." },
          { status: 403 },
        );
      }
      nextAccess = rows[0];
    }

    const wasActiveSuper =
      !target.admin_suspended_at && isSuperAdmin(target.permissions);
    const willBeActive = hasSuspend ? body?.suspended !== true : !target.admin_suspended_at;
    const willBeSuper = isSuperAdmin(nextAccess.permissions);
    if (wasActiveSuper && !(willBeActive && willBeSuper)) {
      const { rows } = await client.query<{ count: number }>(
        `select count(*)::int as count
         from users u join admin_roles r on r.id = u.role_id
         where u.is_admin and u.admin_suspended_at is null
           and u.id <> $1 and r.permissions @> '{*}'`,
        [id],
      );
      if (rows[0].count === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return NextResponse.json(
          { message: "This would leave no active super admin." },
          { status: 409 },
        );
      }
    }

    await client.query(
      `update users set
         role_id = case when $2::boolean then $3::int else role_id end,
         admin_suspended_at = case
           when $4::boolean then (case when $5::boolean then now() else null end)
           else admin_suspended_at end,
         updated_at = now()
       where id = $1`,
      [id, hasRole, roleId, hasSuspend, body?.suspended === true],
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return NextResponse.json({ message: "Updated." });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back admin update:", rollbackError);
      }
    }
    console.error("Could not update admin:", error);
    return NextResponse.json({ message: "Update failed." }, { status: 503 });
  } finally {
    client?.release();
  }
}
