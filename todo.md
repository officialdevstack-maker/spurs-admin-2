# Admin 2 TODO for Spurs Pay

Implement these phases in order. Later phases depend on the foundations in earlier phases. Each item notes whether the work belongs in Admin 2 or requires a new Pay endpoint.

## Done

- [x] Provider selection, API keys and webhook secret in Admin's encrypted store, served to Pay via `GET /api/config?app=pay`
- [x] Read-only `GET /api/internal/admin/stats` and `/checkouts`

## Phase A: Foundations (blocks every write action)

- [x] Per-admin identity from Admin 2's normal sign-in, signed to Pay instead of relying on the single `x-internal-secret`
- [x] Roles and permissions: viewer, operator, approver, super admin
- [ ] Audit log for every admin action: actor, IP, time, before/after values, reason (Pay provider changes are audited; wire each later write action)
- [x] Step-up re-authentication (password re-check within 300 seconds) for sensitive actions
- [ ] Pay: internal write API that requires an admin identity and the audit fields, with `internal_admin` rate limiting
- [x] Pay: stop accepting internal admin requests on the shared secret alone

## Phase B: Read-only operations views

- [x] Checkout list with filters (status, merchant, date, reference) and cursor pagination
- [x] Checkout detail: session, attempts, method, ledger transaction, timeline
- [x] Merchant list with volume and status
- [x] Webhook events: status, attempts, last error (`webhook_events`)
- [x] Suspense account entries
- [x] Redaction check: never show PAN, CVV, PINs, merchant secrets or full account numbers

## Phase C: Merchant management

- [x] Create merchant: name, `client_id`, return URL (must be HTTPS in production), ledger account
- [x] Approve, suspend and reactivate (`merchants.status`)
- [x] Credential issuance with one-time secret display, rotation, revocation and last-used time
- [x] Webhook config per merchant: URL, signing secret, retry policy, delivery log, manual redeliver
- [x] Merchant onboarding checklist and due-diligence notes
- [x] Pay: signed, retryable merchant webhook delivery

## Phase D: Service clients and access

- [x] Accounts OIDC clients: list, register, edit and deactivate in Admin 2 (secrets shown once)
- [ ] Manage which Accounts clients can call `/api/service/*`, and their scopes (`pay:service`, `pay:checkout`), replacing the `SERVICE_CLIENTS` env var
- [ ] Keep the guards: Pay's own client and the `pay` product can never be granted
- [ ] View and revoke active service tokens (introspection cache is 30s)

## Phase E: Policy and configuration

- [ ] Fees: card funding bps, per-merchant fees
- [ ] Limits: per transfer, daily, max balance, `maxAmountKobo`
- [ ] Checkout session expiry (currently 60 min) and bank-transfer grace window (24 h)
- [ ] Rate-limit rules
- [ ] Method availability, including the `cardTokenization` toggle once tokenization is approved
- [ ] Config versioning with change history and rollback
- [ ] Pay: read these from Admin config, not code constants

## Phase F: Payment operations

- [ ] Cancel an open checkout session
- [ ] Resolve attempts stuck in `unknown` by re-checking with the provider
- [ ] Reverse or refund a payment as a linked ledger reversal, with approver sign-off
- [ ] Suspense review: match, release or refund unmatched and wrong-amount deposits
- [ ] Webhook replay and retry of failed events (`processPendingEvents`)

## Phase G: Settlement and reconciliation

- [ ] Merchant settlement schedule, payout destination and status (pending, paid, failed)
- [ ] Reconciliation reports: provider clearing vs merchant liabilities vs settlement
- [ ] Exception queue for mismatches
- [ ] Export (CSV) for finance

## Phase H: Monitoring and alarms

- [ ] Ledger invariant check (`checkInvariants`) with an alert
- [ ] Alerts: pending-payment backlog, webhook backlog, provider failures (circuit-breaker logs), settlement failures
- [ ] Dashboard: completion rate, pending and unknown rate, reversal rate, by method
- [ ] Runbooks linked from each alert

## Phase I: Cleanup and hardening

- [ ] Legacy `product='pay'` wallets and funding records: report, migrate, retire (needs a migration plan first)
- [ ] Remove the legacy `/api/hooks/payments/[token]` route once Admin's webhook URL is in use
- [ ] Provider-name leak check applies to Admin-visible bank names shown to customers
- [ ] Security review: CSP, CSRF, IP allow-list or VPN for Admin, secret rotation procedure
- [ ] Tests for permissions, audit completeness and four-eyes approvals

## Decisions needed first

- Which actions need two people (refunds, provider switch, credential rotation)
- Who approves external merchants
- Whether Admin 2 reads Pay's database or uses only Pay's API (recommended: API only, matching the Wallet rule)

## Block Busters integration (Phase 1)

- [x] Add the `blockbusters` dashboard, permission catalog entries, role seed migration and API-only signed identity client
- [x] Add read proxy, audited write proxy, title overview/editor, direct-to-B2 upload UI and transcode queue
- [x] Add Block Busters internal admin API, private/public B2 support, schema migration and worker revalidation endpoint
- [x] Add the ffmpeg worker with safe job claiming, retries and stuck-job recovery
- [ ] Configure production RSA keys, Block Busters API URL, B2 buckets/CORS and worker credentials
- [ ] Apply migration `011_blockbusters_foundations.sql` in Admin 2 and the Block Busters Drizzle migration
- [ ] Deploy the Block Busters app and worker; validate a small real upload/transcode before publishing

Phase 2 collections, franchises and comment moderation remain deferred. Admin 2
must not query Block Busters' database or hold its B2 keys.
