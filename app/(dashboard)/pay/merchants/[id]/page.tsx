"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePayMerchantCredentials,
  getPayMerchantCredentials,
  redeliverPayMerchantWebhook,
  rotatePayMerchantWebhookSecret,
  savePayMerchantOnboarding,
  savePayMerchantWebhook,
  type MerchantCredentialStatus,
} from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import {
  getPayMerchant,
  getPayMerchantOnboarding,
  getPayMerchantWebhook,
  type PayMerchantDetail,
  type PayMerchantOnboarding,
  type PayMerchantWebhook,
} from "@/lib/pay-api";
import { hasPermission } from "@/lib/permissions";

const msg = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");
const checklistLabels = {
  registrationVerified: "Business registration verified",
  ownershipVerified: "Beneficial ownership verified",
  settlementAccountVerified: "Settlement account verified",
  riskReviewComplete: "Risk review complete",
} as const;

function reasonFor(action: string) {
  const reason = window.prompt(`Reason to ${action}:`)?.trim();
  return reason || null;
}

function SecretNotice({ label, secret, onDismiss }: { label: string; secret: string; onDismiss: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="font-medium">{label}: copy this secret now. It will not be shown again.</p>
      <Input aria-label="One-time signing secret" readOnly type="password" value={secret} />
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(secret).then(
            () => toast.success("Secret copied."),
            () => toast.error("Could not copy the secret."),
          )}
        >
          Copy secret
        </Button>
        <Button variant="outline" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}

export default function PayMerchantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const canWrite = hasPermission(user?.permissions ?? [], "pay.write");
  const canApprove = hasPermission(user?.permissions ?? [], "pay.approve");
  const [reload, setReload] = React.useState(0);
  const [oneTimeSecret, setOneTimeSecret] = React.useState<{ label: string; secret: string } | null>(null);
  const [result, setResult] = React.useState<{
    key: string;
    merchant?: PayMerchantDetail;
    credentials?: MerchantCredentialStatus;
    webhook?: PayMerchantWebhook;
    onboarding?: PayMerchantOnboarding;
    error?: string;
  } | null>(null);
  const key = `${id}:${reload}`;

  React.useEffect(() => {
    let active = true;
    Promise.all([
      getPayMerchant(id),
      getPayMerchantCredentials(id),
      getPayMerchantWebhook(id),
      getPayMerchantOnboarding(id),
    ])
      .then(([merchant, credentials, webhook, onboarding]) => {
        if (active) {
          setResult({
            key,
            merchant: merchant.merchant,
            credentials,
            webhook,
            onboarding,
          });
        }
      })
      .catch((cause: unknown) => active && setResult({ key, error: msg(cause) }));
    return () => {
      active = false;
    };
  }, [id, key]);

  const current = result?.key === key ? result : null;
  if (!current) return <p className="text-sm text-muted-foreground">Loading merchant…</p>;
  if (current.error || !current.merchant || !current.credentials || !current.webhook || !current.onboarding) {
    return <p role="alert" className="text-sm text-destructive">{current.error ?? "Merchant details could not be loaded."}</p>;
  }

  return (
    <MerchantManager
      key={key}
      merchant={current.merchant}
      credentials={current.credentials}
      webhook={current.webhook}
      onboarding={current.onboarding}
      oneTimeSecret={oneTimeSecret}
      onSecret={setOneTimeSecret}
      canWrite={canWrite}
      canApprove={canApprove}
      onReload={() => setReload((value) => value + 1)}
    />
  );
}

