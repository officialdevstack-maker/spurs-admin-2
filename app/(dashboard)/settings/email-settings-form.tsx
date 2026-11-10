"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmailSettings, updateEmailSettings, type EmailSettings } from "@/lib/admin-api";

const msg = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

export default function EmailSettingsForm() {
  const [settings, setSettings] = React.useState<EmailSettings | null>(null);
  const [password, setPassword] = React.useState("");
  const [clearPassword, setClearPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getEmailSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((cause) => {
        if (active) setError(msg(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    try {
      const { passwordSet: _passwordSet, ...config } = settings;
      const saved = await updateEmailSettings({
        ...config,
        password: password || undefined,
        clearPassword,
      });
      setSettings(saved);
      setPassword("");
      setClearPassword(false);
      toast.success("Email settings saved.");
    } catch (cause) {
      setError(msg(cause));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return error ? (
      <p role="alert" className="text-sm text-destructive">{error}</p>
    ) : (
      <Skeleton className="h-96 w-full" />
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            SMTP configuration used for all outgoing email across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={settings.enabled}
              disabled={saving}
              onChange={(event) => update("enabled", event.target.checked)}
            />
            <span className="text-sm font-medium">Enable outgoing email</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP host</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.example.com"
                value={settings.host}
                disabled={saving}
                onChange={(event) => update("host", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={settings.port}
                disabled={saving}
                onChange={(event) => update("port", Number(event.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={settings.secure}
              disabled={saving}
              onChange={(event) => update("secure", event.target.checked)}
            />
            <span className="text-sm">Use TLS from the start (usually port 465)</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-user">Username</Label>
              <Input
                id="smtp-user"
                autoComplete="off"
                value={settings.username}
                disabled={saving}
                onChange={(event) => update("username", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-pass">Password</Label>
              <Input
                id="smtp-pass"
                type="password"
                autoComplete="new-password"
                placeholder={settings.passwordSet ? "Saved password" : "Enter password"}
                value={password}
                disabled={saving || clearPassword}
                onChange={(event) => setPassword(event.target.value)}
              />
              {settings.passwordSet && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={clearPassword}
                    disabled={saving}
                    onChange={(event) => setClearPassword(event.target.checked)}
                  />
                  Remove the saved password
                </label>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from-name">From name</Label>
              <Input
                id="from-name"
                placeholder="Spurs"
                value={settings.fromName}
                disabled={saving}
                onChange={(event) => update("fromName", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-email">From email</Label>
              <Input
                id="from-email"
                type="email"
                placeholder="no-reply@example.com"
                value={settings.fromEmail}
                disabled={saving}
                onChange={(event) => update("fromEmail", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-to">Reply-to (optional)</Label>
            <Input
              id="reply-to"
              type="email"
              placeholder="support@example.com"
              value={settings.replyTo}
              disabled={saving}
              onChange={(event) => update("replyTo", event.target.value)}
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {saving ? "Saving..." : "Save email settings"}
      </Button>
    </form>
  );
}
