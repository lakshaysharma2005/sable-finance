# Sable Finance

Personal finance and expense tracking app for a single user. Connects to bank accounts via **Plaid** to pull transactions, balances, and account data — no manual entry required for linked accounts. Not a commercial product; built for one person's own use, with no multi-tenant or auth-for-others concerns.

## Current state

This is a **working app**, not a prototype. A Next.js PWA (`src/`) is deployed on **Vercel** with a **Neon Postgres** backend, real Plaid Production integration, and persistent data.

The original design prototype lives in [`design/Sable Finance.dc.html`](design/Sable%20Finance.dc.html) (`design/support.js` is device-frame scaffolding). Use it as the UI/UX reference and for data-shape inspiration — the live app in `src/` is the source of truth for implementation.

For setup, env vars, deploy steps, and data-flow detail, see [`README.md`](README.md).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript — mobile-first PWA |
| API | Next.js route handlers under `src/app/api/` |
| Database | Neon Postgres via Drizzle ORM (`src/db/schema.ts`, migrations in `drizzle/`) |
| Auth | Single password + signed HTTP-only session cookie; `src/proxy.ts` gates all routes |
| Bank data | Plaid Production (`plaid` npm package + `react-plaid-link` on the client) |
| Hosting | Vercel (`vercel.json` registers daily cron at `/api/cron/daily`) |

## Repo layout

```
src/
  app/
    (app)/          # Authenticated screens (dashboard, stats, transactions, accounts, search, …)
    api/            # REST endpoints consumed by the client
    login/          # Password login
  components/       # Shared UI (sheets, nav, Plaid Link button, transaction rows, …)
  db/               # Drizzle schema + db client
  lib/              # Business logic — prefer adding here over bloating route handlers
    plaid/          # Plaid client, sync, webhook verification
    kalshi/         # Kalshi betting balance sync (non-Plaid)
    brand-logos.ts  # Bundled institution/merchant icon paths (BRAND_LOGOS)
    categories.ts   # PFC → app category mapping, palette, account asset categories
    queries.ts      # Shared DB query helpers for API routes
    crypto.ts       # AES-256-GCM encryption for Plaid access tokens
design/             # Original HTML prototype (reference only)
drizzle/            # SQL migrations
public/             # PWA manifest, service worker, brand logos under icons/
scripts/            # hash-password, icon generation, Vercel env helpers
```

## Verification commands

```bash
npm install
npm run dev          # local dev server
npm run build        # production build — run after non-trivial changes
npm run lint
npm run db:generate  # after editing src/db/schema.ts
npm run db:migrate   # apply migrations to DATABASE_URL
```

Locally, Plaid webhooks cannot reach `localhost`. Use the in-app **Refresh data** action (FAB → Refresh, hits `/api/sync`) to pull transactions during development.

## Screens and features

Implemented in the live app (see `src/app/(app)/`):

1. **Dashboard** (`page.tsx`) — greeting, spent-this-month hero with trend, donut chart by category, filter pills, transactions grouped by date, "To Review" stack.
2. **Stats** (`stats/page.tsx`) — Week/Month/Year toggle, bar chart, top spending list.
3. **Transactions** (`transactions/page.tsx`) — full history, account filter chips, grouped by date.
4. **Accounts** (`accounts/page.tsx`) — selected-balance hero (composition bar or trend chart), category filter pills (Credit cards, Banking, Crypto, Stocks, Betting, Others), connect/re-link via Plaid Link.
5. **Search** (`search/page.tsx`) — transaction search.
6. **Add expense** (`add-expense/page.tsx`) — manual cash expenses (local Cash account, not Plaid).
7. **Category detail** (`categories/[name]/page.tsx`) — per-category spending drill-down.

Transaction editing: category override (with optional merchant rule), amount override, exclude from spending, split amounts, notes. User-created categories via the FAB sheet.

## Design system

Match the prototype and existing `src/` styles:

- Dark mode: near-black background (`#0D0D0F`), card surfaces `#161618`.
- Single accent: green (`#7FE08A`) — active nav tab, primary CTA, positive deltas, largest chart segment.
- Typography: Spectral (serif, headings/body) + JetBrains Mono (numbers, labels, uppercase micro-copy).
- Generous rounded corners (16–32px), soft borders/shadows.
- Mobile-first, ~402px reference frame (`src/app/globals.css`, `src/lib/ui.ts`).

## Data model (high level)

Schema in `src/db/schema.ts`:

- **plaid_items** — one row per Plaid Item; `access_token` stored encrypted (`ENCRYPTION_KEY`).
- **accounts** — linked accounts with `assetCategory` (`cc` | `depo` | `crypto` | `invest` | `betting` | `others`), balances, optional `customName` / `hidden`.
- **transactions** — synced from Plaid; `category` from PFC mapping at sync time; user overrides (`categoryOverride`, `amountOverride`, `excludedFromSpending`).
- **transaction_splits**, **category_rules**, **user_categories** — splits, merchant rules, custom categories.
- **balance_snapshots** — daily balance history for Accounts trend chart and MoM deltas.
- **reviewed_days** — dashboard "To Review" dismissals.

