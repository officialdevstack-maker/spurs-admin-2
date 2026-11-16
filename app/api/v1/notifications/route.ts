import { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys";
import { isApiRateLimited } from "@/lib/api-rate-limit";
import { getPool } from "@/lib/db";
import { EmailDisabledError } from "@/lib/mailer";
import {
  createNotification,
  type NotificationChannels,
  type NotificationRequest,
} from "@/lib/notifications";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s()-]{4,30}$/;
const MAX_BODY_CHARS = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseNotification(value: unknown): NotificationRequest | null {
  if (!isRecord(value) || !isRecord(value.channels)) return null;
  const channels = value.channels;
  if (
    typeof value.id !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id) ||
    typeof value.notifiableId !== "string" ||
    !value.notifiableId.trim() ||
    value.notifiableId.length > 120 ||
    typeof value.type !== "string" ||
    !value.type.trim() ||
    value.type.length > 120 ||
    typeof value.queue !== "boolean" ||
    typeof value.delayMs !== "number" ||
    !Number.isInteger(value.delayMs) ||
    value.delayMs < 0 ||
    value.delayMs > 604_800_000
  ) {
    return null;
  }

  const parsed: NotificationChannels = {};
  if (channels.database !== undefined) {
    if (!isRecord(channels.database) || !isRecord(channels.database.data)) return null;
    if (JSON.stringify(channels.database.data).length > MAX_BODY_CHARS) return null;
    parsed.database = { data: channels.database.data };
  }
  if (channels.mail !== undefined) {
    if (!isRecord(channels.mail)) return null;
    const { to, subject, text, html, replyTo, priority } = channels.mail;
    if (
      typeof to !== "string" ||
      to.length > 254 ||
      !EMAIL_RE.test(to) ||
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.length > 300 ||
      /[\r\n]/.test(subject) ||
      (text !== undefined && typeof text !== "string") ||
      (html !== undefined && typeof html !== "string") ||
      (replyTo !== undefined &&
        (typeof replyTo !== "string" || replyTo.length > 254 || !EMAIL_RE.test(replyTo))) ||
      (priority !== undefined && !["high", "normal", "low"].includes(String(priority))) ||
      (!text && !html) ||
      (typeof text === "string" && text.length > MAX_BODY_CHARS) ||
      (typeof html === "string" && html.length > MAX_BODY_CHARS)
    ) {
      return null;
    }
    parsed.mail = {
      to: to.trim().toLowerCase(),
      subject: subject.trim(),
      ...(typeof text === "string" ? { text } : {}),
      ...(typeof html === "string" ? { html } : {}),
      ...(typeof replyTo === "string" ? { replyTo: replyTo.trim().toLowerCase() } : {}),
      ...(priority === "high" || priority === "normal" || priority === "low" ? { priority } : {}),
    };
  }
  if (channels.sms !== undefined) {
    if (!isRecord(channels.sms)) return null;
    const { to, message } = channels.sms;
    if (
      typeof to !== "string" ||
      to.length > 32 ||
      !PHONE_RE.test(to) ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 2000
    ) {
      return null;
    }
    parsed.sms = { to: to.replace(/[^\d+]/g, ""), message };
  }
  if (!parsed.database && !parsed.mail && !parsed.sms) return null;

  return {
    id: value.id,
    notifiableId: value.notifiableId.trim(),
    type: value.type.trim(),
    queue: value.queue,
    delayMs: value.delayMs,
    channels: parsed,
  };
}

