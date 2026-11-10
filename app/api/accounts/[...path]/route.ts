import { NextRequest, NextResponse } from "next/server";

import { accountsFetch } from "@/lib/accounts-server";
import { getAdmin, type SessionUser } from "@/lib/session";

type Rule = { method: "GET" | "POST"; pattern: RegExp };

// Client paths (relative to /api/accounts) the panel is allowed to call.
const ALLOWED: Rule[] = [
  { method: "GET", pattern: /^stats\/users$/ },
  { method: "GET", pattern: /^stats\/active-users-chart$/ },
  { method: "GET", pattern: /^settings$/ },
  { method: "POST", pattern: /^settings$/ },
  { method: "GET", pattern: /^users$/ },
  { method: "GET", pattern: /^users\/\d+$/ },
  {
    method: "POST",
    pattern: /^users\/\d+\/(suspend|unsuspend|revoke-sessions|verify-email)$/,
  },
];

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  let admin: SessionUser;
  try {
    const currentAdmin = await getAdmin();
    if (!currentAdmin) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }
    admin = currentAdmin;
  } catch (error) {
    console.error("Accounts proxy authentication is unavailable:", error);
    return NextResponse.json(
      { message: "Panel authentication is temporarily unavailable." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const subpath = path.join("/");
  const allowed = ALLOWED.some(
    (rule) => rule.method === request.method && rule.pattern.test(subpath),
  );
  if (!allowed) {
    return NextResponse.json(
      { message: `Panel proxy: ${request.method} /${subpath} is not allowed.` },
      { status: 404 },
    );
  }

  if (request.method === "POST" && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  try {
    const target = subpath.startsWith("stats/")
      ? `/api/internal/${subpath}`
      : `/api/internal/admin/${subpath}`;
    const hasBody = request.method === "POST" && subpath === "settings";
    const response = await accountsFetch(
      `${target}${request.nextUrl.search}`,
      {
        method: request.method,
        ...(hasBody && {
          headers: { "Content-Type": "application/json" },
          body: await request.text(),
        }),
      },
      admin.email,
    );

    const rejected = response.status === 401 || response.status === 403;
    const status = rejected ? 502 : response.status;
    const body = rejected
      ? JSON.stringify({ message: "Accounts service credentials rejected." })
      : await response.text();

    return new NextResponse(body, {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Accounts proxy request failed:", error);
    return NextResponse.json({ message: "Accounts service is unavailable." }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
