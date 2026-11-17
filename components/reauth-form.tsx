"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReauthForm() {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo");
      const returnTo =
        requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
          ? requestedReturnTo
          : "/";
      const response = await fetch(
        `/api/auth/reauth?returnTo=${encodeURIComponent(returnTo)}`,
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        returnTo?: string;
      };
      if (!response.ok || !body.returnTo) {
        throw new Error(body.message ?? "Could not verify your password.");
      }
      window.location.replace(body.returnTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg bg-card p-8 shadow-md">
      <div>
        <h2 className="text-2xl font-semibold">Confirm your sign-in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Re-enter your Admin 2 password to continue with this sensitive action.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reauth-password">Password</Label>
        <Input
          id="reauth-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Confirming..." : "Confirm"}
      </Button>
    </form>
  );
}