export async function POST(request: Request) {
  let client;
  try {
    client = await authenticateApiKey(request);
  } catch (error) {
    console.error("Notification API key verification failed:", error);
    return NextResponse.json({ message: "Authentication is unavailable." }, { status: 503 });
  }
  if (!client) return NextResponse.json({ message: "Invalid API key." }, { status: 401 });
  if (isApiRateLimited(client.id, 60, 60_000, "notifications:send")) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const notification = parseNotification(body);
  if (!notification) {
    return NextResponse.json({ message: "Invalid notification payload." }, { status: 422 });
  }

  try {
    const result = await createNotification(client.id, notification);
    return NextResponse.json({ data: { id: notification.id, ...result } });
  } catch (error) {
    if (error instanceof EmailDisabledError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    console.error(`Notification delivery failed for key "${client.name}":`, error);
    return NextResponse.json({ message: "Could not deliver notification." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  let client;
  try {
    client = await authenticateApiKey(request);
  } catch (error) {
    console.error("Notification API key verification failed:", error);
    return NextResponse.json({ message: "Authentication is unavailable." }, { status: 503 });
  }
  if (!client) return NextResponse.json({ message: "Invalid API key." }, { status: 401 });
  if (isApiRateLimited(client.id, 120, 60_000, "notifications:read")) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const params = new URL(request.url).searchParams;
  const notifiableId = params.get("notifiableId")?.trim() ?? "";
  const rawLimit = Number(params.get("limit") ?? 50);
  const countOnly = params.get("countOnly") === "true";
  if (!notifiableId || notifiableId.length > 120 || (!countOnly && (!Number.isInteger(rawLimit) || rawLimit < 1))) {
    return NextResponse.json({ message: "Invalid inbox query." }, { status: 422 });
  }

  try {
    if (countOnly) {
      const { rows } = await getPool().query<{ count: string }>(
        `select count(*)::text as count
         from notifications
         where api_key_id = $1 and notifiable_id = $2 and read_at is null`,
        [client.id, notifiableId],
      );
      return NextResponse.json({ data: { count: Number(rows[0]?.count ?? 0) } });
    }

    const { rows } = await getPool().query(
      `select id, notifiable_id as "notifiableId", type, data,
              read_at as "readAt", created_at as "createdAt", updated_at as "updatedAt"
       from notifications
       where api_key_id = $1 and notifiable_id = $2
         and ($3::boolean = false or read_at is null)
       order by created_at desc
       limit $4`,
      [client.id, notifiableId, params.get("unreadOnly") === "true", Math.min(rawLimit, 100)],
    );
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("Notification inbox query failed:", error);
    return NextResponse.json({ message: "Could not load notifications." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let client;
  try {
    client = await authenticateApiKey(request);
  } catch (error) {
    console.error("Notification API key verification failed:", error);
    return NextResponse.json({ message: "Authentication is unavailable." }, { status: 503 });
  }
  if (!client) return NextResponse.json({ message: "Invalid API key." }, { status: 401 });
  if (isApiRateLimited(client.id, 120, 60_000, "notifications:read")) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    !isRecord(body) ||
    typeof body.notifiableId !== "string" ||
    !body.notifiableId.trim() ||
    body.notifiableId.length > 120 ||
    (body.notificationId !== undefined &&
      (typeof body.notificationId !== "string" ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.notificationId)))
  ) {
    return NextResponse.json({ message: "Invalid read request." }, { status: 422 });
  }

  try {
    const { rowCount } = body.notificationId
      ? await getPool().query(
          `update notifications set read_at = now(), updated_at = now()
           where api_key_id = $1 and notifiable_id = $2 and id = $3::uuid and read_at is null`,
          [client.id, body.notifiableId.trim(), body.notificationId],
        )
      : await getPool().query(
          `update notifications set read_at = now(), updated_at = now()
           where api_key_id = $1 and notifiable_id = $2 and read_at is null`,
          [client.id, body.notifiableId.trim()],
        );
    return NextResponse.json({ data: { updated: rowCount ?? 0 } });
  } catch (error) {
    console.error("Notification read update failed:", error);
    return NextResponse.json({ message: "Could not update notifications." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  let client;
  try {
    client = await authenticateApiKey(request);
  } catch (error) {
    console.error("Notification API key verification failed:", error);
    return NextResponse.json({ message: "Authentication is unavailable." }, { status: 503 });
  }
  if (!client) return NextResponse.json({ message: "Invalid API key." }, { status: 401 });
  if (isApiRateLimited(client.id, 120, 60_000, "notifications:read")) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const notifiableId = new URL(request.url).searchParams.get("notifiableId")?.trim() ?? "";
  if (!notifiableId || notifiableId.length > 120) {
    return NextResponse.json({ message: "Invalid notification owner." }, { status: 422 });
  }

  try {
    const pool = getPool();
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query(
        "delete from notification_jobs where api_key_id = $1 and notifiable_id = $2",
        [client.id, notifiableId],
      );
      const { rowCount } = await connection.query(
        "delete from notifications where api_key_id = $1 and notifiable_id = $2",
        [client.id, notifiableId],
      );
      await connection.query("COMMIT");
      return NextResponse.json({ data: { deleted: rowCount ?? 0 } });
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Notification deletion failed:", error);
    return NextResponse.json({ message: "Could not delete notifications." }, { status: 503 });
  }
}
