import { NextResponse } from "next/server";

import { processNotificationJobs } from "@/lib/notifications";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json({ message: "Notification worker is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processNotificationJobs();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Notification worker failed:", error);
    return NextResponse.json({ message: "Could not process notification jobs." }, { status: 503 });
  }
}
