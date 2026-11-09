"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, UserCheck, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listUsers, type ApiUser } from "@/lib/accounts-api";

type Overview = { total: number; suspended: number; recent: ApiUser[] };

export default function AccountsOverviewPage() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    Promise.all([
      listUsers({ per_page: 5 }),
      listUsers({ status: "suspended", per_page: 1 }),
    ])
      .then(([all, suspended]) => {
        if (!all.meta || !suspended.meta) {
          throw new Error("Accounts service response is missing pagination metadata.");
        }
        if (active) {
          setData({
            total: all.meta.total,
            suspended: suspended.meta.total,
            recent: all.data,
          });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Something went wrong.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: "Total users", value: data?.total, icon: Users, href: "/users" },
    {
      label: "Active",
      value: data ? data.total - data.suspended : undefined,
      icon: UserCheck,
      href: "/users",
    },
    {
      label: "Suspended",
      value: data?.suspended,
      icon: ShieldAlert,
      href: "/users?status=suspended",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Overview of users on the accounts service.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  {label}
                  <Icon className="size-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-semibold tabular-nums">
                    {value ?? "—"}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent signups</CardTitle>
          <CardDescription>The five newest accounts.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {loading ? (
            Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="my-2 h-10 w-full" />
            ))
          ) : data?.recent.length ? (
            data.recent.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.fullname}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {user.suspendedAt && (
                    <span className="text-destructive">Suspended</span>
                  )}
                  {!user.isVerified && <span>Unverified</span>}
                  <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              {error ? "Recent signups could not be loaded." : "No signups found."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
