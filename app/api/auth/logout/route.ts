import { NextResponse } from "next/server";

import { clearSession } from "@/lib/session";
import { expectedOrigin } from "@/lib/origin";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== expectedOrigin(request)) {
      return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    }
    await clearSession();
    return NextResponse.json({ message: "Signed out." });
  } catch (error) {
    console.error("Could not clear admin session:", error);
    return NextResponse.json({ message: "Could not sign out." }, { status: 500 });
  }
}
