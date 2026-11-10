"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import { UserBadges } from "@/components/user-badges";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  listUsers,
  revokeUserSessions,
  suspendUser,
  unsuspendUser,
  verifyUserEmail,
  type ApiUser,
  type UserListResponse,
} from "@/lib/accounts-api";
import { formatDate } from "@/lib/format";
import { hasPermission, type PermissionName } from "@/lib/permissions";

type StatusFilter = "all" | "suspended";
type Notice = { kind: "success" | "error"; message: string };

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

export default function AccountsList({ initialStatus }: { initialStatus: StatusFilter }) {
  const { user: admin } = useAuth();
  const can = (permission: PermissionName) => hasPermission(admin?.permissions, permission);
  const [status, setStatus] = React.useState<StatusFilter>(initialStatus);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<{ key: string; response: UserListResponse } | null>(null);
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<{ key: string; message: string } | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [busyUser, setBusyUser] = React.useState<number | null>(null);
  const [reload, setReload] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const queryKey = JSON.stringify([page, search, status, reload]);

  React.useEffect(() => {
    let active = true;
    listUsers({
      page,
      per_page: 15,
      search: search || undefined,
      status: status === "suspended" ? "suspended" : undefined,
    })
      .then((response) => {
        if (active) {
          setResult({ key: queryKey, response });
          setFailure(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setFailure({ key: queryKey, message: errorMessage(cause) });
      })
      .finally(() => {
        if (active) setLoadedKey(queryKey);
      });

    return () => {
      active = false;
    };
  }, [page, queryKey, reload, search, status]);

  async function performAction(user: ApiUser, action: "suspend" | "unsuspend" | "verify" | "revoke") {
    const prompts = {
      suspend: `Suspend ${user.fullname}'s account?`,
      revoke: `Sign ${user.fullname} out of all devices and apps?`,
    };
    if ((action === "suspend" || action === "revoke") && !window.confirm(prompts[action])) return;

    setBusyUser(user.id);
    setNotice(null);
    try {
      if (action === "suspend") await suspendUser(user.id);
      if (action === "unsuspend") await unsuspendUser(user.id);
      if (action === "verify") await verifyUserEmail(user.id);
      if (action === "revoke") await revokeUserSessions(user.id);
      setNotice({ kind: "success", message: "Account updated." });
      setReload((value) => value + 1);
    } catch (cause) {
      setNotice({ kind: "error", message: errorMessage(cause) });
    } finally {
      setBusyUser(null);
    }
  }

  const currentResult = result?.key === queryKey ? result.response : null;
  const users = currentResult?.data ?? [];
  const meta = currentResult?.meta;
  const loading = loadedKey !== queryKey;
  const error = failure?.key === queryKey ? failure.message : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Search and manage user accounts on the accounts service.
          </p>
        </div>
        {can("accounts.create") && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New user
          </Button>
        )}
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search accounts"
            className="pl-9"
            placeholder="Search name or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <select
          aria-label="Account status"
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as StatusFilter);
          }}
        >
          <option value="all">All accounts</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button type="submit">Search</Button>
      </form>

      {notice && (
        <p
          role="status"
          className={notice.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {notice.message}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Loading accounts…</td></tr>
            ) : users.length ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.fullname}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize">{user.accountType}</td>
                  <td className="px-4 py-3"><UserBadges user={user} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              aria-label={`Actions for ${user.fullname}`}
                              disabled={busyUser === user.id}
                              size="icon-sm"
                              variant="ghost"
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem render={<Link href={`/accounts/list/${user.id}`} />}>
                            <Eye /> View details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!user.isVerified && can("accounts.verify") && (
                            <DropdownMenuItem onClick={() => void performAction(user, "verify")}>
                              <ShieldCheck /> Verify email
                            </DropdownMenuItem>
                          )}
                          {can("accounts.revoke_sessions") && (
                            <DropdownMenuItem onClick={() => void performAction(user, "revoke")}>
                              <KeyRound /> Revoke sessions
                            </DropdownMenuItem>
                          )}
                          {!user.isAdmin && can("accounts.suspend") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant={user.suspendedAt ? "default" : "destructive"}
                                onClick={() =>
                                  void performAction(user, user.suspendedAt ? "unsuspend" : "suspend")
                                }
                              >
                                <ShieldOff /> {user.suspendedAt ? "Restore account" : "Suspend account"}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                  {error ? "Accounts could not be loaded." : "No accounts found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          {meta ? `${meta.from ?? 0}–${meta.to ?? 0} of ${meta.total}` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            aria-label="Previous page"
            disabled={loading || page <= 1}
            size="sm"
            variant="outline"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft /> Previous
          </Button>
          <span className="self-center text-muted-foreground">
            Page {meta?.currentPage ?? page} of {meta?.lastPage ?? 1}
          </span>
          <Button
            aria-label="Next page"
            disabled={loading || !meta || page >= meta.lastPage}
            size="sm"
            variant="outline"
            onClick={() => setPage((value) => value + 1)}
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(user) => {
          setPage(1);
          setStatus("all");
          setNotice({ kind: "success", message: `${user.fullname} was created.` });
          setReload((value) => value + 1);
        }}
      />
    </div>
  );
}
