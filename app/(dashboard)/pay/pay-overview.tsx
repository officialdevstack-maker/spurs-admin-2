"use client";

import * as React from "react";
import { CreditCard, Store, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPayStats, type PayStats } from "@/lib/pay-api";

export default function PayOverview() {
  const [stats, setStats] = React.useState<PayStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getPayStats()
      .then((result) => {
        if (active) setStats(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Something went wrong.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    { title: "Pay users", value: stats?.users, icon: Users },
    { title: "Merchants", value: stats?.merchants, icon: Store },
    { title: "Open checkouts", value: stats?.checkouts.open, icon: CreditCard },
    { title: "Paid checkouts", value: stats?.checkouts.paid, icon: CreditCard },
    { title: "Cancelled checkouts", value: stats?.checkouts.cancelled, icon: CreditCard },
    { title: "Expired checkouts", value: stats?.checkouts.expired, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Spurs Pay</h2>
        <p className="text-sm text-muted-foreground">
          Pay users, merchants, and checkout status totals.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="size-4" />
                {title}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {value === undefined ? "—" : value.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {stats ? "Current total" : error ? "Unavailable" : "Loading"}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
