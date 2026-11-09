import { NextRequest, NextResponse } from "next/server";

import {
  createPanelSession,
  getPanelCredentials,
  PANEL_SESSION_COOKIE,
  PANEL_SESSION_MAX_AGE,
} from "@/lib/panel-session";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  try {
    const credentials = getPanelCredentials();
    if (
      body.email.trim().toLowerCase() !== credentials.email ||
      body.password !== credentials.password
    ) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const response = NextResponse.json({
      data: { email: credentials.email, name: "Admin" },
    });
    response.cookies.set(PANEL_SESSION_COOKIE, createPanelSession(credentials.email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PANEL_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("Panel login is unavailable:", error);
    return NextResponse.json({ message: "Panel authentication is not configured." }, { status: 503 });
  }
}
