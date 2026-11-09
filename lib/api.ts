export type Meta = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number | null;
  to: number | null;
};

export async function api<T = unknown>(
  path: string,
  opts: {
    method?: "GET" | "POST";
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<{ message: string; data: T; meta?: Meta }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }

  const response = await fetch(
    `/api/accounts${path}${query.size ? `?${query.toString()}` : ""}`,
    { method: opts.method ?? "GET" },
  );
  const json = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: T;
    meta?: Meta;
  };

  if (!response.ok) {
    throw new Error(
      json.message ??
        (response.status === 429
          ? "Too many requests. Please try again later."
          : "Request failed"),
    );
  }
  return json as { message: string; data: T; meta?: Meta };
}
