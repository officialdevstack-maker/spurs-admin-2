import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireSuperAdmin(request);
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

    const { rowCount } = await getPool().query(
      `update users set
         role_id = case when $2::boolean then $3::int else role_id end,
         suspended_at = case
           when $4::boolean then (case when $5::boolean then now() else null end)
           else suspended_at end,
         updated_at = now()
       where id = $1 and is_admin = true
         and (not $2::boolean or exists (select 1 from admin_roles where id = $3::int))`,
      [id, hasRole, roleId, hasSuspend, body?.suspended === true],
    );
    if (!rowCount) {
      return NextResponse.json({ message: "Admin or role not found." }, { status: 404 });
    }
    return NextResponse.json({ message: "Updated." });
  } catch (error) {
    console.error("Could not update admin:", error);
    return NextResponse.json({ message: "Update failed." }, { status: 503 });
  }
}
