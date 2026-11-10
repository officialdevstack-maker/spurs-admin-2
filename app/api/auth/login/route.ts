import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";
import { createSession } from "@/lib/session";


const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const failures = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254) {
    return NextResponse.json(
      { message: "Email and password are required." },
      { status: 422 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const key = `${ip}:${email}`;
  const current = failures.get(key);
  if (current && current.resetAt > Date.now() && current.count >= MAX_FAILURES) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  try {
    const { rows } = await getPool().query<{
      id: number;
      fullname: string;
      email: string;
      password: string;
      is_admin: boolean;
      suspended_at: Date | null;
      role_name: string | null;
      dashboards: string[] | null;
      permissions: string[] | null;
    }>(
      `select u.id, u.fullname, u.email, u.password, u.is_admin, u.suspended_at,
              r.name as role_name,
              coalesce(r.dashboards, '{}') as dashboards,
              coalesce(r.permissions, '{}') as permissions
       from users u
       left join admin_roles r on r.id = u.role_id
       where lower(u.email) = $1`,
      [email],
    );
    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !passwordMatches || !user.is_admin || user.suspended_at) {
      const state =
        current && current.resetAt > Date.now()
          ? current
          : { count: 0, resetAt: Date.now() + FAILURE_WINDOW_MS };
      failures.set(key, { count: state.count + 1, resetAt: state.resetAt });
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    failures.delete(key);
    await createSession(Number(user.id));
    return NextResponse.json({
      user: {
        email: user.email,
        name: user.fullname,
        role: user.role_name,
        dashboards: user.dashboards ?? [],
        permissions: user.permissions ?? [],
      },
    });
  } catch (error) {
    console.error("Admin login is unavailable:", error);
    return NextResponse.json(
      { message: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
