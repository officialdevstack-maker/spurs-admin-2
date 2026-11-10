This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Server configuration

Set these values in an untracked `.env.local` file or in the deployment environment. Do not use
`NEXT_PUBLIC_` prefixes for credentials:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=replace-with-at-least-32-random-bytes
SESSION_COOKIE_INSECURE=false
ACCOUNTS_API_URL=https://api.example.com
ACCOUNTS_INTERNAL_SECRET=same-value-as-INTERNAL_SHARED_SECRET-on-the-accounts-backend
```

For HTTP testing with a production build, set `SESSION_COOKIE_INSECURE=true` in `.env.local`.
Never enable this setting in production behind HTTPS.

`ACCOUNTS_API_URL` must be the accounts backend origin (without an `/api` path).
`ACCOUNTS_INTERNAL_SECRET` must match the backend's `INTERNAL_SHARED_SECRET`.

The admin panel authenticates against the PostgreSQL `users` table. To apply pending migrations from the
`migrations` directory to the configured database, run:

```sh
npm run db:migrate
```

The runner loads local environment files, applies each migration once, and records applied
migrations in `admin_schema_migrations`. Migrations run transactionally. If the database already
has a `users` table, do not apply this standalone migration; use the existing table or adapt its
schema instead.

The migration creates an empty table with `id`, `fullname`, `email`, `password`, `is_admin`,
`suspended_at`, and `updated_at` columns. It does not create an admin account. To create the initial
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
