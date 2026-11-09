export const ROOT_DOMAIN = "example.com";

export const SUBDOMAINS = [
  { name: "Main App", slug: "app" },
  { name: "Accounts", slug: "accounts" },
  { name: "API", slug: "api" },
] as const;

export const subdomainUrl = (slug: string) => `https://${slug}.${ROOT_DOMAIN}`;
