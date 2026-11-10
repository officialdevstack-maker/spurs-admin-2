import { NextResponse } from "next/server";
import type { PoolClient } from "pg";

import { getPool } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { isDashboardSlug } from "@/lib/dashboard-slugs";
import { canGrant, isPermissionAllowed, normalizePermissions } from "@/lib/permissions";

type RoleAccess = { dashboards: string[]; permissions: string[] };

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    const guard = await requirePermission(request, "roles.manage");
    if ("error" in guard) return guard.error;

    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id." }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as
      | { name?: unknown; description?: unknown; dashboards?: unknown; permissions?: unknown }
      | null;
    const hasName = body?.name !== undefined;
    const hasDescription = body?.description !== undefined;
    const hasDashboards = body?.dashboards !== undefined;
    const hasPermissions = body?.permissions !== undefined;

    if (!hasName && !hasDescription && !hasDashboards && !hasPermissions) {
      return NextResponse.json({ message: "Nothing to update." }, { status: 422 });
    }

    const name = hasName && typeof body?.name === "string" ? body.name.trim() : undefined;
    const description =
      hasDescription && typeof body?.description === "string" ? body.description.trim() : undefined;
    if (hasName && name === undefined) {
      return NextResponse.json({ message: "Invalid role name." }, { status: 422 });
    }
    if (hasDescription && description === undefined) {
      return NextResponse.json({ message: "Invalid description." }, { status: 422 });
    }

    const dashboardValues = Array.isArray(body?.dashboards) ? body.dashboards : [];
    const permissionValues = Array.isArray(body?.permissions) ? body.permissions : [];
    if (hasDashboards && !Array.isArray(body?.dashboards)) {
      return NextResponse.json({ message: "Invalid dashboards." }, { status: 422 });
    }
    if (hasPermissions && !Array.isArray(body?.permissions)) {
      return NextResponse.json({ message: "Invalid permissions." }, { status: 422 });
    }
    if (dashboardValues.some((value) => typeof value !== "string" || !isDashboardSlug(value))) {
      return NextResponse.json({ message: "Unknown dashboard." }, { status: 422 });
    }
    if (
      permissionValues.some(
        (value) => typeof value !== "string" || !isPermissionAllowed(value),
      )
    ) {
      return NextResponse.json({ message: "One or more permissions are invalid." }, { status: 422 });
    }

    const dashboards = hasDashboards
      ? dashboardValues
          .filter((value): value is string => typeof value === "string")
          .filter((value, index, list) => list.indexOf(value) === index)
      : undefined;
    const permissions = hasPermissions
      ? normalizePermissions(
          permissionValues.map((value) => (typeof value === "string" ? value : undefined)),
        )
      : undefined;

    if (name !== undefined && (!name || name.length > 120)) {
      return NextResponse.json({ message: "Role name is required." }, { status: 422 });
    }
    if (description !== undefined && description.length > 500) {
      return NextResponse.json({ message: "Description is too long." }, { status: 422 });
    }
    if (dashboards !== undefined && !dashboards.length) {
      return NextResponse.json({ message: "Choose at least one dashboard." }, { status: 422 });
    }

    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("select pg_advisory_xact_lock(719402, 2)");

    const { rows: existingRoles } = await client.query<
      RoleAccess & { name: string; assigned_to_current_admin: boolean }
    >(
      `select name, dashboards, coalesce(permissions, '{}') as permissions,
              exists (
                select 1 from users where role_id = admin_roles.id and id = $2
              ) as assigned_to_current_admin
       from admin_roles where id = $1`,
      [id, guard.admin.id],
    );
    const existing = existingRoles[0];
    if (!existing) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json({ message: "Role not found." }, { status: 404 });
    }
    if (existing.assigned_to_current_admin) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json(
        { message: "You can't edit the role assigned to your account." },
        { status: 403 },
      );
    }
    if (existing.name.toLowerCase() === "super admin") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json(
        { message: "The Super Admin role cannot be edited." },
        { status: 403 },
      );
    }
    if (!canGrant(guard.admin, existing)) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json(
        { message: "You can't edit a role with more access than you have." },
        { status: 403 },
      );
    }

    const nextAccess = {
      dashboards: dashboards ?? existing.dashboards,
      permissions: permissions ?? existing.permissions,
    };
    if (!canGrant(guard.admin, nextAccess)) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return NextResponse.json(
        { message: "You can't grant access you don't have." },
        { status: 403 },
      );
    }

    if (
      existing.permissions.includes("*") &&
      !nextAccess.permissions.includes("*")
    ) {
      const { rows } = await client.query<{
        has_active_super: boolean;
        has_other_active_super: boolean;
      }>(
        `select
           exists (
             select 1 from users u
             where u.role_id = $1 and u.is_admin and u.admin_suspended_at is null
           ) as has_active_super,
           exists (
             select 1 from users u join admin_roles r on r.id = u.role_id
             where r.id <> $1 and u.is_admin and u.admin_suspended_at is null
               and r.permissions @> '{*}'
           ) as has_other_active_super`,
        [id],
      );
      if (rows[0].has_active_super && !rows[0].has_other_active_super) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return NextResponse.json(
          { message: "This would leave no active super admin." },
          { status: 409 },
        );
      }
    }

    await client.query(
      `update admin_roles set
         name = coalesce($2, name),
         description = coalesce($3, description),
         dashboards = coalesce($4::text[], dashboards),
         permissions = coalesce($5::text[], permissions)
       where id = $1`,
      [id, name ?? null, description ?? null, dashboards ?? null, permissions ?? null],
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return NextResponse.json({ message: "Role updated." });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Could not roll back role update:", rollbackError);
      }
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ message: "Role name already exists." }, { status: 409 });
    }
    console.error("Could not update role:", error);
    return NextResponse.json({ message: "Update failed." }, { status: 503 });
  } finally {
    client?.release();
  }
}
