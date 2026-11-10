export type Meta = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number | null;
  to: number | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T = unknown>(
  path: string,
  opts: {
    method?: "GET" | "POST";
    query?: Record<string, string | number | undefined>;
    body?: unknown;
  } = {},
): Promise<{ message: string; data: T; meta?: Meta }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }

  const response = await fetch(
    `/api/accounts${path}${query.size ? `?${query.toString()}` : ""}`,
    {
      method: opts.method ?? "GET",
      ...(opts.body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts.body),
      }),
    },
  );
  const json = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: T;
    meta?: Meta;
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    throw new ApiError(
      json.message ??
        (response.status === 429
          ? "Too many requests. Please try again later."
          : "Request failed"),
      response.status,
      json.errors,
    );
  }
  return json as { message: string; data: T; meta?: Meta };
}
