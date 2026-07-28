# Sable Finance — iOS (SwiftUI)

A native Swift/SwiftUI port of the Sable Finance PWA. This is a **future-option
code port**: full UI + client-logic parity with the React app, written against
the existing Next.js `/api/*` backend. No WebViews or wrappers — everything is
SwiftUI. It is not wired for TestFlight/App Store distribution.

## Requirements

- **Xcode 16+** (the project file uses file-system-synchronized groups,
  `objectVersion 77`). This machine's Command Line Tools alone cannot build
  iOS apps — install full Xcode.
- iOS 27.0 deployment target (latest OS only — every API used, e.g. Swift
  Charts selection and `@Observable`, is comfortably available; lower the
  target in Build Settings if older-device support is ever wanted).
- Network access on first build so SPM can resolve the Plaid LinkKit package.

## Getting started

```bash
open ios/SableFinance.xcodeproj
```

1. Xcode resolves the `plaid-link-ios` Swift package automatically.
2. Set the backend URL in `SableFinance/Config/AppConfig.swift`
   (`defaultBaseURL`, placeholder is `http://localhost:3000`). It can also be
   overridden at runtime via the `sable.baseURL` user default.
3. Build & run on a simulator. Log in with the app password — same
   password + session-cookie flow as the web app.

> Note: this project was authored on a machine without an iOS SDK, so it has
> been syntax-verified (`swiftc -parse`) but not yet compiled against the iOS
> SDK. Expect the possibility of small type-level fixes on first build in
> Xcode — the structure, API contracts, and screen logic are complete.

## What's ported (full parity with the React screens)

| Screen | Source of truth (web) | Swift |
| --- | --- | --- |
| Login | `src/app/login/page.tsx` | `Views/Login/LoginView.swift` |
| Dashboard (hero, donut, To Review, connect CTA) | `src/app/(app)/page.tsx` | `Views/Dashboard/` |
| Stats (Week/Month/Year, bar chart, top/excluded) | `src/app/(app)/stats/page.tsx` | `Views/Stats/StatsView.swift` |
| Transactions (chips, groups, filters, sort) | `src/app/(app)/transactions/page.tsx` | `Views/Transactions/` |
| Transaction detail sheets (category, rule prompt, amount override, splits) | `src/components/TransactionDetailSheets.tsx` + friends | `Views/Transactions/TransactionDetailFlow.swift` |
| Accounts (pills, composition bar / trend, sections, rename, re-link) | `src/app/(app)/accounts/page.tsx` | `Views/Accounts/` |
| Search (recents, category chips, live results) | `src/app/(app)/search/page.tsx` | `Views/Search/SearchView.swift` |
| Category detail (edit emoji/name/color, delete, month groups) | `src/app/(app)/categories/[name]/page.tsx` | `Views/Category/CategoryDetailView.swift` |
| Add expense (keypad, cash / account pay-from) | `src/app/(app)/add-expense/page.tsx` | `Views/AddExpense/AddExpenseView.swift` |
| Bottom nav + FAB (add expense/category, connect bank, refresh) | `src/components/BottomNav.tsx` | `Views/Nav/` |

## Architecture

```text
SableFinance/
  SableApp.swift              app entry, font registration, login gate
  Config/AppConfig.swift      base API URL (placeholder), owner name
  Theme/                      design tokens, fonts (Spectral + JetBrains Mono TTFs bundled)
  Support/                    formatting, category constants, amount keypad logic, DataLoader
  Models/Models.swift         Codable models matching the API JSON exactly
  Networking/
    APIClient.swift           URLSession client for every /api/* route
    SessionStore.swift        password login + session state
  Plaid/PlaidLinkManager.swift  LinkKit connect + update-mode re-link
  Views/                      one folder per screen + shared components
  Resources/venmo.png         Venmo avatar override (mirrors public/icons/venmo.png)
```

Key decisions:

- **Design system** is a direct port of `src/lib/ui.ts`: `#0D0D0F` background,
  `#161618` cards, `#7FE08A` accent, `#F4F3EF` text, tertiary at 32%,
  hairline `rgba(255,255,255,0.07)` borders, 16–32pt continuous corners.
  `AppFont.serif()/mono()` map the web's weight numbers onto the bundled
  Spectral / JetBrains Mono TTFs (registered at runtime via CoreText, so no
  Info.plist font keys; falls back to system serif/mono designs if
  registration fails).
- **Networking/auth**: `POST /api/auth/login` sets the `sable_session`
  HttpOnly cookie; `URLSession` + `HTTPCookieStorage.shared` persist it across
  launches (the server cookie has a 1-year TTL), so cookie auth needed no
  redesign. Any 401 drops the app back to the login screen. The production
  cookie is `Secure`, so point the base URL at `https://` for a deployed
  backend (plain `http://localhost` works against `next dev`).
- **Data flow** mirrors the web's `useData` hook: each screen owns a small
  async loader and re-fetches when the shared `ShellState.refreshTick` bumps
  (after sync, Plaid link, category create, manual expense).
- **Charts**: dashboard donut (`SectorMark` + angle selection), stats bars
  (`BarMark` + x-selection with the selected-bar tooltip), accounts trend
  (`AreaMark`/`LineMark`) all use Swift Charts. The accounts 3-D isometric
  composition bar is a direct `Canvas` port of the prototype's SVG polygons.
- **Sheets**: every bottom sheet uses `SableSheet` — content-fitting detents,
  custom grabber, 24pt corners — matching the web sheet chrome. The
  transaction detail flow keeps the web's stacked-sheet behavior as a single
  sheet that transitions between detail / category picker / rule prompt /
  amount keypad / splits / add-category phases.
- **Plaid Link**: official LinkKit SDK via SPM, connect mode + update mode
  (re-link uses `POST /api/plaid/create-link-token { itemId }` and skips the
  token exchange, same as the web). Code is `#if canImport(LinkKit)`-guarded
  so the target still compiles before package resolution.
- **Amount sign conventions** are preserved exactly: Plaid-style positive =
  outflow throughout the models; display helpers (`txAmountLabel`,
  `fmtSigned`, typographic minus `−`) match `src/lib/format.ts`.

## Extension points (deliberately left open)

- **FinanceKit / Apple Card**: `PlaidLinkManager` is the single "account
  source" seam — an Apple Wallet source would sit beside it and feed the same
  backend accounts/transactions contracts.
- **Base URL/config**: `AppConfig` reads a user-default override, so a debug
  settings screen can be added without touching call sites.

## Known gaps / notes

- Logout has no UI surface (the web app's logout is also only an API route);
  `SessionStore.logout()` exists when a surface is wanted.
- Recent searches persist in `UserDefaults` (web used `localStorage`).
- The web PWA's service worker/manifest concerns don't apply natively.
- `NSAllowsLocalNetworking` is enabled in the generated Info.plist so
  `http://localhost` works in the simulator; remote APIs must be HTTPS (ATS).
