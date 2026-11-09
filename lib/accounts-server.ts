import "server-only";

const TOKEN_PATH = "/api/auth/login";
let token: string | null = null;
let loginInProgress: Promise<string> | null = null;

function getBaseUrl() {
  const value = process.env.ACCOUNTS_API_URL;
  if (!value) throw new Error("ACCOUNTS_API_URL is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ACCOUNTS_API_URL must use HTTP or HTTPS");
  }
  return url;
}

async function login(): Promise<string> {
  const email = process.env.ACCOUNTS_ADMIN_EMAIL;
  const password = process.env.ACCOUNTS_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Accounts admin credentials are not configured");
  }

  const response = await fetch(new URL(TOKEN_PATH, getBaseUrl()), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("Accounts login failed");
  }

  const receivedToken =
    typeof json === "object" &&
    json !== null &&
    "data" in json &&
    typeof json.data === "object" &&
    json.data !== null &&
    "token" in json.data &&
    typeof json.data.token === "string" &&
    json.data.token.length > 0
      ? json.data.token
      : null;
  if (!receivedToken) throw new Error("Accounts login returned an invalid token response");

  token = receivedToken;
  return receivedToken;
}

function getToken() {
  if (token) return Promise.resolve(token);
  if (!loginInProgress) {
    loginInProgress = login().finally(() => {
      loginInProgress = null;
    });
  }
  return loginInProgress;
}

export async function accountsFetch(path: string, init: RequestInit = {}) {
  const baseUrl = getBaseUrl();
  const send = async (value: string) => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${value}`);
    return fetch(new URL(path, baseUrl), {
      ...init,
      headers,
      cache: "no-store",
    });
  };

  let response = await send(await getToken());
  if (response.status === 401) {
    token = null;
    response = await send(await login());
  }
  return response;
}
