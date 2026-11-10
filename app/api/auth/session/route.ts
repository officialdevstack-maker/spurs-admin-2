import { NextResponse } from "next/server";

import { getAdmin } from "@/lib/session";


export async function GET() {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Not signed in." }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
        dashboards: admin.dashboards,
      },
    });
  } catch (error) {
    console.error("Panel session verification is unavailable:", error);
    return NextResponse.json(
      { message: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
