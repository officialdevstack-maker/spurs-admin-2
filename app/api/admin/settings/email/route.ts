import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/admin-guard";
import { getEmailConfig, saveEmailConfig } from "@/lib/settings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const guard = await requirePermission(request, "settings.manage");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getEmailConfig() });
  } catch (error) {
    console.error("Could not load email settings:", error);
    return NextResponse.json({ message: "Settings are unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requirePermission(request, "settings.manage");
    if ("error" in guard) return guard.error;

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "Invalid body." }, { status: 422 });
    }

    const values = body as Record<string, unknown>;
    const { host: hostValue, username: usernameValue, fromName: fromNameValue,
      fromEmail: fromEmailValue, replyTo: replyToValue } = values;
    if (
      typeof hostValue !== "string" ||
      typeof usernameValue !== "string" ||
      typeof fromNameValue !== "string" ||
      typeof fromEmailValue !== "string" ||
      typeof replyToValue !== "string"
    ) {
      return NextResponse.json({ message: "Invalid email settings." }, { status: 422 });
    }
    if (
      typeof values.enabled !== "boolean" ||
      typeof values.secure !== "boolean" ||
      typeof values.port !== "number" ||
      (values.password !== undefined && typeof values.password !== "string") ||
      (values.clearPassword !== undefined && typeof values.clearPassword !== "boolean")
    ) {
      return NextResponse.json({ message: "Invalid email settings." }, { status: 422 });
    }

    const str = (value: string) => value.trim();
    const enabled = values.enabled;
    const host = str(hostValue);
    const port = values.port;
    const secure = values.secure;
    const username = str(usernameValue);
    const fromName = str(fromNameValue);
    const fromEmail = str(fromEmailValue).toLowerCase();
    const replyTo = str(replyToValue).toLowerCase();
    const password = typeof values.password === "string" ? values.password : "";
    const clearPassword = values.clearPassword === true;

    if (password && clearPassword) {
      return NextResponse.json(
        { message: "Enter a new password or remove the saved password, not both." },
        { status: 422 },
      );
    }
    if (
      host.length > 253 ||
      username.length > 254 ||
      fromName.length > 120 ||
      password.length > 512
    ) {
      return NextResponse.json({ message: "A value is too long." }, { status: 422 });
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { message: "Port must be between 1 and 65535." },
        { status: 422 },
      );
    }
    if (fromEmail && !EMAIL_RE.test(fromEmail)) {
      return NextResponse.json({ message: "Enter a valid from email." }, { status: 422 });
    }
    if (replyTo && !EMAIL_RE.test(replyTo)) {
      return NextResponse.json({ message: "Enter a valid reply-to email." }, { status: 422 });
    }
    if (enabled && (!host || !fromEmail)) {
      return NextResponse.json(
        { message: "Host and from email are required to enable email." },
        { status: 422 },
      );
    }

    await saveEmailConfig(
      { enabled, host, port, secure, username, fromName, fromEmail, replyTo, password, clearPassword },
      guard.admin.id,
    );
    return NextResponse.json({ data: await getEmailConfig() });
  } catch (error) {
    console.error("Could not save email settings:", error);
    return NextResponse.json({ message: "Could not save settings." }, { status: 503 });
  }
}
