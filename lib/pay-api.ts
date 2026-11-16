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

export async function listPayCheckouts(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ data: PayCheckout[] }>(`checkouts${query}`);
}
