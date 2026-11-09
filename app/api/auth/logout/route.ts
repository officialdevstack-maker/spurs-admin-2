import { NextResponse } from "next/server";

import { clearSession } from "@/lib/session";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ message: "Signed out." });
  } catch (error) {
    console.error("Could not clear admin session:", error);
    return NextResponse.json({ message: "Could not sign out." }, { status: 500 });
  }
}
