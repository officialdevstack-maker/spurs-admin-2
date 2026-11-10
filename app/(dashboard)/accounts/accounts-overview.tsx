"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, UserCheck, Users } from "lucide-react";

import { ActiveUsersChart } from "@/components/active-users-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActiveUsersChart,
  getUserStats,
  listUsers,
  type ActiveUsersChartData,
  type ApiUser,
  type UserStats,
} from "@/lib/accounts-api";
import { formatDate } from "@/lib/format";

const RANGES = [7, 14, 30, 90] as const;

type Snapshot = { days: number; stats: UserStats; chart: ActiveUsersChartData };
type Failure = { days: number; message: string };

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

export default function AccountsOverviewPage() {
  const [days, setDays] = React.useState<number>(30);
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const [recent, setRecent] = React.useState<ApiUser[] | null>(null);
  const [recentError, setRecentError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    Promise.all([getUserStats(days), getActiveUsersChart(days)])
      .then(([stats, chart]) => {
        if (active) setSnapshot({ days, stats, chart });
      })
      .catch((cause: unknown) => {
        if (active) setFailure({ days, message: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [days]);

  React.useEffect(() => {
    let active = true;
    listUsers({ per_page: 5 })
      .then((res) => {
        if (active) setRecent(res.data);
      })
      .catch(() => {
        if (active) setRecentError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const current = snapshot?.days === days ? snapshot : null;
  const error = failure?.days === days ? failure.message : null;
  const loading = !current && !error;

  const stats = [
    {
      label: "Total users",
      value: current?.stats.totalUsers,
      icon: Users,
      href: "/accounts/list",
    },
    {
      label: `Active (last ${days} days)`,
      value: current?.stats.activeUsers,
      icon: UserCheck,
      href: "/accounts/list",
    },
    {
      label: "Suspended",
      value: current?.stats.suspendedUsers,
      icon: ShieldAlert,
      href: "/accounts/list?status=suspended",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Overview of users on the accounts service.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={range === days ? "default" : "outline"}
              onClick={() => setDays(range)}
            >
              {range}d
            </Button>
          ))}
        </div>
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
                  <p className="text-3xl font-semibold tabular-nums">{value ?? "—"}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily active users</CardTitle>
          <CardDescription>
            Distinct users who signed in each day. Users on long-lived sessions only count
            on days they sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : current ? (
            <ActiveUsersChart points={current.chart.points} />
          ) : (
            <p className="text-sm text-muted-foreground">Chart could not be loaded.</p>
          )}
        </CardContent>
      </Card>

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
          ) : recent?.length ? (
            recent.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.fullname}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {user.suspendedAt && <span className="text-destructive">Suspended</span>}
                  {!user.isVerified && <span>Unverified</span>}
                  <span>{formatDate(user.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              {recentError ? "Recent signups could not be loaded." : "No signups found."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
