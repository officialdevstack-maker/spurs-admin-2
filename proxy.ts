import { NextRequest, NextResponse } from "next/server";

import { PANEL_SESSION_COOKIE, verifyPanelSession } from "@/lib/panel-session";

export function proxy(request: NextRequest) {
  try {
    if (verifyPanelSession(request.cookies.get(PANEL_SESSION_COOKIE)?.value)) {
      return NextResponse.next();
    }
  } catch (error) {
    console.error("Dashboard session verification is unavailable:", error);
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/", "/((?!api/|login|_next/|favicon.ico).*)"],
};