function MerchantManager({
  merchant,
  credentials,
  webhook,
  onboarding,
  oneTimeSecret,
  onSecret,
  canWrite,
  canApprove,
  onReload,
}: {
  merchant: PayMerchantDetail;
  credentials: MerchantCredentialStatus;
  webhook: PayMerchantWebhook;
  onboarding: PayMerchantOnboarding;
  oneTimeSecret: { label: string; secret: string } | null;
  onSecret: (secret: { label: string; secret: string } | null) => void;
  canWrite: boolean;
  canApprove: boolean;
  onReload: () => void;
}) {
  const [url, setUrl] = React.useState(webhook.config?.url ?? "");
  const [maxAttempts, setMaxAttempts] = React.useState(webhook.config?.maxAttempts ?? 8);
  const [enabled, setEnabled] = React.useState(webhook.config?.enabled ?? true);
  const [checklist, setChecklist] = React.useState(onboarding.checklist);
  const [notes, setNotes] = React.useState(onboarding.dueDiligenceNotes);
  const [saving, setSaving] = React.useState(false);

  async function changeCredentials(action: "rotate" | "revoke") {
    const reason = reasonFor(`${action} credentials for ${merchant.name}`);
    if (!reason) return;
    if (action === "revoke" && !window.confirm(`Revoke credentials for ${merchant.name}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const result = await changePayMerchantCredentials(merchant.id, action, reason);
      if (action === "rotate" && "clientSecret" in result) {
        onSecret({ label: "OAuth client secret", secret: result.clientSecret });
      }
      toast.success(action === "rotate" ? "Credentials rotated." : "Credentials revoked.");
      onReload();
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveWebhook(event: React.FormEvent) {
    event.preventDefault();
    const reason = reasonFor(`${webhook.config ? "update" : "configure"} the webhook`);
    if (!reason) return;
    setSaving(true);
    try {
      const result = await savePayMerchantWebhook(
        merchant.id,
        { url, maxAttempts, enabled, reason },
        !webhook.config,
      );
      if (result.signingSecret) onSecret({ label: "Webhook signing secret", secret: result.signingSecret });
      toast.success("Webhook settings saved.");
      onReload();
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setSaving(false);
    }
  }

  async function rotateWebhookSecret() {
    const reason = reasonFor("rotate the webhook signing secret");
    if (!reason) return;
    setSaving(true);
    try {
      const result = await rotatePayMerchantWebhookSecret(merchant.id, reason);
      onSecret({ label: "Webhook signing secret", secret: result.signingSecret });
      toast.success("Webhook signing secret rotated.");
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setSaving(false);
    }
  }

  async function redeliver(deliveryId: string) {
    const reason = reasonFor("redeliver this webhook");
    if (!reason) return;
    setSaving(true);
    try {
      await redeliverPayMerchantWebhook(merchant.id, deliveryId, reason);
      toast.success("Webhook queued for redelivery.");
      onReload();
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveOnboarding(event: React.FormEvent) {
    event.preventDefault();
    const reason = reasonFor("save onboarding details");
    if (!reason) return;
    setSaving(true);
    try {
      await savePayMerchantOnboarding(merchant.id, { checklist, dueDiligenceNotes: notes, reason });
      toast.success("Onboarding details saved.");
      onReload();
    } catch (error) {
      toast.error(msg(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/pay/merchants" className="text-sm text-muted-foreground hover:underline">← Merchants</Link>
        <div>
          <h1 className="text-2xl font-semibold">{merchant.name}</h1>
          <p className="text-sm text-muted-foreground">
            {merchant.status} · Client ID {merchant.clientId} · Created {formatDateTime(merchant.createdAt)}
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">OAuth credentials</h2>
          <p className="text-sm text-muted-foreground">
            {credentials.isActive ? "Active" : "Revoked"} · Last used {credentials.lastUsedAt ? formatDateTime(credentials.lastUsedAt) : "Never"}
          </p>
        </div>
        {oneTimeSecret && oneTimeSecret.label === "OAuth client secret" && (
          <SecretNotice
            label={oneTimeSecret.label}
            secret={oneTimeSecret.secret}
            onDismiss={() => onSecret(null)}
          />
        )}
        {canWrite && (
          <div className="flex gap-2">
            <Button disabled={saving || !credentials.isActive} onClick={() => void changeCredentials("rotate")}>
              Rotate credentials
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !credentials.isActive}
              onClick={() => void changeCredentials("revoke")}
            >
              Revoke credentials
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Webhook configuration</h2>
          <p className="text-sm text-muted-foreground">
            Events: payment.succeeded, payment.reversed, checkout.expired · HMAC-SHA256 signature
          </p>
        </div>
        {oneTimeSecret && oneTimeSecret.label === "Webhook signing secret" && (
          <SecretNotice
            label={oneTimeSecret.label}
            secret={oneTimeSecret.secret}
            onDismiss={() => onSecret(null)}
          />
        )}
        <form onSubmit={saveWebhook} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">HTTPS endpoint URL</Label>
            <Input id="webhook-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-attempts">Maximum delivery attempts</Label>
            <Input
              id="webhook-attempts"
              type="number"
              min={1}
              max={8}
              required
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>
          {canWrite && <Button disabled={saving} type="submit">{webhook.config ? "Save webhook" : "Create webhook"}</Button>}
          {webhook.config && canApprove && (
            <Button disabled={saving} type="button" variant="outline" onClick={() => void rotateWebhookSecret()}>
              Rotate signing secret
            </Button>
          )}
        </form>

        <div className="space-y-3">
          <h3 className="font-medium">Recent deliveries</h3>
          {!webhook.deliveries.length ? (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {webhook.deliveries.map((delivery) => (
                <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">{delivery.eventType} · {delivery.status} · {delivery.attemptCount} attempts</p>
                    <p className="text-muted-foreground">
                      {formatDateTime(delivery.createdAt)}
                      {delivery.lastStatusCode ? ` · HTTP ${delivery.lastStatusCode}` : ""}
                      {delivery.lastError ? ` · ${delivery.lastError}` : ""}
                    </p>
                    {delivery.attempts.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {delivery.attempts.map((attempt) => (
                          <li key={attempt.attemptNumber}>
                            Attempt {attempt.attemptNumber}: {attempt.status}
                            {attempt.responseStatus ? ` · HTTP ${attempt.responseStatus}` : ""}
                            {attempt.error ? ` · ${attempt.error}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {delivery.status === "failed" && canWrite && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => void redeliver(delivery.id)}>
                      Redeliver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Onboarding and due diligence</h2>
          <p className="text-sm text-muted-foreground">
            {onboarding.updatedAt ? `Last updated ${formatDateTime(onboarding.updatedAt)}` : "Not yet recorded"}
          </p>
        </div>
        <form onSubmit={saveOnboarding} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(checklistLabels) as (keyof typeof checklistLabels)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))}
                />
                {checklistLabels[key]}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-diligence-notes">Due-diligence notes</Label>
            <textarea
              id="due-diligence-notes"
              className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={5000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {canWrite && <Button disabled={saving} type="submit">Save onboarding</Button>}
        </form>
      </section>
    </div>
  );
}
