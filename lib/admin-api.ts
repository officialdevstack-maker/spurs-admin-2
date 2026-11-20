export type AdminRole = {
  id: number;
  name: string;
  description: string;
  dashboards: string[];
  permissions: string[];
};

export type AdminRow = {
  id: number;
  fullname: string;
  email: string;
  suspendedAt: string | null;
  roleId: number | null;
  roleName: string | null;
};

export type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  passwordSet: boolean;
};

export type PayProviderSettings = {
  provider: "sandbox" | "flutterwave";
  flutterwaveSecretKeySet: boolean;
  flutterwaveWebhookSecretSet: boolean;
  serviceClients: string;
};

export type PayPolicy = {
  fees: { cardFundingBps: number };
  limits: {
    perTransferKobo: string;
    dailyDebitKobo: string;
    maxBalanceKobo: string;
    maxCheckoutAmountKobo: string;
  };
  checkout: { sessionTtlSeconds: number; attemptGraceSeconds: number };
  rateLimits: Record<string, { limit: number; windowSeconds: number }>;
  methods: { wallet: boolean; card: boolean; bankTransfer: boolean };
};

export type PayPolicyVersion = {
  version: number;
  reason: string;
  rolledBackFrom: number | null;
  createdAt: string;
  createdBy: string | null;
};

export type ServiceClientRow = {
  clientId: string;
  product: "wallet";
  createdAt: string;
  revokedAt: string | null;
  createdBy: string | null;
};

export type OidcClientCredentials = {
  clientId: string;
  clientSecret: string | null;
  name: string;
  scopes: string[];
  isActive: boolean;
};

export type AccountsOidcClient = {
  clientId: string;
  name: string;
  description: string | null;
  logoUri: string | null;
  type: "first_party" | "third_party";
  isConfidential: boolean;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedScopes: string[];
  backchannelLogoutUri: string | null;
  clientCredentialsEnabled: boolean;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    const reauthUrl = (json as { reauthUrl?: unknown }).reauthUrl;
    if (typeof reauthUrl === "string" && typeof window !== "undefined") {
      window.location.assign(reauthUrl);
    }
    throw new Error(json.message ?? "Request failed");
  }
  return json;
}

export const listAdmins = () =>
  call<{ data: AdminRow[]; currentId: number }>("/api/admin/users");
export const listRoles = () => call<{ data: AdminRole[] }>("/api/admin/roles");
export const createRole = (input: {
  name: string;
  description: string;
  dashboards: string[];
  permissions?: string[];
}) => call("/api/admin/roles", { method: "POST", body: JSON.stringify(input) });
export const updateRole = (
  id: number,
  changes: { name?: string; description?: string; dashboards?: string[]; permissions?: string[] },
) => call(`/api/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
export const createAdmin = (input: {
  fullname: string;
  email: string;
  password: string;
  roleId: number;
}) => call("/api/admin/users", { method: "POST", body: JSON.stringify(input) });
export const updateAdmin = (id: number, changes: { roleId?: number; suspended?: boolean }) =>
  call(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
export const getEmailSettings = () =>
  call<{ data: EmailSettings }>("/api/admin/settings/email").then((response) => response.data);
export const updateEmailSettings = (
  input: Omit<EmailSettings, "passwordSet"> & { password?: string; clearPassword?: boolean },
) =>
  call<{ data: EmailSettings }>("/api/admin/settings/email", {
    method: "PUT",
    body: JSON.stringify(input),
  }).then((response) => response.data);
export const getPayProviderSettings = () =>
  call<{ data: PayProviderSettings }>("/api/admin/pay/providers").then((response) => response.data);
export const updatePayProviderSettings = (
  input: {
    provider: PayProviderSettings["provider"];
    reason: string;
    secretKey?: string;
    webhookSecret?: string;
    clearSecretKey?: boolean;
    clearWebhookSecret?: boolean;
    serviceClients?: string;
  },
) =>
  call<{ data: PayProviderSettings }>("/api/admin/pay/providers", {
    method: "PUT",
    body: JSON.stringify(input),
  }).then((response) => response.data);

export const getPayPolicy = () =>
  call<{ data: { version: number; config: PayPolicy } }>("/api/admin/pay/policy")
    .then((response) => response.data);
export const savePayPolicy = (config: PayPolicy, reason: string) =>
  call<{ data: { version: number; config: PayPolicy } }>("/api/admin/pay/policy", {
    method: "PUT",
    body: JSON.stringify({ config, reason }),
  }).then((response) => response.data);
export const listPayPolicyVersions = () =>
  call<{ data: PayPolicyVersion[] }>("/api/admin/pay/policy/versions")
    .then((response) => response.data);
export const rollbackPayPolicy = (version: number, reason: string) =>
  call<{ data: { version: number; config: PayPolicy } }>("/api/admin/pay/policy/rollback", {
    method: "POST",
    body: JSON.stringify({ version, reason }),
  }).then((response) => response.data);
export const listServiceClients = () =>
  call<{ data: ServiceClientRow[] }>("/api/admin/pay/service-clients")
    .then((response) => response.data);
export const addServiceClient = (input: { clientId: string; product: "wallet"; reason: string }) =>
  call<{ data: ServiceClientRow[] }>("/api/admin/pay/service-clients", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((response) => response.data);
export const revokeServiceClient = (clientId: string, reason: string) =>
  call<{ data: { clientId: string; revoked: boolean } }>(
    `/api/admin/pay/service-clients/${encodeURIComponent(clientId)}/revoke`,
    { method: "POST", body: JSON.stringify({ reason }) },
  ).then((response) => response.data);

export const createAccountsOidcClient = (input: {
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  backchannelLogoutUri?: string;
  scopes?: string[];
  firstParty: boolean;
  public: boolean;
  clientCredentials: boolean;
  service: boolean;
  reason: string;
}) =>
  call<{ data: OidcClientCredentials }>("/api/admin/accounts/oidc-clients", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((response) => response.data);

export const listAccountsOidcClients = () =>
  call<{ data: AccountsOidcClient[] }>("/api/admin/accounts/oidc-clients")
    .then((response) => response.data);

export const getAccountsOidcClient = (clientId: string) =>
  call<{ data: AccountsOidcClient }>(`/api/admin/accounts/oidc-clients/${encodeURIComponent(clientId)}`)
    .then((response) => response.data);

export const updateAccountsOidcClient = (
  clientId: string,
  changes: {
    name?: string;
    redirectUris?: string[];
    postLogoutRedirectUris?: string[];
    backchannelLogoutUri?: string | null;
    scopes?: string[];
    firstParty?: boolean;
    isActive?: boolean;
    reason: string;
  },
) =>
  call<{ data: AccountsOidcClient }>(`/api/admin/accounts/oidc-clients/${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  }).then((response) => response.data);

