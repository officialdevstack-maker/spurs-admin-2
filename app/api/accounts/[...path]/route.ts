import { NextRequest, NextResponse } from "next/server";

import { accountsFetch } from "@/lib/accounts-server";
import { PANEL_SESSION_COOKIE, verifyPanelSession } from "@/lib/panel-session";

const ALLOWED = [
  /^users$/,
  /^users\/\d+$/,
  /^users\/\d+\/(suspend|unsuspend|revoke-sessions|verify-email)$/,
];

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    if (!verifyPanelSession(request.cookies.get(PANEL_SESSION_COOKIE)?.value)) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }
  } catch (error) {
    console.error("Accounts proxy authentication is unavailable:", error);
    return NextResponse.json({ message: "Panel authentication is not configured." }, { status: 503 });
  }

  const { path } = await context.params;
  const subpath = path.join("/");
  if (!ALLOWED.some((pattern) => pattern.test(subpath))) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (request.method === "POST" && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  try {
    const response = await accountsFetch(
      `/api/admin/${subpath}${request.nextUrl.search}`,
      { method: request.method },
    );
    const status = response.status === 401 || response.status === 403 ? 502 : response.status;
    const body =
      status === 502
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
