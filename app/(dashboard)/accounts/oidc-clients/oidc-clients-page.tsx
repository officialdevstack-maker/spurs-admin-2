"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  deactivateAccountsOidcClient,
  getAccountsOidcClient,
  listAccountsOidcClients,
  type AccountsOidcClient,
} from "@/lib/admin-api";
import { hasPermission } from "@/lib/permissions";

const msg = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

export default function OidcClientsPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user?.permissions ?? [], "accounts.oidc_clients.manage");
  const [clients, setClients] = React.useState<AccountsOidcClient[] | null>(null);
  const [loadError, setLoadError] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);
  const [busyClientId, setBusyClientId] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<AccountsOidcClient | null>(null);

  React.useEffect(() => {
    let active = true;
    listAccountsOidcClients()
      .then((rows) => {
        if (active) setClients(rows);
      })
      .catch((error: unknown) => {
        if (active) {
          setClients(null);
          setLoadError(msg(error));
        }
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  async function viewClient(clientId: string) {
    setBusyClientId(clientId);
    try {
      setViewing(await getAccountsOidcClient(clientId));
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusyClientId(null);
    }
  }

  async function deactivate(client: AccountsOidcClient) {
    if (
      !window.confirm(
        `Deactivate ${client.name}? Its record and consent grants will be retained. Previously issued access tokens can remain valid until they expire.`,
      )
    ) {
      return;
    }
    const reason = window.prompt(`Reason for deactivating ${client.name}:`)?.trim();
    if (!reason) return;

    setBusyClientId(client.clientId);
    try {
      const updated = await deactivateAccountsOidcClient(client.clientId, reason);
      setViewing(updated);
      setRefresh((value) => value + 1);
      toast.success("OIDC client deactivated.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setBusyClientId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Accounts OIDC clients</h2>
          <p className="text-sm text-muted-foreground">
            Manage applications registered with the Accounts identity provider.
          </p>
        </div>
        {canWrite && (
          <Button nativeButton={false} render={<Link href="/accounts/oidc-clients/new" />}>
            <Plus className="size-4" />
            Register client
          </Button>
        )}
      </div>

      <section className="space-y-3">
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        {clients === null && !loadError ? (
          <p className="text-sm text-muted-foreground">Loading OIDC clients...</p>
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
                      {client.type === "first_party" ? "First party" : "Third party"} ·{" "}
                      {client.clientCredentialsEnabled ? "Client credentials" : "Authorization code"} ·{" "}
                      {client.isConfidential ? "Confidential" : "Public"}
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyClientId !== null}
                          onClick={() => void viewClient(client.clientId)}
                        >
                          View
                        </Button>
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={
                              <Link
                                href={`/accounts/oidc-clients/${encodeURIComponent(client.clientId)}/edit`}
                              />
                            }
                          >
                            <Pencil className="size-3" />
                            Edit
                          </Button>
                        )}
                        {canWrite && client.isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyClientId !== null}
                            onClick={() => void deactivate(client)}
                          >
                            <Trash2 className="size-3" />
                            Deactivate
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
