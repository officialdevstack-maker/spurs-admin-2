"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAccountSettings,
  updateAccountSettings,
  type AccountSettings,
} from "@/lib/accounts-api";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

export default function AccountSettingsForm() {
  const [settings, setSettings] = React.useState<AccountSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getAccountSettings()
      .then((value) => {
        if (active) {
          setSettings(value);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await updateAccountSettings(settings);
      setSettings(saved);
      setNotice("Account settings saved.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Account settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure registration and contact details for the accounts service.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading account settings…</p>
      ) : settings ? (
        <form className="space-y-4" onSubmit={save}>
          <Card>
            <CardHeader>
              <CardTitle>Registration</CardTitle>
              <CardDescription>
                When disabled, new account registration requests are rejected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={settings.registration_enabled}
                  disabled={saving}
                  onChange={(event) =>
                    setSettings({ ...settings, registration_enabled: event.target.checked })
                  }
                />
                <span className="text-sm font-medium">Allow new registrations</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service</CardTitle>
              <CardDescription>
                Store service status and the support contact. The maintenance flag does not
                block requests by itself.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={settings.maintenance_mode}
                  disabled={saving}
                  onChange={(event) =>
                    setSettings({ ...settings, maintenance_mode: event.target.checked })
                  }
                />
                <span className="text-sm font-medium">Maintenance mode flag</span>
              </label>
              <div className="space-y-2">
                <Label htmlFor="support-email">Support email</Label>
                <Input
                  id="support-email"
                  type="email"
                  maxLength={254}
                  placeholder="support@example.com"
                  value={settings.support_email}
                  disabled={saving}
                  onChange={(event) =>
                    setSettings({ ...settings, support_email: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to clear the contact address.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save account settings"}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Account settings could not be loaded.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
