import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";

export async function GET(request: Request) {
  try {
    const guard = await requireSuperAdmin(request);
    if ("error" in guard) return guard.error;

    const { rows } = await getPool().query(
      `select id, name, description, dashboards from admin_roles order by lower(name)`,
    );
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("Could not list roles:", error);
    return NextResponse.json({ message: "Roles are unavailable." }, { status: 503 });
  }
}
