import { NextRequest, NextResponse } from "next/server";

import { PANEL_SESSION_COOKIE, verifyPanelSession } from "@/lib/panel-session";

export function GET(request: NextRequest) {
  try {
    const session = verifyPanelSession(request.cookies.get(PANEL_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }
    return NextResponse.json({
      data: { email: session.email, name: "Admin" },
    });
  } catch (error) {
    console.error("Panel session verification is unavailable:", error);
    return NextResponse.json({ message: "Panel authentication is not configured." }, { status: 503 });
  }
}
