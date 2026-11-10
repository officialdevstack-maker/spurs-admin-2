import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";

export async function GET(request: Request) {
  try {
    const guard = await requirePermission(request, "admins.manage");
    if ("error" in guard) return guard.error;

    const { rows } = await getPool().query(
      `select u.id, u.fullname, u.email, u.suspended_at as "suspendedAt",
              u.role_id as "roleId", r.name as "roleName"
       from users u left join admin_roles r on r.id = u.role_id
       where u.is_admin = true order by u.id`,
    );
    return NextResponse.json({ data: rows, currentId: guard.admin.id });
  } catch (error) {
    console.error("Could not list admins:", error);
    return NextResponse.json({ message: "Admin users are unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requirePermission(request, "admins.manage");
    if ("error" in guard) return guard.error;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const fullname = typeof body?.fullname === "string" ? body.fullname.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const roleId = Number(body?.roleId);

    if (!fullname || fullname.length > 120) {
      return NextResponse.json({ message: "Full name is required." }, { status: 422 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Enter a valid email." }, { status: 422 });
    }
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      return NextResponse.json(
        { message: "Password must be 12+ characters and at most 72 bytes." },
        { status: 422 },
      );
    }
    if (!Number.isInteger(roleId) || roleId < 1) {
      return NextResponse.json({ message: "Choose a role." }, { status: 422 });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await getPool().query(
      `insert into users (fullname, email, password, is_admin, role_id)
       select $1, $2, $3, true, r.id from admin_roles r where r.id = $4
       on conflict do nothing
       returning id`,
      [fullname, email, hash, roleId],
    );
    if (!rows.length) {
      return NextResponse.json(
        { message: "Email already exists or role not found." },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: "Admin created." }, { status: 201 });
  } catch (error) {
    console.error("Could not create admin:", error);
    return NextResponse.json({ message: "Could not create admin." }, { status: 503 });
  }
}
