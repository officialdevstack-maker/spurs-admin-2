import { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys";
import { getPool } from "@/lib/db";
import { EmailDisabledError, sendMail } from "@/lib/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 50;
const MAX_BODY_CHARS = 500_000;
const LIMIT_PER_MINUTE = 60;

const requestHits = new Map<number, { count: number; resetAt: number }>();

function isRateLimited(keyId: number) {
  const now = Date.now();
  const entry = requestHits.get(keyId);
  if (!entry || entry.resetAt <= now) {
    requestHits.set(keyId, { count: 1, resetAt: now + 60_000 });
    if (requestHits.size > 10_000) {
      for (const [id, hit] of requestHits) {
        if (hit.resetAt <= now) requestHits.delete(id);
      }
    }
    return false;
  }

  entry.count += 1;
  return entry.count > LIMIT_PER_MINUTE;
}

async function logEmail(
  keyId: number,
  recipients: string[],
  subject: string,
  status: "sent" | "failed",
  error?: string,
) {
  try {
    await getPool().query(
      `insert into email_log (api_key_id, recipients, subject, status, error)
       values ($1, $2::text[], $3, $4, $5)`,
      [keyId, recipients, subject, status, error?.slice(0, 500) ?? null],
    );
  } catch (cause) {
    console.error("Could not write email log:", cause);
  }
}

export async function POST(request: Request) {
  let client;
  try {
    client = await authenticateApiKey(request);
  } catch (error) {
    console.error("API key verification failed:", error);
    return NextResponse.json({ message: "Authentication is unavailable." }, { status: 503 });
  }

  if (!client) {
    return NextResponse.json({ message: "Invalid API key." }, { status: 401 });
  }
  if (isRateLimited(client.id)) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 422 });
  }

  const values = body as Record<string, unknown>;
  const rawTo = Array.isArray(values.to) ? values.to : [values.to];
  if (
    !rawTo.length ||
    rawTo.length > MAX_RECIPIENTS ||
    rawTo.some((recipient) => typeof recipient !== "string")
  ) {
    return NextResponse.json(
      { message: `"to" must be 1-${MAX_RECIPIENTS} valid email addresses.` },
      { status: 422 },
    );
  }
  const to = (rawTo as string[]).map((recipient) => recipient.trim().toLowerCase());
  const subject = typeof values.subject === "string" ? values.subject.trim() : "";
  const text = typeof values.text === "string" ? values.text : undefined;
  const html = typeof values.html === "string" ? values.html : undefined;
  const replyTo =
    typeof values.replyTo === "string" ? values.replyTo.trim().toLowerCase() : "";

  if (!to.every((recipient) => recipient.length <= 254 && EMAIL_RE.test(recipient))) {
    return NextResponse.json(
      { message: `"to" must be 1-${MAX_RECIPIENTS} valid email addresses.` },
      { status: 422 },
    );
  }
  if (!subject || subject.length > 300 || /[\r\n]/.test(subject)) {
    return NextResponse.json(
      { message: "A single-line subject (max 300 chars) is required." },
      { status: 422 },
    );
  }
  if (!text && !html) {
    return NextResponse.json({ message: 'Provide "text" and/or "html".' }, { status: 422 });
  }
  if ((text?.length ?? 0) > MAX_BODY_CHARS || (html?.length ?? 0) > MAX_BODY_CHARS) {
    return NextResponse.json({ message: "Message body is too large." }, { status: 422 });
  }
  if (replyTo && (replyTo.length > 254 || !EMAIL_RE.test(replyTo))) {
    return NextResponse.json({ message: "Invalid replyTo address." }, { status: 422 });
  }

  try {
    const messageId = await sendMail({ to, subject, text, html, replyTo: replyTo || undefined });
    await logEmail(client.id, to, subject, "sent");
    return NextResponse.json({ data: { messageId } });
  } catch (error) {
    if (error instanceof EmailDisabledError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    console.error(`Email send failed for key "${client.name}":`, error);
    await logEmail(
      client.id,
      to,
      subject,
      "failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ message: "Could not send email." }, { status: 502 });
  }
}
