This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Server configuration

Set these values in an untracked `.env.local` file or in the deployment environment. Do not use
`NEXT_PUBLIC_` prefixes for credentials:

```env
DATABASE_URL=postgres://user:password@host:5432/database
SESSION_SECRET=replace-with-at-least-32-random-bytes
ACCOUNTS_API_URL=https://api.example.com
ACCOUNTS_ADMIN_EMAIL=panel-service@example.com
ACCOUNTS_ADMIN_PASSWORD=replace-with-the-dedicated-admin-password
```

The panel authenticates against the PostgreSQL `users` table. To apply pending migrations from the
`migrations` directory to the configured database, run:

```sh
npm run db:migrate
```

The runner loads local environment files, applies each migration once, and records applied
migrations in `admin_schema_migrations`. Migrations run transactionally. If the database already
has a `users` table, do not apply this standalone migration; use the existing table or adapt its
schema instead.

The migration creates an empty table with `id`, `fullname`, `email`, `password`, `is_admin`,
`suspended_at`, and `updated_at` columns. Passwords must be bcrypt hashes. It does not create an
admin account; add one with a bcrypt password hash before signing in. Only active users with
`is_admin = true` can sign in. Generate a session secret with
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

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
