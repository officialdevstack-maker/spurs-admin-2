"use client";

import * as React from "react";
import { Check, Copy, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAccountsOidcClient,
  deactivateAccountsOidcClient,
  getAccountsOidcClient,
  listAccountsOidcClients,
  updateAccountsOidcClient,
  type AccountsOidcClient,
  type OidcClientCredentials,
} from "@/lib/admin-api";
import { hasPermission } from "@/lib/permissions";

const msg = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");
const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function OidcClientsPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user?.permissions ?? [], "accounts.oidc_clients.manage");
  const [name, setName] = React.useState("");
  const [grant, setGrant] = React.useState<"authorization_code" | "client_credentials">("authorization_code");
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
  const [clients, setClients] = React.useState<AccountsOidcClient[] | null>(null);
  const [loadError, setLoadError] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);
  const [viewing, setViewing] = React.useState<AccountsOidcClient | null>(null);
  const [editing, setEditing] = React.useState<AccountsOidcClient | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editRedirectUris, setEditRedirectUris] = React.useState("");
  const [editPostLogoutUris, setEditPostLogoutUris] = React.useState("");
  const [editBackchannelUri, setEditBackchannelUri] = React.useState("");
  const [editScopes, setEditScopes] = React.useState("");
  const [editFirstParty, setEditFirstParty] = React.useState(false);
  const [editActive, setEditActive] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    listAccountsOidcClients()
      .then((rows) => {
        if (active) {
          setClients(rows);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(msg(error));
      });
    return () => { active = false; };
  }, [refresh]);

  async function copy(value: string, field: "clientId" | "clientSecret") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const reason = window.prompt("Reason for registering this OIDC client:")?.trim();
    if (!reason) return;
    setBusy(true);
    setCreated(null);
    try {
      const client = await createAccountsOidcClient({
        name: name.trim(),
        redirectUris: isClientCredentials ? [] : splitList(redirectUris),
        postLogoutRedirectUris: isClientCredentials ? [] : splitList(postLogoutRedirectUris),
        ...(!isClientCredentials && backchannelLogoutUri.trim() && { backchannelLogoutUri: backchannelLogoutUri.trim() }),
        ...(scopes.trim() && { scopes: splitList(scopes) }),
        firstParty,
        public: !isClientCredentials && publicClient,
        clientCredentials: !service && grant === "client_credentials",
        service,
        reason,
      });
      setCreated(client);
      setName("");
      setRefresh((value) => value + 1);
      toast.success("OIDC client registered. Copy its credentials now.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  async function viewClient(clientId: string) {
    setBusy(true);
    try {
      setViewing(await getAccountsOidcClient(clientId));
      setEditing(null);
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  function startEditing(client: AccountsOidcClient) {
    setEditing(client);
    setViewing(null);
    setEditName(client.name);
    setEditRedirectUris(client.redirectUris.join(", "));
    setEditPostLogoutUris(client.postLogoutRedirectUris.join(", "));
    setEditBackchannelUri(client.backchannelLogoutUri ?? "");
    setEditScopes(client.allowedScopes.join(", "));
    setEditFirstParty(client.type === "first_party");
    setEditActive(client.isActive);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const reason = window.prompt(`Reason for updating ${editing.name}:`)?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const updated = await updateAccountsOidcClient(editing.clientId, {
        name: editName.trim(),
        redirectUris: editing.clientCredentialsEnabled ? [] : splitList(editRedirectUris),
        postLogoutRedirectUris: editing.clientCredentialsEnabled ? [] : splitList(editPostLogoutUris),
        backchannelLogoutUri: editBackchannelUri.trim() || null,
        scopes: splitList(editScopes),
        firstParty: editFirstParty,
        isActive: editActive,
        reason,
      });
      setEditing(null);
      setViewing(updated);
      setRefresh((value) => value + 1);
      toast.success("OIDC client updated.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(client: AccountsOidcClient) {
    if (!window.confirm(`Deactivate ${client.name}? Its record and consent grants will be retained. Previously issued access tokens can remain valid until they expire.`)) return;
    const reason = window.prompt(`Reason for deactivating ${client.name}:`)?.trim();
    if (!reason) return;
    setBusy(true);
    try {
      const updated = await deactivateAccountsOidcClient(client.clientId, reason);
      setViewing(updated);
      setRefresh((value) => value + 1);
      toast.success("OIDC client deactivated.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusy(false);
    }
  }

  const isService = service;
  const isClientCredentials = grant === "client_credentials" || isService;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Accounts OIDC clients</h2>
        <p className="text-sm text-muted-foreground">
          Register, view, edit, and deactivate applications for the Accounts identity provider.
          Client secrets are shown only once.
        </p>
      </div>

      {canWrite && (
        <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-xl border p-5">
          <h3 className="font-semibold">Register client</h3>
          <div className="space-y-1.5">
            <Label htmlFor="oidc-name">App name</Label>
            <Input id="oidc-name" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} />
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
              <span className="block text-muted-foreground">Confidential client-credentials access with service scopes.</span>
            </span>
          </label>

          {!isService && (
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
                    <input type="checkbox" checked={publicClient} onChange={(event) => setPublicClient(event.target.checked)} />
                    Public client (no secret)
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={firstParty} onChange={(event) => setFirstParty(event.target.checked)} />
                  First-party app (skip consent)
                </label>
              </div>
            </div>
          )}

          {isClientCredentials ? (
            <div className="space-y-1.5">
              <Label htmlFor="oidc-scopes">Scopes (comma-separated{isService ? ", optional" : ""})</Label>
              <Input id="oidc-scopes" value={scopes} onChange={(event) => setScopes(event.target.value)} placeholder={isService ? "Uses configured service scopes" : "For example: reports:read"} />
            </div>
          ) : (
            <>
              <Field label="Redirect URIs (comma-separated)" value={redirectUris} onChange={setRedirectUris} placeholder="https://app.example/callback" required />
              <Field label="Post-logout redirect URIs" value={postLogoutRedirectUris} onChange={setPostLogoutRedirectUris} placeholder="https://app.example/logout" />
              <Field label="Back-channel logout URI" value={backchannelLogoutUri} onChange={setBackchannelLogoutUri} placeholder="https://app.example/logout/backchannel" />
              <Field label="Scopes (comma-separated)" value={scopes} onChange={setScopes} placeholder="openid, profile, email" />
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Redirect and logout URIs must use HTTPS. HTTP is allowed only for localhost development.
            Leave scopes blank to use the Accounts default for this client type.
          </p>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Register OIDC client
          </Button>
        </form>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Registered clients</h3>
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        {clients === null && !loadError ? (
          <Loader2 className="size-5 animate-spin" />
        ) : clients?.length ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Application</th>
                  <th className="px-4 py-3 font-medium">Type / grant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((client) => (
                  <tr key={client.clientId}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.clientId}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {client.type === "first_party" ? "First party" : "Third party"} · {client.clientCredentialsEnabled ? "Client credentials" : "Authorization code"} · {client.isConfidential ? "Confidential" : "Public"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={client.isActive ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>
                        {client.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {client.lastUsedAt ? new Date(client.lastUsedAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => viewClient(client.clientId)}>View</Button>
                        {canWrite && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => startEditing(client)}>
                            <Pencil className="mr-1 size-3" /> Edit
                          </Button>
                        )}
                        {canWrite && client.isActive && (
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => deactivate(client)}>
                            <Trash2 className="mr-1 size-3" /> Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">
            {loadError ? "Clients could not be loaded." : "No OIDC clients registered."}
          </p>
        )}
      </section>

      {viewing && (
        <section className="space-y-3 rounded-xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{viewing.name}</h3>
              <p className="text-xs text-muted-foreground">{viewing.clientId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>Close</Button>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Status" value={viewing.isActive ? "Active" : "Deactivated"} />
            <Detail label="Client type" value={viewing.type} />
            <Detail label="Grant" value={viewing.clientCredentialsEnabled ? "Client credentials" : "Authorization code"} />
            <Detail label="Confidential" value={viewing.isConfidential ? "Yes" : "No"} />
            <Detail label="Scopes" value={viewing.allowedScopes.join(", ")} />
            <Detail label="Created" value={new Date(viewing.createdAt).toLocaleString()} />
            <Detail label="Redirect URIs" value={viewing.redirectUris.join(", ") || "None"} />
            <Detail label="Post-logout URIs" value={viewing.postLogoutRedirectUris.join(", ") || "None"} />
            <Detail label="Back-channel logout" value={viewing.backchannelLogoutUri ?? "None"} />
            <Detail label="Last used" value={viewing.lastUsedAt ? new Date(viewing.lastUsedAt).toLocaleString() : "Never"} />
          </dl>
        </section>
      )}

      {editing && canWrite && (
        <form onSubmit={saveEdit} className="max-w-3xl space-y-4 rounded-xl border p-5">
          <h3 className="font-semibold">Edit {editing.name}</h3>
          <Field label="App name" value={editName} onChange={setEditName} required />
          {!editing.clientCredentialsEnabled && (
            <>
              <Field label="Redirect URIs (comma-separated)" value={editRedirectUris} onChange={setEditRedirectUris} required />
              <Field label="Post-logout redirect URIs" value={editPostLogoutUris} onChange={setEditPostLogoutUris} />
            </>
          )}
          <Field label="Back-channel logout URI" value={editBackchannelUri} onChange={setEditBackchannelUri} />
          <Field label="Scopes (comma-separated)" value={editScopes} onChange={setEditScopes} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editFirstParty} onChange={(event) => setEditFirstParty(event.target.checked)} />
            First-party app (skip consent)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} />
            Active
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !editName.trim()}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save changes
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {created && (
        <section className="max-w-3xl space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-5" aria-live="polite">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4" /> Client registered
          </div>
          <p className="text-sm text-muted-foreground">Save these credentials now. The secret cannot be retrieved later.</p>
          <Credential label="Client ID" value={created.clientId} copied={copied === "clientId"} onCopy={() => copy(created.clientId, "clientId")} />
          {created.clientSecret ? (
            <Credential label="Client secret" value={created.clientSecret} copied={copied === "clientSecret"} onCopy={() => copy(created.clientSecret ?? "", "clientSecret")} />
          ) : (
            <p className="text-sm">Public client: no client secret was issued.</p>
          )}
          <p className="text-xs text-muted-foreground">Scopes: {created.scopes.join(", ")}</p>
        </section>
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
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
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