Local (non-Plaid) accounts use sentinel IDs prefixed with `local_` — see `src/lib/cash.ts` (Cash) and `src/lib/kalshi/ids.ts` (Kalshi).

Plaid amount convention is preserved: **positive = money out, negative = money in**.

## How data flows

1. **Connect** — Plaid Link → `/api/plaid/exchange-token` encrypts and stores the access token, upserts accounts.
2. **Sync** — `SYNC_UPDATES_AVAILABLE` webhook → `/api/plaid/webhook` (JWT-verified) → cursor-paginated `/transactions/sync` in `src/lib/plaid/sync.ts`. Manual refresh via `/api/sync` (also calls `/transactions/refresh`).
3. **Categories** — Plaid `personal_finance_category` maps to app categories in `src/lib/categories.ts`; overrides and merchant rules applied on top.
4. **Balances** — refreshed on sync/webhook; daily cron snapshots balances and runs fallback sync.
5. **Investments** — Robinhood etc. via Plaid Investments product; `HOLDINGS` / `INVESTMENTS_TRANSACTIONS` webhooks trigger refresh; Stocks balance uses Plaid `current` (portfolio value).
6. **Kalshi** — optional betting balance via Kalshi Trade API (`KALSHI_API_KEY_ID`, `KALSHI_PRIVATE_KEY`); synced as a local account under Betting.

## Plaid

Plaid is the source of bank account and transaction data. For API how-to and documentation lookup, follow [`.cursor/rules/plaid-api.mdc`](.cursor/rules/plaid-api.mdc) — it points to [plaid.com/docs/llms.txt](https://plaid.com/docs/llms.txt).

The [Plaid CLI](https://plaid.com/docs/resources/cli/) is the preferred way for agents to inspect real Plaid data during development (`--json` for structured output). Use it for exploration and verification, not as the app's runtime data path.

### Products in use

| Feature | Status | Use in Sable Finance |
|---|---|---|
| **Link** (web SDK) | Implemented | Connect and re-link bank accounts |
| **Transactions** | Implemented | Cursor-based `/transactions/sync` |
| **Accounts** | Implemented | Account list, types, masks, institution metadata |
| **Balance** | Implemented | Current balances; daily snapshots for trend chart |
| **Investments** | Implemented | Brokerages (e.g. Robinhood) under Stocks |
| **Enrich** | Not integrated | Could add merchant logos/clean names later; sync currently uses Plaid's built-in merchant fields |

### General notes

- Use the **latest** Plaid server library (`plaid` npm) and **Link web SDK** (`react-plaid-link`) — check Plaid docs before pinning versions.
- Store `access_token` encrypted in Postgres; never expose it to the client.
- App runs on Plaid **Production** with real bank accounts.
- Some setup requires the Plaid Dashboard (redirect URIs, product enablement, company profile) — see README for the manual checklist. Webhook URL is passed per-item via `link/token/create`; no separate dashboard webhook config needed.

## Brand logos

Bundled marks for transaction avatars and the Accounts screen. Full how-to:
[`.cursor/rules/brand-logos.mdc`](.cursor/rules/brand-logos.mdc).

| Piece | Role |
|---|---|
| `public/icons/<slug>.png` | Asset files (prefer official Play/App Store icons) |
| `src/lib/brand-logos.ts` | `BRAND_LOGOS` path registry (`?v=` cache-bust on replace) |
| `src/components/TxAvatar.tsx` | Transaction avatar overrides (Venmo by account; Zelle/Empower/Chase CC autopay by name; else Plaid `logoUrl`; else initial) |
| `src/app/(app)/accounts/page.tsx` | `connectionLogo()` + square/wide display helpers for account cards |

When asked to add/update a logo: drop the file under `public/icons/`, register it in
`BRAND_LOGOS`, then wire the matcher in `TxAvatar` and/or Accounts — do not recreate
logos when a link or image is provided.

Current brand keys: `kalshi`, `venmo`, `zelle`, `empower`, `chase`, `bofa`, `robinhood`.

## Agent conventions

- **Minimize scope** — match existing patterns in the file you're editing. Business logic belongs in `src/lib/`, not route handlers.
- **Schema changes** — edit `src/db/schema.ts`, then `npm run db:generate` and commit the new migration in `drizzle/`.
- **Categories** — built-in names/colors in `src/lib/categories.ts`; user-created ones in `user_categories` table.
- **Brand logos** — follow [`.cursor/rules/brand-logos.mdc`](.cursor/rules/brand-logos.mdc); assets in `public/icons/`, registry in `brand-logos.ts`, wiring in `TxAvatar` / Accounts.
- **Secrets** — never commit `.env.local` or paste credentials into chat. Required env vars are documented in README.
- **Auth** — `src/proxy.ts` is the session gate. Public paths: `/login`, `/api/auth/login`, `/api/plaid/webhook`, `/api/cron/daily`, static PWA assets.
- **Plaid docs** — always start from `llms.txt` per the cursor rule; do not rely on outdated sample repos.

## Open / not yet built

- Plaid **Enrich** product (separate from built-in merchant fields on transactions).
- Recurring-transaction detection (prototype showed illustrative UI only).
- Multi-user auth or any commercial/multi-tenant concerns (explicitly out of scope).
