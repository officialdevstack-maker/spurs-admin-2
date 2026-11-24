export class BlockbustersApiError extends Error {
  constructor(
    message: string,
    readonly reauthUrl?: string,
  ) {
    super(message);
    this.name = "BlockbustersApiError";
  }
}

export async function blockbustersRequest<T>(
  path: string,
  options: {
    write?: boolean;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.write) headers.set("Idempotency-Key", crypto.randomUUID());
  const response = await fetch(
    `${options.write ? "/api/admin/blockbusters" : "/api/blockbusters"}/${path}`,
    {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined && {
        body: JSON.stringify(options.body),
      }),
      cache: "no-store",
    },
  );
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body =
      typeof result === "object" && result !== null
        ? (result as { message?: unknown; reauthUrl?: unknown })
        : null;
    throw new BlockbustersApiError(
      typeof body?.message === "string" ? body.message : "Block Busters request failed.",
      typeof body?.reauthUrl === "string" ? body.reauthUrl : undefined,
    );
  }
  return result as T;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
