import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

export async function proxy(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token && (await verifySessionToken(token))) {
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
