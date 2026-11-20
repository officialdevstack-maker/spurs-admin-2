export const RATE_RULE_NAMES = [
  "p2p_send",
  "p2p_send_ip",
  "recipient_lookup",
  "recipient_lookup_ip",
  "contact_lookup",
  "contact_lookup_ip",
  "pin_verify",
  "service_client",
  "internal_admin",
  "checkout_api",
  "checkout_pay",
] as const;

export type RateRuleName = (typeof RATE_RULE_NAMES)[number];

const KOBO_FIELDS = [
  "perTransferKobo",
  "dailyDebitKobo",
  "maxBalanceKobo",
  "maxCheckoutAmountKobo",
] as const;

export type PayPolicy = {
  fees: { cardFundingBps: number };
  limits: Record<(typeof KOBO_FIELDS)[number], string>;
  checkout: { sessionTtlSeconds: number; attemptGraceSeconds: number };
  rateLimits: Record<RateRuleName, { limit: number; windowSeconds: number }>;
  methods: { wallet: boolean; card: boolean; bankTransfer: boolean };
};

export type PayPolicyVersion = {
  version: number;
  reason: string;
  rolledBackFrom: number | null;
  createdAt: string;
  createdBy: string | null;
};

export const DEFAULT_POLICY: PayPolicy = {
  fees: { cardFundingBps: 250 },
  limits: {
    perTransferKobo: "5000000",
    dailyDebitKobo: "20000000",
    maxBalanceKobo: "50000000",
    maxCheckoutAmountKobo: "5000000000",
  },
  checkout: { sessionTtlSeconds: 3600, attemptGraceSeconds: 86400 },
  rateLimits: {
    p2p_send: { limit: 10, windowSeconds: 60 },
    p2p_send_ip: { limit: 30, windowSeconds: 60 },
    recipient_lookup: { limit: 30, windowSeconds: 60 },
    recipient_lookup_ip: { limit: 90, windowSeconds: 60 },
    contact_lookup: { limit: 10, windowSeconds: 60 },
    contact_lookup_ip: { limit: 30, windowSeconds: 60 },
    pin_verify: { limit: 10, windowSeconds: 60 },
    service_client: { limit: 600, windowSeconds: 60 },
    internal_admin: { limit: 120, windowSeconds: 60 },
    checkout_api: { limit: 300, windowSeconds: 60 },
    checkout_pay: { limit: 20, windowSeconds: 60 },
  },
  methods: { wallet: false, card: false, bankTransfer: true },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function parsePolicy(value: unknown): PayPolicy | string {
  if (!isRecord(value)) return "Policy must be an object.";
  const { fees, limits, checkout, rateLimits, methods } = value;
  if (!isRecord(fees) || !isInt(fees.cardFundingBps, 0, 10_000)) {
    return "Card funding fee must be a whole number from 0 to 10000 basis points.";
  }
  if (!isRecord(limits)) return "Limits are required.";
  const kobo = {} as PayPolicy["limits"];
  for (const field of KOBO_FIELDS) {
    const raw = limits[field];
    if (typeof raw !== "string" || !/^[1-9]\d{0,14}$/.test(raw)) {
      return `${field} must be a positive whole number of kobo.`;
    }
    kobo[field] = raw;
  }
  if (BigInt(kobo.perTransferKobo) > BigInt(kobo.dailyDebitKobo)) {
    return "The per-transfer limit cannot exceed the daily limit.";
  }
  if (
    !isRecord(checkout) ||
    !isInt(checkout.sessionTtlSeconds, 300, 86_400) ||
    !isInt(checkout.attemptGraceSeconds, 0, 604_800)
  ) {
    return "Checkout expiry must be 300 to 86400 seconds and the grace window 0 to 604800 seconds.";
  }
  if (!isRecord(rateLimits)) return "Rate limits are required.";
  const rules = {} as PayPolicy["rateLimits"];
  for (const name of RATE_RULE_NAMES) {
    const rule = rateLimits[name];
    if (!isRecord(rule) || !isInt(rule.limit, 1, 100_000) || !isInt(rule.windowSeconds, 1, 86_400)) {
      return `Rate limit "${name}" needs a limit of 1 to 100000 and a window of 1 to 86400 seconds.`;
    }
    rules[name] = { limit: rule.limit, windowSeconds: rule.windowSeconds };
  }
  if (
    !isRecord(methods) ||
    typeof methods.wallet !== "boolean" ||
    typeof methods.card !== "boolean" ||
    typeof methods.bankTransfer !== "boolean"
  ) {
    return "Method availability is invalid.";
  }
  return {
    fees: { cardFundingBps: fees.cardFundingBps },
    limits: kobo,
    checkout: {
      sessionTtlSeconds: checkout.sessionTtlSeconds,
      attemptGraceSeconds: checkout.attemptGraceSeconds,
    },
    rateLimits: rules,
    methods: { wallet: methods.wallet, card: methods.card, bankTransfer: methods.bankTransfer },
  };
}
