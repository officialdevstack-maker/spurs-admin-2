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

    const body = (await request.json().catch(() => null)) as
      | { name?: unknown; description?: unknown; dashboards?: unknown }
      | null;
    const hasName = body?.name !== undefined;
    const hasDescription = body?.description !== undefined;
    const hasDashboards = body?.dashboards !== undefined;

    if (!hasName && !hasDescription && !hasDashboards) {
      return NextResponse.json({ message: "Nothing to update." }, { status: 422 });
    }

    const name = hasName && typeof body?.name === "string" ? body.name.trim() : undefined;
    const description =
      hasDescription && typeof body?.description === "string" ? body.description.trim() : undefined;
    const dashboards =
      hasDashboards && Array.isArray(body?.dashboards)
        ? body.dashboards
            .filter((value): value is string => typeof value === "string")
            .filter((value, index, list) => list.indexOf(value) === index)
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

    const { rowCount } = await getPool().query(
      `update admin_roles set
         name = coalesce($2, name),
         description = coalesce($3, description),
         dashboards = coalesce($4::text[], dashboards)
       where id = $1`,
      [id, name ?? null, description ?? null, dashboards ?? null],
    );

    if (!rowCount) {
      return NextResponse.json({ message: "Role not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Role updated." });
  } catch (error) {
    console.error("Could not update role:", error);
    return NextResponse.json({ message: "Update failed." }, { status: 503 });
  }
}
