import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { getAdmin } from "@/lib/session";



export async function POST(request: Request) {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
    }

    let body: { current?: unknown; next?: unknown } | null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const current = typeof body?.current === "string" ? body.current : "";
    const next = typeof body?.next === "string" ? body.next : "";
    if (next.length < 8) {
      return NextResponse.json(
        { message: "New password must be at least 8 characters." },
        { status: 422 },
      );
    }
    if (Buffer.byteLength(next, "utf8") > 72) {
      return NextResponse.json(
        { message: "New password must be no more than 72 bytes." },
        { status: 422 },
      );
    }

    const pool = getPool();
    const { rows } = await pool.query<{ password: string }>(
      `select password from users
       where id = $1 and is_admin = true and suspended_at is null`,
      [admin.id],
    );
    const currentHash = rows[0]?.password;
    if (!currentHash || !(await bcrypt.compare(current, currentHash))) {
      return NextResponse.json(
        { message: "Current password is incorrect." },
        { status: 422 },
      );
    }

    const nextHash = await bcrypt.hash(next, 12);
    const result = await pool.query(
      `update users set password = $1, updated_at = now()
       where id = $2 and password = $3
         and is_admin = true and suspended_at is null
       returning id`,
      [nextHash, admin.id, currentHash],
    );
    if (result.rowCount !== 1) {
      return NextResponse.json(
        { message: "Password or admin status changed. Please try again." },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: "Password changed." });
  } catch (error) {
    console.error("Could not change admin password:", error);
    return NextResponse.json(
      { message: "Password change is temporarily unavailable." },
      { status: 503 },
    );
  }
}
