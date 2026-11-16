import { NextResponse } from "next/server";

import { requirePermission, requireRecentAuth } from "@/lib/admin-guard";
import {
  getPayProviderSettings,
  savePayProviderSettings,
} from "@/lib/pay-provider-settings";

export async function GET(request: Request) {
  try {
    const guard = await requirePermission(request, "pay.providers.manage");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getPayProviderSettings() });
  } catch (error) {
    console.error("Could not load Pay provider settings:", error);
    return NextResponse.json(
      { message: "Provider settings are unavailable." },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requirePermission(request, "pay.providers.manage");
    if ("error" in guard) return guard.error;
    const stepUpError = requireRecentAuth(guard.admin, "/pay/providers");
    if (stepUpError) return stepUpError;

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "Invalid body." }, { status: 422 });
    }

    const values = body as Record<string, unknown>;
    const reason = typeof values.reason === "string" ? values.reason.trim() : "";
    if (!reason || reason.length > 1000) {
      return NextResponse.json(
        { message: "Enter a reason for changing Pay provider settings." },
        { status: 422 },
      );
    }
    if (
      values.provider !== "sandbox" &&
      values.provider !== "flutterwave"
    ) {
      return NextResponse.json({ message: "Unsupported provider." }, { status: 422 });
    }
    if (
      (values.secretKey !== undefined && typeof values.secretKey !== "string") ||
      (values.webhookSecret !== undefined && typeof values.webhookSecret !== "string") ||
      (values.clearSecretKey !== undefined && typeof values.clearSecretKey !== "boolean") ||
      (values.clearWebhookSecret !== undefined &&
        typeof values.clearWebhookSecret !== "boolean")
    ) {
      return NextResponse.json({ message: "Invalid provider credentials." }, { status: 422 });
    }

    const secretKey = typeof values.secretKey === "string" ? values.secretKey.trim() : "";
    const webhookSecret =
      typeof values.webhookSecret === "string" ? values.webhookSecret.trim() : "";
    const clearSecretKey = values.clearSecretKey === true;
    const clearWebhookSecret = values.clearWebhookSecret === true;

    if (
      secretKey.length > 2048 ||
      webhookSecret.length > 2048 ||
      (secretKey && clearSecretKey) ||
      (webhookSecret && clearWebhookSecret)
    ) {
      return NextResponse.json(
        { message: "Credential values are invalid or too long." },
        { status: 422 },
      );
    }

    if (values.provider === "flutterwave") {
      const current = await getPayProviderSettings();
      const hasSecretKey = secretKey.length > 0 || (current.flutterwaveSecretKeySet && !clearSecretKey);
      const hasWebhookSecret =
        webhookSecret.length > 0 ||
        (current.flutterwaveWebhookSecretSet && !clearWebhookSecret);
      if (!hasSecretKey || !hasWebhookSecret) {
        return NextResponse.json(
          { message: "Flutterwave requires both credentials before it can be enabled." },
          { status: 422 },
        );
      }
    }

    await savePayProviderSettings(
      {
        provider: values.provider,
        secretKey,
        webhookSecret,
        clearSecretKey,
        clearWebhookSecret,
      },
      { admin: guard.admin, request, reason },
    );
    return NextResponse.json({ data: await getPayProviderSettings() });
  } catch (error) {
    console.error("Could not save Pay provider settings:", error);
    return NextResponse.json(
      { message: "Could not save provider settings." },
      { status: 503 },
    );
  }
}
