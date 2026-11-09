import { NextResponse } from "next/server";

import { getAdmin } from "@/lib/session";



export async function GET() {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({
      user: { email: admin.email, name: admin.name },
    });
  } catch (error) {
    console.error("Could not verify admin session:", error);
    return NextResponse.json(
      { message: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
