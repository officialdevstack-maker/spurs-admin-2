import "server-only";

import nodemailer from "nodemailer";

import { getEmailCredentials } from "@/lib/settings";

export class EmailDisabledError extends Error {
  constructor() {
    super("Email is disabled in admin settings.");
    this.name = "EmailDisabledError";
  }
}

export type OutgoingMail = {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

export async function sendMail(mail: OutgoingMail): Promise<string> {
  const config = await getEmailCredentials();
  if (!config.enabled) throw new EmailDisabledError();

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username ? { user: config.username, pass: config.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    const info = await transporter.sendMail({
      from: { name: config.fromName, address: config.fromEmail },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo || config.replyTo || undefined,
    });
    return info.messageId;
  } finally {
    transporter.close();
  }
}
