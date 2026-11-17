import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { expectedOrigin } from "@/lib/origin";
import { getAdmin, createSession } from "@/lib/session";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const failures = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== expectedOrigin(request)) {
      return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    }

    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }

    let body: { password?: unknown } | null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const password = typeof body?.password === "string" ? body.password : "";
    const key = `${admin.id}:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"}`;
    const current = failures.get(key);
    if (current && current.resetAt > Date.now() && current.count >= MAX_FAILURES) {
      return NextResponse.json(
        { message: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    const { rows } = await getPool().query<{ password: string }>(
      `select password from users
       where id = $1 and is_admin = true and admin_suspended_at is null`,
      [admin.id],
    );
    if (!(await bcrypt.compare(password, rows[0]?.password ?? DUMMY_HASH))) {
      const state =
        current && current.resetAt > Date.now()
          ? current
          : { count: 0, resetAt: Date.now() + FAILURE_WINDOW_MS };
      failures.set(key, { count: state.count + 1, resetAt: state.resetAt });
      return NextResponse.json({ message: "Password is incorrect." }, { status: 401 });
    }

    failures.delete(key);
    await createSession(admin.id);
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    return NextResponse.json({ returnTo });
  } catch (error) {
    console.error("Could not verify admin password for step-up:", error);
    return NextResponse.json(
      { message: "Re-authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
