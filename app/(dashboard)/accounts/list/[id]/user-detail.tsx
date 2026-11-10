"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  KeyRound,
  Loader2,
  Monitor,
  ShieldCheck,
  ShieldOff,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { UserBadges } from "@/components/user-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getUser,
  revokeUserSessions,
  suspendUser,
  unsuspendUser,
  verifyUserEmail,
  type UserDetail,
} from "@/lib/accounts-api";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";

type Action = "verify" | "revoke" | "suspend" | "unsuspend";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

const humanize = (event: string) => {
  const text = event.replace(/[_.\-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          {label}
          <Icon className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <p className="text-lg font-semibold capitalize">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

const CONFIRM_COPY: Record<
  "suspend" | "revoke",
  { title: string; description: (name: string) => string; button: string }
> = {
  suspend: {
    title: "Suspend this account?",
    description: (name) =>
      `${name} will be blocked from signing in until the account is restored.`,
    button: "Suspend account",
  },
  revoke: {
    title: "Revoke all sessions?",
    description: (name) => `${name} will be signed out of all devices and apps.`,
    button: "Revoke sessions",
  },
};

export default function UserDetailView() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = React.useState<{ id: string; detail: UserDetail } | null>(null);
  const [failure, setFailure] = React.useState<{ id: string; message: string } | null>(null);
  const [reload, setReload] = React.useState(0);
  const [busy, setBusy] = React.useState<Action | null>(null);
  const [confirm, setConfirm] = React.useState<"suspend" | "revoke" | null>(null);

  React.useEffect(() => {
    let active = true;
    getUser(id)
      .then((detail) => {
        if (active) {
          setResult({ id, detail });
          setFailure(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setFailure({ id, message: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [id, reload]);

  const detail = result?.id === id ? result.detail : null;
  const error = failure?.id === id ? failure.message : null;
  const loading = !detail && !error;
  const user = detail?.user;
  const recentActivity = detail?.activity.slice(0, 8) ?? [];

  async function run(action: Action) {
    if (!user) return;
    setBusy(action);
    try {
      if (action === "verify") await verifyUserEmail(user.id);
      if (action === "revoke") await revokeUserSessions(user.id);
      if (action === "suspend") await suspendUser(user.id);
      if (action === "unsuspend") await unsuspendUser(user.id);
      toast.success(
        {
          verify: "Email verified.",
          revoke: "All sessions revoked.",
          suspend: "Account suspended.",
          unsuspend: "Account restored.",
        }[action],
      );
      setConfirm(null);
      setReload((value) => value + 1);
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  const initials = (user?.fullname ?? "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/accounts/list" />}>
        <ArrowLeft /> Back to accounts
      </Button>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {loading ? (
              <Skeleton className="size-16 rounded-full" />
            ) : (
              <Avatar className="size-16 text-lg">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullname} />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 space-y-1.5">
              {loading ? (
                <>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-56" />
                </>
              ) : user ? (
                <>
                  <h2 className="truncate text-2xl font-semibold tracking-tight">
                    {user.fullname}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <UserBadges user={user} />
                </>
              ) : (
                <h2 className="text-2xl font-semibold tracking-tight">Account #{id}</h2>
              )}
            </div>
          </div>

          {user && (
            <div className="flex flex-wrap gap-2">
              {!user.isVerified && (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void run("verify")}
                >
                  {busy === "verify" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  Verify email
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => setConfirm("revoke")}
              >
                <KeyRound /> Revoke sessions
              </Button>
              {!user.isAdmin &&
                (user.suspendedAt ? (
                  <Button disabled={busy !== null} onClick={() => void run("unsuspend")}>
                    {busy === "unsuspend" ? <Loader2 className="animate-spin" /> : <ShieldOff />}
                    Restore account
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() => setConfirm("suspend")}
                  >
                    <ShieldOff /> Suspend account
                  </Button>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Account type"
          value={user?.accountType}
          icon={UserRound}
          loading={loading}
        />
        <StatTile
          label="Member since"
          value={formatDate(user?.createdAt)}
          icon={Calendar}
          loading={loading}
        />
        <StatTile
          label="Active devices"
          value={detail?.devices.length ?? 0}
          icon={Monitor}
          loading={loading}
        />
        <StatTile
          label="Last activity"
          value={formatRelative(detail?.activity[0]?.createdAt)}
          icon={KeyRound}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="self-start lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Basic information for this account.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : user ? (
              <dl className="grid gap-4">
                <Field label="ID" value={user.id} />
                <Field label="Full name" value={user.fullname} />
                <Field label="Email" value={user.email} />
                <Field label="Phone" value={user.phone} />
                <Field
                  label="Email verification"
                  value={user.isVerified ? "Verified" : "Not verified"}
                />
                <Field label="Created" value={formatDateTime(user.createdAt)} />
                <Field label="Last updated" value={formatDateTime(user.updatedAt)} />
                {user.suspendedAt && (
                  <Field label="Suspended at" value={formatDateTime(user.suspendedAt)} />
                )}
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>Active sign-ins for this account.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : detail?.devices.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Device</th>
                        <th className="py-2 pr-4 font-medium">IP address</th>
                        <th className="py-2 pr-4 font-medium">Signed in</th>
                        <th className="py-2 font-medium">Last used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.devices.map((device) => (
                        <tr key={device.id}>
                          <td className="py-2 pr-4">
                            <span className="flex items-center gap-2">
                              <Monitor className="size-4 text-muted-foreground" />
                              {device.deviceName ?? "Unknown device"}
                              {device.current && (
                                <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                                  Current
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {device.ipAddress ?? "—"}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {formatDateTime(device.signedInAt)}
                          </td>
                          <td
                            className="py-2 text-muted-foreground"
                            title={formatDateTime(device.lastUsedAt)}
                          >
                            {formatRelative(device.lastUsedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active devices.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest events recorded for this account.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : recentActivity.length ? (
                <ol className="relative space-y-4 border-l pl-5">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{humanize(item.event)}</p>
                          <p className="text-xs text-muted-foreground">
                            {[item.deviceName, item.ipAddress].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <span
                          className="text-xs text-muted-foreground"
                          title={formatDateTime(item.createdAt)}
                        >
                          {formatRelative(item.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          {confirm && user && (
            <>
              <DialogHeader>
                <DialogTitle>{CONFIRM_COPY[confirm].title}</DialogTitle>
                <DialogDescription>
                  {CONFIRM_COPY[confirm].description(user.fullname)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => setConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={confirm === "suspend" ? "destructive" : "default"}
                  disabled={busy !== null}
                  onClick={() => void run(confirm)}
                >
                  {busy === confirm && <Loader2 className="animate-spin" />}
                  {CONFIRM_COPY[confirm].button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
