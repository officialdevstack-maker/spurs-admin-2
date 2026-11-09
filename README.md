This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Server configuration

Set these values in an untracked `.env.local` file or in the deployment environment. Do not use
`NEXT_PUBLIC_` prefixes for credentials:

```env
PANEL_ADMIN_EMAIL=admin@example.com
PANEL_ADMIN_PASSWORD=replace-with-a-strong-password
PANEL_SESSION_SECRET=replace-with-at-least-32-random-bytes
ACCOUNTS_API_URL=https://api.example.com
ACCOUNTS_ADMIN_EMAIL=panel-service@example.com
ACCOUNTS_ADMIN_PASSWORD=replace-with-the-dedicated-admin-password
```

Generate a session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
Create the Accounts service user separately and grant it the documented admin role. Panel password
changes are managed by updating `PANEL_ADMIN_PASSWORD` in the server environment and restarting or
redeploying the app.

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
