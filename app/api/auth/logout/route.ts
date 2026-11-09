import { NextResponse } from "next/server";

import { PANEL_SESSION_COOKIE } from "@/lib/panel-session";

export async function POST() {
  const response = NextResponse.json({ message: "Signed out." });
  response.cookies.set(PANEL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
