import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { isPermissionAllowed, normalizePermissions } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const guard = await requireSuperAdmin(request);
    if ("error" in guard) return guard.error;

    const { rows } = await getPool().query(
      `select id, name, description, dashboards, coalesce(permissions, '{}') as permissions
       from admin_roles order by lower(name)`,
    );
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("Could not list roles:", error);
    return NextResponse.json({ message: "Roles are unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireSuperAdmin(request);
    if ("error" in guard) return guard.error;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const dashboards = Array.isArray(body?.dashboards)
      ? body.dashboards
          .filter((value): value is string => typeof value === "string")
          .filter((value, index, list) => list.indexOf(value) === index)
      : [];
    const permissions = Array.isArray(body?.permissions)
      ? normalizePermissions(
          body.permissions.map((value) => (typeof value === "string" ? value : undefined)),
        )
      : [];

    if (!name || name.length > 120) {
      return NextResponse.json({ message: "Role name is required." }, { status: 422 });
    }
    if (description.length > 500) {
      return NextResponse.json({ message: "Description is too long." }, { status: 422 });
    }
    if (!dashboards.length) {
      return NextResponse.json({ message: "Choose at least one dashboard." }, { status: 422 });
    }
    if (permissions.some((value) => !isPermissionAllowed(value))) {
      return NextResponse.json({ message: "One or more permissions are invalid." }, { status: 422 });
    }

    const { rows } = await getPool().query(
      `insert into admin_roles (name, description, dashboards, permissions)
       values ($1, $2, $3::text[], $4::text[])
       on conflict (lower(name)) do nothing
       returning id`,
      [name, description, dashboards, permissions],
    );

    if (!rows.length) {
      return NextResponse.json({ message: "Role name already exists." }, { status: 409 });
    }

    return NextResponse.json({ message: "Role created." }, { status: 201 });
  } catch (error) {
    console.error("Could not create role:", error);
    return NextResponse.json({ message: "Could not create role." }, { status: 503 });
  }
}
