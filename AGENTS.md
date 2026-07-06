# Sable Finance

Personal finance and expense tracking app for a single user. It connects to bank accounts via **Plaid** to pull transactions, balances, and account data — no manual entry required for linked accounts. Not a commercial product; built for one person's own use, with no multi-tenant or auth-for-others concerns.

## Current state

`Sable Finance.dc.html` is a **high-fidelity design prototype**, not a working app. It's a single HTML file (Design Component format) with mock data hardcoded in JS — nothing persists, no real backend, no Plaid integration yet. Treat it as the source of truth for UI/UX and required data shapes, not as code to productionize directly. `Sable Finance (standalone).html` is a bundled/offline-viewable export of the same thing.

`ios-frame.jsx` and `support.js` are prototype scaffolding (device bezel + runtime) — not app code.

## Screens implemented in the prototype

1. **Dashboard** — greeting header, hero "spent this month" card with trend, donut chart by category, filter pills, transactions list grouped by date, bottom nav.
2. **Stats** — Week/Month/Year toggle, bar chart with highlighted current period, Top Spending list.
3. **Transactions** — full transaction history, multi-select account filter chips at top, grouped by date.
4. **Accounts** — "Selected balance" hero (togglable between composition bar and trend line chart), filter pills per account category (Credit cards, Banking, Crypto, Stocks, Betting, Others), expandable Credit cards/Banking sections, merged "Not connected yet" list for unlinked categories.

(There may be additional screens/interactions added since — check the live file for the current full set before assuming this list is exhaustive.)

## Design system

- Dark mode: near-black background (#0D0D0F), card surfaces #161618.
- Single accent color: green (#7FE08A), used sparingly (active nav tab, primary CTA, positive deltas, largest chart segment).
- Typography: Spectral (serif, headings/body) + JetBrains Mono (numbers, labels, uppercase micro-copy).
- Generous rounded corners (16–32px), soft borders/shadows, no gradients-on-everything.
- Mobile-first, phone-frame sized (~402px wide reference frame).

## Target architecture (per user decisions so far)

- **Frontend**: Mobile-first responsive **PWA**, not a native iOS app — no App Store distribution needed for personal use; add-to-homescreen is sufficient. Reuse the existing HTML/CSS/JS UI rather than rewriting in Swift.
- **Backend/DB**: **Postgres** (e.g. via Supabase or Neon). Relational — transaction and account data needs real joins and aggregation; avoid NoSQL.
- **Bank connectivity / data**: Plaid — see [Plaid](#plaid) below for which products to use.
- **Security**: Plaid access tokens must be encrypted at rest. Auth is single-user but credentials/tokens still need to be stored securely, not in plaintext.

## Plaid

Plaid is the source of bank account and transaction data. This file lists **which** Plaid products to use; integration details (endpoints, sync, webhooks, etc.) are left for a later planning pass.

For API how-to and documentation lookup, agents should follow [`.cursor/rules/plaid-api.mdc`](.cursor/rules/plaid-api.mdc) — it points to [plaid.com/docs/llms.txt](https://plaid.com/docs/llms.txt), the index of all Plaid documentation pages.

The [Plaid CLI](https://plaid.com/docs/resources/cli/) is the preferred way for agents to inspect real Plaid data during development — no client libraries or request/response boilerplate needed. It supports `--json` for structured, machine-readable output. Look up setup and commands in the docs index above (listed under Resources → Plaid CLI). Do not use it as the app's runtime data path — it's for agent exploration and verification, not production integration.

### MCP servers

[Dashboard MCP](https://plaid.com/docs/resources/mcp/) (Production Item debugging, Link analytics) can be added later if needed. Not configured now.

### Features to use

Track which Plaid products/endpoints this app needs. Add or remove rows as scope changes.

| Feature | Use in Sable Finance |
|---------|----------------------|
| **Link** (web SDK) | Connect and re-link bank accounts |
| **Transactions** | Sync transaction history from linked accounts |
| **Enrich** | Clean merchant names, categories, logos, and location for dashboard/stats UI |
| **Accounts** | Account list, types, masks, institution metadata |
| **Balance** | Current balances for dashboard and accounts screen |
| | |
| | |

### General notes

- Use the **latest** Plaid server client library (backend) and **Link web SDK** (frontend) — check Plaid docs for current package names and versions before adding dependencies; do not pin to outdated examples or sample repos.
- Plaid Link replaces any custom "connect bank account" UI — no manual connection screen needed.
- Store `access_token` encrypted in Postgres; never expose it to the client.
- Use Plaid **Production** from the start — connect real bank accounts and operate on live data; no Sandbox phase.
- Some products need **manual Dashboard setup** (enablement, Enrich terms, webhooks, etc.) — not exposed to MCP or configurable by AI. Include these as human steps in planning; see each product's integration overview and [Launch Center](https://dashboard.plaid.com/) once Production access is granted.

## Working notes / things not yet decided

- No backend, schema, or API exists yet — next step is building it, using the prototype's data shapes (per-screen mock data in `Sable Finance.dc.html`'s JS) as the spec for what each endpoint needs to return.
- Recurring-transaction detection, categorization, and sync logic shown in the prototype are illustrative only — not real computed logic.
- Hosting target (local-only vs. deployed) not yet finalized.
- Reference project available: sample Plaid-powered personal finance manager repo. Use during planning for implementation ideas and data flow patterns, but do not copy architecture blindly.
