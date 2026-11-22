"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAccountsOidcClient,
  getAccountsOidcClient,
  updateAccountsOidcClient,
  type AccountsOidcClient,
  type OidcClientCredentials,
} from "@/lib/admin-api";

const msg = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
const splitList = (value: string) =>
  value.split(",").map((item) => item.trim()).filter(Boolean);
const listPath = "/accounts/oidc-clients";

export function OidcClientCreatePage() {
  const [name, setName] = React.useState("");
  const [grant, setGrant] = React.useState<"authorization_code" | "client_credentials">(
    "authorization_code",
  );
  const [redirectUris, setRedirectUris] = React.useState("");
  const [postLogoutRedirectUris, setPostLogoutRedirectUris] = React.useState("");
  const [backchannelLogoutUri, setBackchannelLogoutUri] = React.useState("");
  const [scopes, setScopes] = React.useState("");
  const [firstParty, setFirstParty] = React.useState(false);
  const [publicClient, setPublicClient] = React.useState(false);
  const [service, setService] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<OidcClientCredentials | null>(null);
  const [copied, setCopied] = React.useState<"clientId" | "clientSecret" | null>(null);

  const isClientCredentials = grant === "client_credentials" || service;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = window.prompt("Reason for registering this OIDC client:")?.trim();
    if (!reason) return;

    setBusy(true);
    setCreated(null);
    try {
      const client = await createAccountsOidcClient({
        name: name.trim(),
        redirectUris: isClientCredentials ? [] : splitList(redirectUris),
        postLogoutRedirectUris: isClientCredentials ? [] : splitList(postLogoutRedirectUris),
        ...(!isClientCredentials &&
          backchannelLogoutUri.trim() && { backchannelLogoutUri: backchannelLogoutUri.trim() }),
        ...(scopes.trim() && { scopes: splitList(scopes) }),
        firstParty,
        public: !isClientCredentials && publicClient,
        clientCredentials: !service && grant === "client_credentials",
        service,
        reason,
      });
      setCreated(client);
      setName("");
      setGrant("authorization_code");
      setRedirectUris("");
      setPostLogoutRedirectUris("");
      setBackchannelLogoutUri("");
      setScopes("");
      setFirstParty(false);
      setPublicClient(false);
      setService(false);
      toast.success("OIDC client registered. Copy its credentials now.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, field: "clientId" | "clientSecret") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={listPath} />}>
        <ArrowLeft />
        Back to OIDC clients
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Register OIDC client</h2>
        <p className="text-sm text-muted-foreground">
          Register an application with the Accounts identity provider. Client secrets are shown only once.
        </p>
      </div>

      <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-xl border p-5">
        <div className="space-y-1.5">
          <Label htmlFor="oidc-name">App name</Label>
          <Input
            id="oidc-name"
            maxLength={120}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={service}
            onChange={(event) => {
              const enabled = event.target.checked;
              setService(enabled);
              if (enabled) {
                setGrant("client_credentials");
                setPublicClient(false);
                setRedirectUris("");
                setPostLogoutRedirectUris("");
                setBackchannelLogoutUri("");
                setScopes("");
              }
            }}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Internal service client</span>
            <span className="block text-muted-foreground">
              Confidential client-credentials access with service scopes.
            </span>
          </span>
        </label>

        {!service && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="oidc-grant">Grant type</Label>
              <select
                id="oidc-grant"
                value={grant}
                onChange={(event) => {
                  const value = event.target.value as "authorization_code" | "client_credentials";
                  setGrant(value);
                  if (value === "client_credentials") {
                    setPublicClient(false);
                    setRedirectUris("");
                    setPostLogoutRedirectUris("");
                    setBackchannelLogoutUri("");
                  }
                }}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="authorization_code">Authorization code</option>
                <option value="client_credentials">Client credentials</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              {!isClientCredentials && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publicClient}
                    onChange={(event) => setPublicClient(event.target.checked)}
                  />
                  Public client (no secret)
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={firstParty}
                  onChange={(event) => setFirstParty(event.target.checked)}
                />
                First-party app (skip consent)
              </label>
            </div>
          </div>
        )}

        {isClientCredentials ? (
          <Field
            label={`Scopes (comma-separated${service ? ", optional" : ""})`}
            value={scopes}
            onChange={setScopes}
            placeholder={service ? "Uses configured service scopes" : "For example: reports:read"}
          />
        ) : (
          <>
            <Field
              label="Redirect URIs (comma-separated)"
              value={redirectUris}
              onChange={setRedirectUris}
              placeholder="https://app.example/callback"
              required
            />
            <Field
              label="Post-logout redirect URIs"
              value={postLogoutRedirectUris}
              onChange={setPostLogoutRedirectUris}
              placeholder="https://app.example/logout"
            />
            <Field
              label="Back-channel logout URI"
              value={backchannelLogoutUri}
              onChange={setBackchannelLogoutUri}
              placeholder="https://app.example/logout/backchannel"
            />
            <Field
              label="Scopes (comma-separated)"
              value={scopes}
              onChange={setScopes}
              placeholder="openid, profile, email"
            />
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Redirect and logout URIs must use HTTPS. HTTP is allowed only for localhost development.
          Leave scopes blank to use the Accounts default for this client type.
        </p>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Register OIDC client
        </Button>
      </form>

      {created && (
        <section
          className="max-w-3xl space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4" />
            Client registered
          </div>
          <p className="text-sm text-muted-foreground">
            Save these credentials now. The secret cannot be retrieved later.
          </p>
          <Credential
            label="Client ID"
            value={created.clientId}
            copied={copied === "clientId"}
            onCopy={() => void copy(created.clientId, "clientId")}
          />
          {created.clientSecret ? (
            <Credential
              label="Client secret"
              value={created.clientSecret}
              copied={copied === "clientSecret"}
              onCopy={() => void copy(created.clientSecret ?? "", "clientSecret")}
            />
          ) : (
            <p className="text-sm">Public client: no client secret was issued.</p>
          )}
          <p className="text-xs text-muted-foreground">Scopes: {created.scopes.join(", ")}</p>
          <Button variant="outline" nativeButton={false} render={<Link href={listPath} />}>
            Return to OIDC clients
          </Button>
        </section>
      )}
    </div>
  );
}

export function OidcClientEditPage({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loadState, setLoadState] = React.useState<{
    clientId: string;
    client?: AccountsOidcClient;
    error?: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [redirectUris, setRedirectUris] = React.useState("");
  const [postLogoutRedirectUris, setPostLogoutRedirectUris] = React.useState("");
  const [backchannelLogoutUri, setBackchannelLogoutUri] = React.useState("");
  const [scopes, setScopes] = React.useState("");
  const [firstParty, setFirstParty] = React.useState(false);
  const [active, setActive] = React.useState(true);
  const loaded = loadState?.clientId === clientId ? loadState : null;
  const client = loaded?.client ?? null;
  const loadError = loaded?.error ?? "";

  React.useEffect(() => {
    let current = true;
    getAccountsOidcClient(clientId)
      .then((loaded) => {
        if (!current) return;
        setLoadState({ clientId, client: loaded });
        setName(loaded.name);
        setRedirectUris(loaded.redirectUris.join(", "));
        setPostLogoutRedirectUris(loaded.postLogoutRedirectUris.join(", "));
        setBackchannelLogoutUri(loaded.backchannelLogoutUri ?? "");
        setScopes(loaded.allowedScopes.join(", "));
        setFirstParty(loaded.type === "first_party");
        setActive(loaded.isActive);
      })
      .catch((error: unknown) => {
        if (current) setLoadState({ clientId, error: msg(error) });
      });
    return () => {
      current = false;
    };
  }, [clientId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const reason = window.prompt(`Reason for updating ${client.name}:`)?.trim();
    if (!reason) return;

    setBusy(true);
    try {
      await updateAccountsOidcClient(client.clientId, {
        name: name.trim(),
        redirectUris: client.clientCredentialsEnabled ? [] : splitList(redirectUris),
        postLogoutRedirectUris: client.clientCredentialsEnabled ? [] : splitList(postLogoutRedirectUris),
        backchannelLogoutUri: backchannelLogoutUri.trim() || null,
        scopes: splitList(scopes),
        firstParty,
        isActive: active,
        reason,
      });
      toast.success("OIDC client updated.");
      router.push(listPath);
    } catch (error) {
      toast.error(msg(error));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={listPath} />}>
        <ArrowLeft />
        Back to OIDC clients
      </Button>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Edit OIDC client</h2>
        <p className="text-sm text-muted-foreground">
          Update the registered application settings.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="max-w-3xl rounded-xl border p-4 text-sm text-destructive">
          {loadError}
        </p>
      ) : !client ? (
        <p className="text-sm text-muted-foreground">Loading OIDC client...</p>
      ) : (
        <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-xl border p-5">
          <p className="break-all text-xs text-muted-foreground">Client ID: {client.clientId}</p>
          <Field label="App name" value={name} onChange={setName} required />
          {!client.clientCredentialsEnabled && (
            <>
              <Field
                label="Redirect URIs (comma-separated)"
                value={redirectUris}
                onChange={setRedirectUris}
                required
              />
              <Field
                label="Post-logout redirect URIs"
                value={postLogoutRedirectUris}
                onChange={setPostLogoutRedirectUris}
              />
            </>
          )}
          <Field
            label="Back-channel logout URI"
            value={backchannelLogoutUri}
            onChange={setBackchannelLogoutUri}
          />
          <Field label="Scopes (comma-separated)" value={scopes} onChange={setScopes} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={firstParty}
              onChange={(event) => setFirstParty(event.target.checked)}
            />
            First-party app (skip consent)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={listPath} />}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Credential({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} />
        <Button type="button" variant="outline" aria-label={`Copy ${label}`} onClick={onCopy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
