import { NextRequest, NextResponse } from "next/server";

import { blockbustersFetch } from "@/lib/blockbusters-server";
import { canAccessDashboard, hasPermission } from "@/lib/permissions";
import { getAdmin, type SessionUser } from "@/lib/session";

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

function isAllowed(path: string) {
  return (
    ["stats", "titles", "queue"].includes(path) ||
    new RegExp(`^titles/${ID}$`, "i").test(path) ||
    new RegExp(`^videos/${ID}$`, "i").test(path)
  );
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  let admin: SessionUser | null;
  try {
    admin = await getAdmin();
  } catch (error) {
    console.error("Block Busters proxy authentication is unavailable:", error);
    return NextResponse.json(
      { message: "Panel authentication is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!admin) {
    return NextResponse.json(
      { message: "Not signed in." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { path } = await context.params;
  const subpath = path.join("/");
  if (request.method !== "GET" || !isAllowed(subpath)) {
    return NextResponse.json(
      { message: `Panel proxy: ${request.method} /${subpath} is not allowed.` },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!canAccessDashboard(admin.dashboards, "blockbusters")) {
    return NextResponse.json(
      { message: "You do not have access to Block Busters." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!hasPermission(admin.permissions, "blockbusters.view")) {
    return NextResponse.json(
      { message: "Missing required permission: blockbusters.view." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const response = await blockbustersFetch(
      `/api/internal/admin/${subpath}${request.nextUrl.search}`,
      admin,
      request,
    );
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { message: "Block Busters service credentials rejected." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Block Busters proxy request failed:", error);
    return NextResponse.json(
      { message: "Block Busters service is unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = handler;
