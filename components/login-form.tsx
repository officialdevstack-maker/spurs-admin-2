"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";

export function LoginForm() {
  React.useEffect(() => {
    let active = true;
    getSessionUser()
      .then((existing) => {
        if (active && existing) window.location.replace("/");
      })
      .catch((error: unknown) => {
        console.error("Could not verify panel session on login page:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-card p-8 shadow-md">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <p className="text-sm text-muted-foreground">
          Continue to <span className="font-medium text-foreground">Admin Panel</span> with Spurs
          Accounts.
        </p>
      </div>
      <Button asChild className="h-10 rounded-lg">
        <Link href="/api/auth/login">Continue with Spurs Accounts</Link>
      </Button>
    </div>
  );
}
