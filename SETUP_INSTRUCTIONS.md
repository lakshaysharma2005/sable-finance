# Setup instructions (collaborator)

Use this if you were invited to work on Sable Finance and want **your own** copy of the app — your own banks, password, and database. Do **not** reuse someone else’s production `.env` or Vercel project; that would expose their live finance data.

The app is single-password per deploy (one password unlocks one database). There are no separate user accounts inside one deploy.

## 1. Get the code

Accept the GitHub collaborator invite, then:

```bash
git clone <repo-url>
cd <repo>
npm install
cp .env.example .env.local
```

You can browse and edit the codebase locally after this.

## 2. Fill your own `.env.local`

Create **fresh** values for every secret. Use [`.env.example`](.env.example) as the template.

| Variable | What to do |
|---|---|
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | Create a free [Plaid](https://dashboard.plaid.com/) account. Prefer your **own** Plaid app (not shared keys). Use **Production** keys after completing the dashboard profile and company profile. |
| `PLAID_ENV` | `production` |
| `DATABASE_URL` | Create your **own** Neon project at [neon.tech](https://neon.tech) (or via Vercel Marketplace Neon). Never paste someone else’s production DB URL. |
| `APP_PASSWORD_HASH` | `node scripts/hash-password.mjs "password you choose"` |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | Same command as `SESSION_SECRET` (must be unique to your instance) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` while developing; your Vercel URL after you deploy |
| `CRON_SECRET` | Any long random string |

Optional Kalshi vars are commented in `.env.example` — skip them unless you use Kalshi.

Then apply the schema and start the app:

```bash
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`, log in with **your** password, and connect **your** banks (Accounts → Connect, or FAB → Connect).

On localhost, Plaid webhooks cannot reach your machine — use FAB → **Refresh** to pull transactions while developing.

## 3. Plaid Dashboard (your keys)

In [Plaid Dashboard](https://dashboard.plaid.com/) for **your** account:

1. Complete the application profile and company profile (Settings) — required for many Production banks.
2. Confirm **Transactions** is enabled (Products). For brokerages / Stocks (e.g. Robinhood), also enable **Investments**.
3. After you deploy (next section), add Allowed redirect URI: `https://<your-project>.vercel.app/` (Developers → API). Needed for OAuth banks like Chase and BofA.
4. Webhooks need no separate dashboard config — the app passes `https://<your-app>/api/plaid/webhook` when creating Link tokens.

Trial plan allows up to 10 Production Items, enough for personal testing.

## 4. Use it on your phone

Phones need a public HTTPS URL (not `localhost`). Deploy **your own** Vercel project under your account:

```bash
npx vercel login
npx vercel        # create / link a new project — do not link to someone else's production project
```

1. In Vercel → Project → Settings → Environment Variables, set every variable from your `.env.local`.
2. Set `NEXT_PUBLIC_APP_URL` to `https://<your-project>.vercel.app`.
3. If you added Neon via Vercel Marketplace:

```bash
npx vercel env pull .env.local
npm run db:migrate
```

4. Deploy:

```bash
npx vercel deploy --prod
```

5. Add the redirect URI in Plaid (step 3 above) for that URL.

On your phone: open the Vercel URL → enter your password → optionally add to home screen:

- **iOS Safari:** Share → Add to Home Screen
- **Android Chrome:** menu → Install app / Add to Home screen

## What not to use from someone else

| OK | Do not use |
|---|---|
| This repo (via GitHub invite) | Their production `DATABASE_URL` |
| `.env.example` as a blank template | Their `ENCRYPTION_KEY`, `SESSION_SECRET`, `APP_PASSWORD_HASH` |
| Your own Plaid / Neon / Vercel accounts | Their live Vercel env vars or deploy hooks |

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local Next.js server |
| `npm run build` | Production build check |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `node scripts/hash-password.mjs "pw"` | Produce `APP_PASSWORD_HASH` |

For product overview and architecture, see the main [README.md](README.md).