export const deactivateAccountsOidcClient = (clientId: string, reason: string) =>
  call<{ data: AccountsOidcClient }>(`/api/admin/accounts/oidc-clients/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  }).then((response) => response.data);

export type PayMerchantChange = {
  merchant: { id: string; name: string; status: "pending" | "active" | "suspended" };
  credentials?: { clientId: string; clientSecret: string };
};

export const createPayMerchant = (input: {
  name: string;
  returnUrl: string;
  reason: string;
}) =>
  call<PayMerchantChange>("/api/admin/pay/merchants", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const changePayMerchantStatus = (
    id: string,
    action: "approve" | "suspend" | "reactivate",
    reason: string,
) =>
    call<PayMerchantChange>(`/api/admin/pay/merchants/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });

export type MerchantCredentialStatus = {
  clientId: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
};

export type RotatedMerchantCredentials = {
  clientId: string;
  clientSecret: string;
};

export const getPayMerchantCredentials = (id: string) =>
  call<MerchantCredentialStatus>(`/api/admin/pay/merchants/${encodeURIComponent(id)}/credentials`);

export const changePayMerchantCredentials = (
  id: string,
  action: "rotate" | "revoke",
  reason: string,
) =>
  call<RotatedMerchantCredentials | { clientId: string; isActive: false }>(
    `/api/admin/pay/merchants/${encodeURIComponent(id)}/credentials/${action}`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );

type MerchantWebhookSettings = { url: string; maxAttempts: number; enabled: boolean; reason: string };

export const savePayMerchantWebhook = (
  id: string,
  input: MerchantWebhookSettings,
  create: boolean,
) =>
  call<{ config: { url: string; eventTypes: string[]; maxAttempts: number; enabled: boolean }; signingSecret?: string }>(
    `/api/admin/pay/merchants/${encodeURIComponent(id)}/webhooks`,
    { method: create ? "POST" : "PUT", body: JSON.stringify(input) },
  );

export const rotatePayMerchantWebhookSecret = (id: string, reason: string) =>
  call<{ signingSecret: string }>(
    `/api/admin/pay/merchants/${encodeURIComponent(id)}/webhooks/rotate-secret`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );

export const redeliverPayMerchantWebhook = (id: string, deliveryId: string, reason: string) =>
  call<{ deliveryId: string; status: "pending" }>(
    `/api/admin/pay/merchants/${encodeURIComponent(id)}/webhooks/deliveries/${encodeURIComponent(deliveryId)}/redeliver`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );

export const savePayMerchantOnboarding = (
  id: string,
  input: {
    checklist: {
      registrationVerified: boolean;
      ownershipVerified: boolean;
      settlementAccountVerified: boolean;
      riskReviewComplete: boolean;
    };
    dueDiligenceNotes: string;
    reason: string;
  },
) =>
  call<{
    checklist: typeof input.checklist;
    dueDiligenceNotes: string;
    updatedBy: number;
    updatedAt: string;
  }>(`/api/admin/pay/merchants/${encodeURIComponent(id)}/onboarding`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
