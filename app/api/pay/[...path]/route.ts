import { NextRequest, NextResponse } from "next/server";

import { canAccessDashboard, hasPermission } from "@/lib/permissions";
import { getAdmin, type SessionUser } from "@/lib/session";
import { payFetch } from "@/lib/pay-server";

const ALLOWED = new Set(["stats", "checkouts", "merchants", "webhooks", "suspense"]);

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
    console.error("Pay proxy authentication is unavailable:", error);
    return NextResponse.json(
      { message: "Panel authentication is temporarily unavailable." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const subpath = path.join("/");
  const allowed =
    ALLOWED.has(subpath) || /^checkouts\/SPY_[A-Z0-9]{16}$/.test(subpath);
  if (request.method !== "GET" || !allowed) {
    return NextResponse.json(
      { message: `Panel proxy: ${request.method} /${subpath} is not allowed.` },
      { status: 404 },
    );
  }

  if (!canAccessDashboard(admin.dashboards, "pay")) {
    return NextResponse.json({ message: "You do not have access to Spurs Pay." }, { status: 403 });
  }
  if (!hasPermission(admin.permissions, "pay.view")) {
    return NextResponse.json(
      { message: "Missing required permission: pay.view." },
      { status: 403 },
    );
  }

  try {
    const response = await payFetch(
      `/api/internal/admin/${subpath}${request.nextUrl.search}`,
      admin,
      request,
    );
    const rejected = response.status === 401 || response.status === 403;
    return new NextResponse(
      rejected
        ? JSON.stringify({ message: "Pay service credentials rejected." })
        : await response.text(),
      {
        status: rejected ? 502 : response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Pay proxy request failed:", error);
    return NextResponse.json({ message: "Pay service is unavailable." }, { status: 502 });
  }
}

export const GET = handler;
