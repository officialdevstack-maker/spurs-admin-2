import "server-only";

export async function sendSms(to: string, message: string): Promise<void> {
  const driver = process.env.SMS_DRIVER ?? "log";
  if (driver === "log") {
    console.info(`[sms:log] to=${to}`);
    return;
  }
  if (driver !== "termii") throw new Error(`Unsupported SMS_DRIVER: ${driver}`);

  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) throw new Error("TERMII_API_KEY must be configured for the Termii SMS driver.");

  const baseUrl = process.env.TERMII_BASE_URL || "https://api.ng.termii.com";
  const response = await fetch(new URL("/api/sms/send", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to,
      from: process.env.TERMII_SENDER_ID || "Spurs",
      sms: message,
      type: "plain",
      channel: process.env.TERMII_CHANNEL || "generic",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Termii SMS request failed (${response.status}).`);
  }
}
