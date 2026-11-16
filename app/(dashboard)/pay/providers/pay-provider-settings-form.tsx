"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPayProviderSettings,
  updatePayProviderSettings,
  type PayProviderSettings,
} from "@/lib/admin-api";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

export default function PayProviderSettingsForm() {
  const [settings, setSettings] = React.useState<PayProviderSettings | null>(null);
  const [secretKey, setSecretKey] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [clearSecretKey, setClearSecretKey] = React.useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    getPayProviderSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    try {
      const saved = await updatePayProviderSettings({
        provider: settings.provider,
        secretKey: secretKey || undefined,
        webhookSecret: webhookSecret || undefined,
        clearSecretKey,
        clearWebhookSecret,
      });
      setSettings(saved);
      setSecretKey("");
      setWebhookSecret("");
      setClearSecretKey(false);
      setClearWebhookSecret(false);
      toast.success("Pay provider settings saved.");
    } catch (cause) {
      setError(message(cause));
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
          <CardTitle>Active provider</CardTitle>
          <CardDescription>
            Flutterwave credentials are encrypted in the Admin database and delivered only to the
            Pay server. Sandbox mode is intended for local development.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pay-provider">Provider</Label>
            <select
              id="pay-provider"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={settings.provider}
              disabled={saving}
              onChange={(event) => {
                const provider =
                  event.target.value === "flutterwave" ? "flutterwave" : "sandbox";
                setSettings({ ...settings, provider });
              }}
            >
              <option value="sandbox">Sandbox</option>
              <option value="flutterwave">Flutterwave</option>
            </select>
          </div>

          <div className="space-y-5 border-t pt-5">
            <h3 className="text-sm font-medium">Flutterwave credentials</h3>
            <p className="text-sm text-muted-foreground">
              Both credentials are required before Flutterwave can be activated. Leave a field
              blank to keep its saved value.
            </p>
              <div className="space-y-2">
                <Label htmlFor="flutterwave-secret-key">Flutterwave secret key</Label>
                <Input
                  id="flutterwave-secret-key"
                  type="password"
                  autoComplete="new-password"
                  placeholder={settings.flutterwaveSecretKeySet ? "Saved" : "Enter secret key"}
                  value={secretKey}
                  disabled={saving || clearSecretKey}
                  onChange={(event) => setSecretKey(event.target.value)}
                />
                {settings.flutterwaveSecretKeySet && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={clearSecretKey}
                      disabled={saving}
                      onChange={(event) => {
                        setClearSecretKey(event.target.checked);
                        if (event.target.checked) setSecretKey("");
                      }}
                    />
                    Remove the saved secret key
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="flutterwave-webhook-secret">Webhook signing secret</Label>
                <Input
                  id="flutterwave-webhook-secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={settings.flutterwaveWebhookSecretSet ? "Saved" : "Enter webhook signing secret"}
                  value={webhookSecret}
                  disabled={saving || clearWebhookSecret}
                  onChange={(event) => setWebhookSecret(event.target.value)}
                />
                {settings.flutterwaveWebhookSecretSet && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={clearWebhookSecret}
                      disabled={saving}
                      onChange={(event) => {
                        setClearWebhookSecret(event.target.checked);
                        if (event.target.checked) setWebhookSecret("");
                      }}
                    />
                    Remove the saved webhook secret
                  </label>
                )}
              </div>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
        {saving ? "Saving..." : "Save provider settings"}
      </Button>
    </form>
  );
}
