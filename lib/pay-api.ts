export type PayStats = {
  users: number;
  merchants: number;
  checkouts: Record<"open" | "paid" | "cancelled" | "expired", number>;
};

export type PayCheckout = {
  reference: string;
  merchantName: string;
  merchantReference: string;
  description: string | null;
  amount: string;
  currency: string;
  status: "open" | "paid" | "cancelled" | "expired";
  createdAt: string;
  paidAt: string | null;
};

export type PayCheckoutDetail = {
  session: Omit<PayCheckout, "paidAt"> & { expiresAt: string; paidAt: string | null };
  attempts: {
    method: "wallet" | "card" | "bank_transfer";
    status: "pending" | "succeeded" | "failed" | "unknown";
    createdAt: string;
    resolvedAt: string | null;
  }[];
  transaction: {
    reference: string;
    type: string;
    currency: string;
    createdAt: string;
    entries: {
      direction: "debit" | "credit";
      amount: string;
      createdAt: string;
      accountKind: "wallet" | "system";
      accountCode: string | null;
    }[];
  } | null;
  timeline: {
    type: string;
    at: string;
    method?: string;
    status?: string;
    direction?: string;
    amount?: string;
  }[];
};

export type PayListQuery = {
  status?: string;
  merchant?: string;
  from?: string;
  to?: string;
  reference?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

export type PayMerchant = {
  id: string;
  name: string;
  status: "active" | "suspended";
  createdAt: string;
  checkoutCount: number;
  paidCheckoutCount: number;
  paidVolume: string;
};

export type PayWebhookEvent = {
  id: string;
  type: string;
  status: "received" | "processed" | "failed";
  attempts: number;
  lastError: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export type PaySuspenseEntry = {
  reference: string;
  type: string;
  currency: string;
  direction: "debit" | "credit";
  amount: string;
  createdAt: string;
};

export class PayApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PayApiError";
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api/pay/${path}`, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  } & T;
  if (!response.ok) {
    throw new PayApiError(body.message ?? "Request failed.", response.status);
  }
  return body;
}

export const getPayStats = () => request<PayStats>("stats");

function queryString(values: PayListQuery) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

function withQuery<T>(path: string, values: PayListQuery) {
  const suffix = queryString(values);
  return request<T>(`${path}${suffix ? `?${suffix}` : ""}`);
}

export const listPayCheckouts = (query: PayListQuery = {}) =>
  withQuery<{ data: PayCheckout[]; nextCursor: string | null }>("checkouts", query);

export const getPayCheckout = (reference: string) =>
  request<PayCheckoutDetail>(`checkouts/${encodeURIComponent(reference)}`);

export async function listPayMerchants(query: Pick<PayListQuery, "status" | "search" | "limit"> = {}) {
  return withQuery<{ data: PayMerchant[] }>("merchants", query);
}

export async function listPayWebhooks(query: Pick<PayListQuery, "status" | "limit"> = {}) {
  return withQuery<{ data: PayWebhookEvent[] }>("webhooks", query);
}

export async function listPaySuspense(query: Pick<PayListQuery, "cursor" | "limit"> = {}) {
  return withQuery<{ data: PaySuspenseEntry[]; nextCursor: string | null }>("suspense", query);
}
