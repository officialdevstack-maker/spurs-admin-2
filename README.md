This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Server configuration

Set these values in an untracked `.env.local` file or in the deployment environment. Do not use
`NEXT_PUBLIC_` prefixes for credentials:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=replace-with-at-least-32-random-bytes
SETTINGS_ENCRYPTION_KEY=replace-with-a-base64-encoded-32-byte-key
SESSION_COOKIE_INSECURE=false
APP_ORIGIN=https://admin.example.com
ACCOUNTS_API_URL=https://api.example.com
ACCOUNTS_INTERNAL_SECRET=same-value-as-INTERNAL_SHARED_SECRET-on-the-accounts-backend
```

For HTTP testing with a production build, set `SESSION_COOKIE_INSECURE=true` in `.env.local`.
Never enable this setting in production behind HTTPS.

`APP_ORIGIN` must be the admin panel's public origin (scheme and host, without a path). It is
used to validate state-changing request origins; configure it when the app is behind a reverse
proxy.

`SETTINGS_ENCRYPTION_KEY` encrypts saved SMTP passwords. Generate a key with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and keep it
private and backed up; saved passwords cannot be decrypted without the same key.

`ACCOUNTS_API_URL` must be the accounts backend origin (without an `/api` path).
`ACCOUNTS_INTERNAL_SECRET` must match the backend's `INTERNAL_SHARED_SECRET`.
The Accounts dashboard calls the backend's `/api/internal/...` endpoints through a
server-side proxy. If one of these routes returns 404 (for example,
`/api/internal/stats/users`), confirm `ACCOUNTS_API_URL` points to the `node-accounts`
backend and that its latest build has been deployed. The proxy uses only the configured
URL's origin and, outside production, logs the complete upstream URL and status for failed
requests. If that URL points back to the admin app, configure the accounts backend on a
different port and set `ACCOUNTS_API_URL` to that origin (for example,
`http://localhost:4000`); restart both apps after changing their port configuration.

The admin panel authenticates against the PostgreSQL `users` table. To apply pending migrations from the
`migrations` directory to the configured database, run:

```sh
npm run db:migrate
```

The runner loads local environment files, applies each migration once, and records applied
migrations in `admin_schema_migrations`. Migrations run transactionally. If the database already
has a `users` table, do not apply this standalone migration; use the existing table or adapt its
schema instead.

The migrations create an empty table with `id`, `fullname`, `email`, `password`, `is_admin`,
`suspended_at`, `admin_suspended_at`, and `updated_at` columns. `suspended_at` applies to the
main account; `admin_suspended_at` only blocks access to this panel. The migrations do not create an
admin account. To create the initial
admin, add `PANEL_ADMIN_FULLNAME`, `PANEL_ADMIN_EMAIL`, and `PANEL_ADMIN_PASSWORD` to your ignored
`.env.local` file, then run:

```sh
npm run db:create-admin
```

The command requires a password of at least 12 characters and no more than 72 UTF-8 bytes, stores
only a bcrypt hash, and refuses to change an account if that email already exists. Remove
`PANEL_ADMIN_PASSWORD` from `.env.local` after it succeeds. Only active users with `is_admin = true`
can sign in. Generate a session secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.

Changing a password in the panel also changes it for the user's main account. Existing access tokens
are not revoked. The Accounts API variables remain in use by the panel's Accounts API proxy.
The Accounts dashboard Settings page reads and updates the accounts service's whitelisted
settings through that proxy; apply the pending settings migration in `node-accounts/backend`
before using it.

## Server-to-server email API

The `POST /api/v1/email/send` endpoint sends email using the SMTP configuration saved in
**Settings → Email**. It requires a bearer API key and accepts `to` (one address or an array of
up to 50), `subject`, and at least one of `text` or `html`. Requests are limited to 60 per minute
per key per app instance.

Apply pending migrations with `npm run db:migrate`, then create a separate key for each calling
app by setting `API_KEY_NAME` and running `npm run db:create-api-key`. The generated `spk_...` key
is displayed once; store it as a secret in the calling app. To revoke a key, set its `revoked_at`
in the `api_keys` table, for example:

```sql
UPDATE api_keys SET revoked_at = now() WHERE name = 'accounts-backend' AND revoked_at IS NULL;
```

Call the endpoint only from the calling app's server, never from browser code:

```ts
await fetch(`${process.env.ADMIN_API_URL}/api/v1/email/send`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ADMIN_API_KEY}`,
  },
  body: JSON.stringify({
    to: "user@example.com",
    subject: "Welcome",
    text: "Thanks for signing up.",
  }),
});
```

Successful requests are recorded in `email_log`. The rate limiter is per application instance;
deployments with multiple instances should use a shared rate-limit store.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - learn more about the framework.
