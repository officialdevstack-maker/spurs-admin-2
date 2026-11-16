import "server-only";

import { getPool } from "@/lib/db";
import { EmailDisabledError, sendMail } from "@/lib/mailer";
import { sendSms } from "@/lib/sms";

export type NotificationChannels = {
  database?: { data: Record<string, unknown> };
  mail?: { to: string; subject: string; text?: string; html?: string };
  sms?: { to: string; message: string };
};

export type NotificationRequest = {
  id: string;
  notifiableId: string;
  type: string;
  queue: boolean;
  delayMs: number;
  channels: NotificationChannels;
};

type QueuedJob = {
  id: number;
  channel: "mail" | "sms";
  payload: unknown;
  attempts: number;
};

export async function createNotification(
  apiKeyId: number,
  notification: NotificationRequest,
): Promise<{ queued: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  const queueChannels = notification.queue
    ? (["mail", "sms"] as const).filter((channel) => notification.channels[channel])
    : [];

  try {
    await client.query("BEGIN");
    if (notification.channels.database) {
      await client.query(
        `insert into notifications
          (id, api_key_id, notifiable_id, type, data)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (api_key_id, notifiable_id, id) do nothing`,
        [
          notification.id,
          apiKeyId,
          notification.notifiableId,
          notification.type,
          JSON.stringify(notification.channels.database.data),
        ],
      );
    }

    for (const channel of queueChannels) {
      await client.query(
        `insert into notification_jobs
          (api_key_id, notification_id, notifiable_id, channel, payload, run_after)
         values ($1, $2, $3, $4, $5::jsonb, now() + ($6 * interval '1 millisecond'))
         on conflict (api_key_id, notifiable_id, notification_id, channel) do nothing`,
        [
          apiKeyId,
          notification.id,
          notification.notifiableId,
          channel,
          JSON.stringify(notification.channels[channel]),
          notification.delayMs,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (!notification.queue) {
    const results = await Promise.allSettled([
      ...(notification.channels.mail ? [deliver("mail", notification.channels.mail)] : []),
      ...(notification.channels.sms ? [deliver("sms", notification.channels.sms)] : []),
    ]);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) {
      const cause = failures[0]?.status === "rejected" ? failures[0].reason : undefined;
      if (cause instanceof EmailDisabledError) throw cause;
      throw new AggregateError(
        failures.map((result) => (result.status === "rejected" ? result.reason : undefined)),
        "One or more notification channels failed.",
      );
    }
  }

  return { queued: queueChannels.length > 0 };
}

export async function processNotificationJobs(limit = 25) {
  const { rows } = await getPool().query<QueuedJob>(
    `with next_jobs as (
       select id
       from notification_jobs
       where (status = 'pending' and run_after <= now())
          or (status = 'processing' and locked_at < now() - interval '5 minutes')
       order by run_after, created_at
       for update skip locked
       limit $1
     )
     update notification_jobs as jobs
     set status = 'processing', attempts = jobs.attempts + 1,
         locked_at = now(), updated_at = now()
     from next_jobs
     where jobs.id = next_jobs.id
     returning jobs.id, jobs.channel, jobs.payload, jobs.attempts`,
    [limit],
  );

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const job of rows) {
    try {
      await deliver(job.channel, job.payload);
      await getPool().query(
        `update notification_jobs
         set status = 'sent', payload = '{}'::jsonb, locked_at = null,
             last_error = null, updated_at = now()
         where id = $1 and status = 'processing'`,
        [job.id],
      );
      sent += 1;
    } catch (error) {
      const isFinalAttempt = job.attempts >= 8;
      const delaySeconds = Math.min(3600, 10 * 2 ** (job.attempts - 1));
      await getPool().query(
        `update notification_jobs
         set status = $2, payload = case when $2 = 'failed' then '{}'::jsonb else payload end,
             run_after = now() + ($3 * interval '1 second'), locked_at = null,
             last_error = $4, updated_at = now()
         where id = $1 and status = 'processing'`,
        [
          job.id,
          isFinalAttempt ? "failed" : "pending",
          delaySeconds,
          error instanceof Error ? error.message.slice(0, 500) : "Unknown notification delivery error",
        ],
      );
      if (isFinalAttempt) failed += 1;
      else retried += 1;
    }
  }

  return { processed: rows.length, sent, retried, failed };
}

async function deliver(
  channel: "mail" | "sms",
  payload: unknown,
): Promise<void> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Invalid queued ${channel} payload.`);
  }
  const values = payload as Record<string, unknown>;
  if (channel === "mail") {
    if (
      typeof values.to !== "string" ||
      typeof values.subject !== "string" ||
      (values.text !== undefined && typeof values.text !== "string") ||
      (values.html !== undefined && typeof values.html !== "string") ||
      (values.replyTo !== undefined && typeof values.replyTo !== "string") ||
      (values.priority !== undefined && !["high", "normal", "low"].includes(String(values.priority)))
    ) {
      throw new Error("Invalid queued mail payload.");
    }
    await sendMail({
      to: [values.to],
      subject: values.subject,
      ...(typeof values.text === "string" ? { text: values.text } : {}),
      ...(typeof values.html === "string" ? { html: values.html } : {}),
      ...(typeof values.replyTo === "string" ? { replyTo: values.replyTo } : {}),
      ...(values.priority === "high" ||
      values.priority === "normal" ||
      values.priority === "low"
        ? { priority: values.priority }
        : {}),
    });
    return;
  }

  if (typeof values.to !== "string" || typeof values.message !== "string") {
    throw new Error("Invalid queued SMS payload.");
  }
  await sendSms(values.to, values.message);
}
