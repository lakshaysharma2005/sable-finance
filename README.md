# Sable Finance

Personal finance and expense tracking PWA for a single user. Next.js on Vercel, Neon Postgres, Plaid Production for bank data. The UI is a port of the design prototype in [`design/Sable Finance.dc.html`](design/Sable%20Finance.dc.html).

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend + API routes in one app
- **Neon Postgres** via **Drizzle ORM** (`src/db/schema.ts`, migrations in `drizzle/`)
- **Plaid** — Link (web SDK), Transactions (`/transactions/sync`), Balance
- **Auth** — single password, signed HTTP-only session cookie (`src/proxy.ts` gates everything)
- **PWA** — manifest + service worker; add to home screen on iOS/Android

## Setup

### 1. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | How to get it |
|---|---|
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | [Plaid Dashboard → Developers → Keys](https://dashboard.plaid.com/developers/keys). **Rotate the secret if it was ever shared.** |
| `PLAID_ENV` | `production` |
| `DATABASE_URL` | Neon connection string (see step 2) |
| `APP_PASSWORD_HASH` | `node scripts/hash-password.mjs "your password"` |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | same command as above (encrypts Plaid access tokens at rest) |
| `NEXT_PUBLIC_APP_URL` | the deployed URL, e.g. `https://sable-finance.vercel.app` |
| `CRON_SECRET` | any random string; Vercel sends it with cron requests |

### 2. Database (Neon)

1. In the Vercel project: **Storage → Create Database → Neon** (Marketplace), or create a project at [neon.tech](https://neon.tech).
2. Put the connection string in `DATABASE_URL` (locally via `.env.local`; on Vercel the integration injects it).
3. Apply the schema: `npm run db:migrate` (or `npm run db:push` for a fresh dev database).

### 3. Run locally

```bash
npm install
npm run dev
```

Note: webhooks can't reach localhost — use the in-app **Refresh data** action (FAB → Refresh) to pull transactions while developing.

### 4. Deploy to Vercel

```bash
npx vercel link
npx vercel deploy --prod
```

Set all env vars in Vercel (Project → Settings → Environment Variables). `vercel.json` registers the daily cron (`/api/cron/daily`) which snapshots balances and runs a fallback sync.

## Vercel — one manual step

**Accept the Neon marketplace terms** (blocks database provisioning):
open <https://vercel.com/lakshaysharma2005s-projects/~/integrations/accept-terms/neon?source=cli>, accept, then run:

```bash
npx vercel integration add neon      # provisions the database + DATABASE_URL env var
npx vercel env pull .env.local       # get DATABASE_URL locally
npm run db:migrate                   # apply the schema
npx vercel deploy --prod             # redeploy so the app picks up DATABASE_URL
```

## Plaid Dashboard — manual steps (cannot be automated)

1. **Rotate the Production secret** ([Keys page](https://dashboard.plaid.com/developers/keys)) if it has ever been pasted into a chat/email, then update `PLAID_SECRET` everywhere.
2. **Complete the application profile and company profile** (Dashboard → Settings) — required before connecting to some Production institutions.
3. **Allowed redirect URIs** (Dashboard → Developers → API): add `https://<your-app>/` — needed for OAuth banks (Chase, BofA, etc.).
4. **Webhooks**: no dashboard setup needed — the webhook URL (`https://<your-app>/api/plaid/webhook`) is passed per-item via `link/token/create`. Deliveries are signature-verified in the handler.
5. **Plan**: the Trial plan supports up to 10 Production Items, plenty for personal use. Confirm Transactions is enabled (Dashboard → Products).

## How data flows

1. **Connect** — Accounts screen (or FAB → Connect) opens Plaid Link; the server exchanges the `public_token`, encrypts the `access_token` (AES-256-GCM), stores the item + accounts.
2. **Sync** — Plaid fires `SYNC_UPDATES_AVAILABLE` → `/api/plaid/webhook` (JWT-verified) → cursor-paginated `/transactions/sync` upserts into Postgres. Manual refresh: FAB → Refresh (`/api/sync`, also calls `/transactions/refresh`).
3. **Categories** — Plaid `personal_finance_category` maps to the app palette (`src/lib/categories.ts`); per-transaction overrides and merchant rules are applied on top.
4. **Balances** — refreshed on webhook/sync; a daily cron writes `balance_snapshots` for the Accounts trend chart and month-over-month deltas.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | generate SQL migrations from the schema |
| `npm run db:migrate` | apply migrations to `DATABASE_URL` |
| `npm run icons` | regenerate PWA icons |
| `node scripts/hash-password.mjs "pw"` | produce `APP_PASSWORD_HASH` |
