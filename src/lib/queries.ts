import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, accounts, transactions, transactionSplits, plaidItems, balanceSnapshots, reviewedDays } from "@/db";
import { CASH_PLAID_ACCOUNT_ID } from "@/lib/cash";
import { ASSET_CATEGORIES, EXCLUDED_CATEGORIES, mapAccountTypeToAssetCategory } from "@/lib/categories";
import { getCategoryLookups, resolveCategoryColor, resolveCategoryEmoji } from "@/lib/category-queries";

// ---------- shared ----------

export const SPLITS_CATEGORY = "Splits";

export interface TxSplit {
  id: number;
  amount: number;
}

export interface TxItem {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  amount: number; // effective (your share) for display and category totals
  originalAmount: number; // raw Plaid amount
  excludedAmount: number; // sum of split portions
  splits: TxSplit[];
  pending: boolean;
  category: string;
  emoji: string | null;
  color: string;
  accountId: number;
  accountName: string;
  accountMask: string | null;
  accountColor: string;
  note: string | null;
  excludedFromSpending: boolean;
  /** Synthetic row from transaction_splits on the Splits category page */
  isSplitPortion?: boolean;
  parentTxId?: number;
  splitRowId?: number;
}

interface SplitInRange {
  id: number;
  transactionId: number;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  accountId: number;
  accountName: string;
  accountMask: string | null;
  accountColor: string;
}

const isExcluded = (cat: string) => (EXCLUDED_CATEGORIES as readonly string[]).includes(cat);

export function isExcludedFromSpending(tx: TxItem): boolean {
  return tx.excludedFromSpending || isExcluded(tx.category);
}

function excludedTxIds(txs: TxItem[]): Set<number> {
  return new Set(txs.filter(isExcludedFromSpending).map((t) => t.id));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// User override → purchase/authorization day → post date (Plaid prefers auth over post).
const displayDateSql = sql`COALESCE(${transactions.dateOverride}, ${transactions.authorizedDate}, ${transactions.date})`;

function toDisplayDate(dateOverride: string | null, authorizedDate: string | null, date: string): string {
  return dateOverride ?? authorizedDate ?? date;
}

async function fetchSplitsInRange(from: string, to: string): Promise<SplitInRange[]> {
  const rows = await db
    .select({
      id: transactionSplits.id,
      transactionId: transactionSplits.transactionId,
      amount: transactionSplits.amount,
      date: transactions.date,
      authorizedDate: transactions.authorizedDate,
      dateOverride: transactions.dateOverride,
      name: transactions.name,
      merchantName: transactions.merchantName,
      logoUrl: transactions.logoUrl,
      accountId: accounts.id,
      accountName: accounts.name,
      customName: accounts.customName,
      accountMask: accounts.mask,
      accountColor: accounts.color,
    })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.removed, false),
        eq(accounts.hidden, false),
        gte(displayDateSql, from),
        lte(displayDateSql, to),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    amount: r.amount,
    date: toDisplayDate(r.dateOverride, r.authorizedDate, r.date),
    name: r.merchantName ?? r.name,
    merchantName: r.merchantName,
    logoUrl: r.logoUrl,
    accountId: r.accountId,
    accountName: r.customName ?? r.accountName,
    accountMask: r.accountMask,
    accountColor: r.accountColor,
  }));
}

async function fetchTx(from: string, to: string, accountIds?: number[]): Promise<TxItem[]> {
  const categoryLookups = await getCategoryLookups();
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      authorizedDate: transactions.authorizedDate,
      dateOverride: transactions.dateOverride,
      name: transactions.name,
      merchantName: transactions.merchantName,
      logoUrl: transactions.logoUrl,
      amount: transactions.amount,
      amountOverride: transactions.amountOverride,
      pending: transactions.pending,
      category: transactions.category,
      categoryOverride: transactions.categoryOverride,
      note: transactions.note,
      excludedFromSpending: transactions.excludedFromSpending,
      accountId: accounts.id,
      accountName: accounts.name,
      customName: accounts.customName,
      accountMask: accounts.mask,
      accountColor: accounts.color,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.removed, false),
        eq(accounts.hidden, false),
        gte(displayDateSql, from),
        lte(displayDateSql, to),
      ),
    )
    .orderBy(sql`${displayDateSql} DESC, ${transactions.id} DESC`);

  const filtered = rows.filter((r) => !accountIds || accountIds.includes(r.accountId));
  const txIds = filtered.map((r) => r.id);

  const splitRows =
    txIds.length > 0
      ? await db
          .select({
            id: transactionSplits.id,
            transactionId: transactionSplits.transactionId,
            amount: transactionSplits.amount,
          })
          .from(transactionSplits)
          .where(inArray(transactionSplits.transactionId, txIds))
      : [];

  const splitsByTx = new Map<number, TxSplit[]>();
  for (const s of splitRows) {
    const list = splitsByTx.get(s.transactionId) ?? [];
    list.push({ id: s.id, amount: s.amount });
    splitsByTx.set(s.transactionId, list);
  }

  return filtered.map((r) => {
    const category = r.categoryOverride ?? r.category;
    const splits = splitsByTx.get(r.id) ?? [];
    const excludedAmount = splits.reduce((sum, s) => sum + s.amount, 0);
    const plaidAmount = r.amount;
    const baseAmount = r.amountOverride ?? plaidAmount;
    const isInflow = baseAmount < 0;
    const effectiveAmount = isInflow ? baseAmount : Math.max(0, baseAmount - excludedAmount);
    return {
      id: r.id,
      date: toDisplayDate(r.dateOverride, r.authorizedDate, r.date),
      name: r.merchantName ?? r.name,
      merchantName: r.merchantName,
      logoUrl: r.logoUrl,
      amount: effectiveAmount,
      originalAmount: plaidAmount,
      excludedAmount,
      splits,
      pending: r.pending,
      category,
      emoji: resolveCategoryEmoji(category, categoryLookups.emojis),
      color: resolveCategoryColor(category, categoryLookups.colors),
      accountId: r.accountId,
      accountName: r.customName ?? r.accountName,
      accountMask: r.accountMask,
      accountColor: r.accountColor,
      note: r.note,
      excludedFromSpending: r.excludedFromSpending,
    };
  });
}

function spendTotal(txs: TxItem[], splits: SplitInRange[]): number {
  const skipIds = excludedTxIds(txs);
  let total = 0;
  for (const tx of txs) {
    if (isExcludedFromSpending(tx)) continue;
    total += tx.amount;
  }
  for (const s of splits) {
    if (skipIds.has(s.transactionId)) continue;
    total += s.amount;
  }
  return total;
}

function buildCategoryTotals(
  txs: TxItem[],
  splits: SplitInRange[],
  categoryLookups: { colors: Record<string, string>; emojis: Record<string, string | null> },
) {
  const skipIds = excludedTxIds(txs);
  const byCat = new Map<string, number>();
  const catColors = new Map<string, string>();
  const catEmojis = new Map<string, string | null>();

  for (const tx of txs) {
    if (isExcludedFromSpending(tx)) continue;
    if (tx.category === SPLITS_CATEGORY) {
      byCat.set(SPLITS_CATEGORY, (byCat.get(SPLITS_CATEGORY) ?? 0) + tx.amount);
      if (!catColors.has(SPLITS_CATEGORY)) {
        catColors.set(SPLITS_CATEGORY, resolveCategoryColor(SPLITS_CATEGORY, categoryLookups.colors));
        catEmojis.set(SPLITS_CATEGORY, resolveCategoryEmoji(SPLITS_CATEGORY, categoryLookups.emojis));
      }
    } else {
      byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + tx.amount);
      if (!catColors.has(tx.category)) catColors.set(tx.category, tx.color);
      if (!catEmojis.has(tx.category)) catEmojis.set(tx.category, tx.emoji);
    }
  }

  const splitsSum = splits.filter((s) => !skipIds.has(s.transactionId)).reduce((s, sp) => s + sp.amount, 0);
  if (splitsSum !== 0) {
    byCat.set(SPLITS_CATEGORY, (byCat.get(SPLITS_CATEGORY) ?? 0) + splitsSum);
    if (!catColors.has(SPLITS_CATEGORY)) {
      catColors.set(SPLITS_CATEGORY, resolveCategoryColor(SPLITS_CATEGORY, categoryLookups.colors));
      catEmojis.set(SPLITS_CATEGORY, resolveCategoryEmoji(SPLITS_CATEGORY, categoryLookups.emojis));
    }
  }

  return { byCat, catColors, catEmojis };
}

function splitPortionsToTxItems(splits: SplitInRange[], categoryLookups: { colors: Record<string, string>; emojis: Record<string, string | null> }): TxItem[] {
  const splitsColor = resolveCategoryColor(SPLITS_CATEGORY, categoryLookups.colors);
  const splitsEmoji = resolveCategoryEmoji(SPLITS_CATEGORY, categoryLookups.emojis);
  return splits.map((s) => ({
    id: s.transactionId,
    date: s.date,
    name: s.name,
    merchantName: s.merchantName,
    logoUrl: s.logoUrl,
    amount: s.amount,
    originalAmount: s.amount,
    excludedAmount: 0,
    splits: [],
    pending: false,
    category: SPLITS_CATEGORY,
    emoji: splitsEmoji,
    color: splitsColor,
    accountId: s.accountId,
    accountName: s.accountName,
    accountMask: s.accountMask,
    accountColor: s.accountColor,
    note: null,
    excludedFromSpending: false,
    isSplitPortion: true,
    parentTxId: s.transactionId,
    splitRowId: s.id,
  }));
}

export async function getTransactionById(id: number): Promise<TxItem | null> {
  const [row] = await db
    .select({
      date: transactions.date,
      authorizedDate: transactions.authorizedDate,
      dateOverride: transactions.dateOverride,
    })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) return null;
  const day = toDisplayDate(row.dateOverride, row.authorizedDate, row.date);
  const txs = await fetchTx(day, day);
  return txs.find((t) => t.id === id) ?? null;
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  label: string; // "TODAY · JUN 29"
  net: number; // negative = net spend for the day (UI sign convention)
  items: TxItem[];
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dayLabel(dateStr: string, today: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const base = `${MONTHS[m - 1]} ${d}`;
  const t = new Date(today + "T00:00:00Z");
  const yesterday = iso(new Date(t.getTime() - 86400000));
  if (dateStr === today) return `TODAY · ${base}`;
  if (dateStr === yesterday) return `YESTERDAY · ${base}`;
  return base;
}

function groupByDay(txs: TxItem[], today: string): DayGroup[] {
  const map = new Map<string, TxItem[]>();
  for (const tx of txs) {
    const list = map.get(tx.date) ?? [];
    list.push(tx);
    map.set(tx.date, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      label: dayLabel(date, today),
      // UI convention: outflow negative. Plaid: outflow positive -> negate sum.
      net: -items.reduce((s, t) => s + (isExcludedFromSpending(t) ? 0 : t.amount), 0),
      items,
    }));
}

// ---------- Dashboard ----------

export function sortSpendingCategories<T extends { name: string; amount: number }>(cats: T[]): T[] {
  return [...cats]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export async function getDashboardData(today = iso(new Date())) {
  const t = new Date(today + "T00:00:00Z");
  const monthStart = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)));
  const prevMonthStart = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)));
  const prevMonthEnd = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)));

  const [monthTx, prevTx, monthSplits, prevSplits, categoryLookups] = await Promise.all([
    fetchTx(monthStart, today),
    fetchTx(prevMonthStart, prevMonthEnd),
    fetchSplitsInRange(monthStart, today),
    fetchSplitsInRange(prevMonthStart, prevMonthEnd),
    getCategoryLookups(),
  ]);

  const spent = spendTotal(monthTx, monthSplits);
  const prevSpent = spendTotal(prevTx, prevSplits);
  const deltaPct = prevSpent > 0 ? ((prevSpent - spent) / prevSpent) * 100 : 0;

  const { byCat, catColors, catEmojis } = buildCategoryTotals(monthTx, monthSplits, categoryLookups);
  const cats = sortSpendingCategories(
    [...byCat.entries()].map(([name, amount]) => ({
      name,
      amount,
      pct: spent > 0 ? Math.round((amount / spent) * 100) : 0,
      color: catColors.get(name) ?? resolveCategoryColor(name, categoryLookups.colors),
      emoji: catEmojis.get(name) ?? null,
    })),
  );

  // Recent transactions (last 14 days)
  const recentFrom = iso(new Date(t.getTime() - 13 * 86400000));
  const recentTx = monthTx.filter((tx) => tx.date >= recentFrom);
  const extra =
    recentFrom < monthStart ? (await fetchTx(recentFrom, iso(new Date(t.getTime() - 1)))).filter((tx) => tx.date < monthStart) : [];
  const groups = groupByDay([...recentTx, ...extra], today);

  // To Review: last 7 days with transactions, not yet marked reviewed
  const reviewed = new Set((await db.select().from(reviewedDays)).map((r) => r.day));
  const reviewFrom = iso(new Date(t.getTime() - 6 * 86400000));
  const reviewGroups = groups
    .filter((g) => g.date >= reviewFrom && !reviewed.has(g.date))
    .map((g) => ({ ...g, items: g.items.slice(0, 4) }));

  const prevMonthName = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return { spent, prevSpent, deltaPct, prevMonthName, cats, groups, reviewGroups };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

// ---------- Stats ----------

export type StatsRange = "week" | "month" | "year";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function statsPeriodLabel(
  range: StatsRange,
  bucket: { from: string; to: string },
  isCurrent: boolean,
  today: string,
): string {
  if (range === "week") {
    if (bucket.from === today) return "Today";
    const d = new Date(bucket.from + "T00:00:00Z");
    return WEEKDAY_NAMES[(d.getUTCDay() + 6) % 7];
  }
  if (range === "month") {
    if (isCurrent) return "This month";
    const m = Number(bucket.from.slice(5, 7)) - 1;
    return MONTH_FULL[m];
  }
  if (isCurrent) return "This year";
  return bucket.from.slice(0, 4);
}

function bucketBreakdown(
  txs: TxItem[],
  splits: SplitInRange[],
  categoryLookups: { colors: Record<string, string>; emojis: Record<string, string | null> },
) {
  const { byCat, catColors, catEmojis } = buildCategoryTotals(txs, splits, categoryLookups);
  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      color: catColors.get(name) ?? resolveCategoryColor(name, categoryLookups.colors),
      emoji: catEmojis.get(name) ?? null,
    }));

  const excluded = txs.filter((tx) => isExcludedFromSpending(tx)).slice(0, 20);

  return { top, excluded };
}

export async function getStatsData(range: StatsRange, today = iso(new Date())) {
  const t = new Date(today + "T00:00:00Z");

  let buckets: { key: string; label: string; from: string; to: string }[] = [];

  if (range === "week") {
    // Current week Mon..Sun
    const dow = (t.getUTCDay() + 6) % 7; // Mon=0
    const monday = new Date(t.getTime() - dow * 86400000);
    const names = ["M", "T", "W", "T", "F", "S", "S"];
    buckets = names.map((label, i) => {
      const d = iso(new Date(monday.getTime() + i * 86400000));
      return { key: d, label, from: d, to: d };
    });
  } else if (range === "month") {
    // Last 6 calendar months incl. current
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i + 1, 0));
      buckets.push({
        key: iso(start),
        label: start.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        from: iso(start),
        to: iso(end),
      });
    }
  } else {
    // Last 6 calendar years incl. current
    for (let i = 5; i >= 0; i--) {
      const y = t.getUTCFullYear() - i;
      buckets.push({ key: String(y), label: `'${String(y).slice(2)}`, from: `${y}-01-01`, to: `${y}-12-31` });
    }
  }

  const from = buckets[0].from;
  const to = buckets[buckets.length - 1].to;
  const end = to > today ? today : to;
  const [txs, allSplits, categoryLookups] = await Promise.all([
    fetchTx(from, end),
    fetchSplitsInRange(from, end),
    getCategoryLookups(),
  ]);

  const vals = buckets.map((b) => {
    const bucketEnd = b.to > today ? today : b.to;
    const bucketTx = txs.filter((tx) => tx.date >= b.from && tx.date <= bucketEnd);
    const bucketSplits = allSplits.filter((s) => s.date >= b.from && s.date <= bucketEnd);
    return spendTotal(bucketTx, bucketSplits);
  });

  // Default selection: today within the week, else the latest (current) bucket
  let cur = buckets.length - 1;
  if (range === "week") {
    const todayIdx = buckets.findIndex((b) => b.key === today);
    if (todayIdx >= 0) cur = todayIdx;
  }

  const periods = buckets.map((b, i) => {
    const bucketEnd = b.to > today ? today : b.to;
    const bucketTx = txs.filter((tx) => tx.date >= b.from && tx.date <= bucketEnd);
    const bucketSplits = allSplits.filter((s) => s.date >= b.from && s.date <= bucketEnd);
    const total = vals[i];
    const prevTotal = i > 0 ? vals[i - 1] : 0;
    const deltaPct = prevTotal > 0 ? Math.round(Math.abs(((total - prevTotal) / prevTotal) * 100)) : 0;
    const deltaDir = total > prevTotal ? ("up" as const) : total < prevTotal ? ("down" as const) : ("flat" as const);
    const isCurrent =
      range === "week" ? b.key === today : i === buckets.length - 1;
    const compareLabel = i === 0 ? "" : `vs ${buckets[i - 1].label}`;
    const { top, excluded } = bucketBreakdown(bucketTx, bucketSplits, categoryLookups);
    return {
      periodLabel: statsPeriodLabel(range, b, isCurrent, today),
      total,
      deltaPct,
      deltaDir,
      compareLabel,
      top,
      excluded,
    };
  });

  const selected = periods[cur];

  return {
    labels: buckets.map((b) => b.label),
    vals,
    cur,
    periods,
    // Flat fields for the default (current) selection — kept for convenience
    total: selected.total,
    periodLabel: selected.periodLabel,
    deltaPct: selected.deltaPct,
    deltaDir: selected.deltaDir,
    compareLabel: selected.compareLabel,
    top: selected.top,
    excluded: selected.excluded,
  };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;

// ---------- Transactions ----------

export async function getTransactionsData(
  accountIds: number[] | undefined,
  opts: { today?: string; month?: string } = {},
) {
  const today = opts.today ?? iso(new Date());
  let from: string;
  let to: string;

  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const [y, m] = opts.month.split("-").map(Number);
    from = `${opts.month}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = `${opts.month}-${String(lastDay).padStart(2, "0")}`;
    to = monthEnd < today ? monthEnd : today;
  } else {
    const t = new Date(today + "T00:00:00Z");
    from = iso(new Date(t.getTime() - 89 * 86400000)); // last 90 days
    to = today;
  }

  const [txs, splits, acctRows] = await Promise.all([
    fetchTx(from, to, accountIds && accountIds.length > 0 ? accountIds : undefined),
    fetchSplitsInRange(from, to),
    db.select().from(accounts).where(eq(accounts.hidden, false)),
  ]);

  const filteredSplits =
    accountIds && accountIds.length > 0 ? splits.filter((s) => accountIds.includes(s.accountId)) : splits;

  const groups = groupByDay(txs, to);
  const txCount = txs.length;
  const txSpent = spendTotal(txs, filteredSplits);

  const acctChips = acctRows.map((a) => ({
    id: a.id,
    name: a.customName ?? a.name,
    mask: a.mask,
    color: a.color,
  }));

  return { groups, txCount, txSpent, accounts: acctChips };
}

export type TransactionsData = Awaited<ReturnType<typeof getTransactionsData>>;

// ---------- Accounts ----------

/** Portfolio sign: credit balances reduce net worth; all other categories (banking, betting, etc.) add. */
function signedPortfolioBalance(
  assetCategory: string,
  currentBalance: number | null,
  availableBalance: number | null,
): number {
  if (assetCategory === "cc") return -(currentBalance ?? 0);
  // Investment / crypto accounts: `current` is total portfolio value; `available` is cash only (often null).
  if (assetCategory === "invest" || assetCategory === "crypto") return currentBalance ?? availableBalance ?? 0;
  return availableBalance ?? currentBalance ?? 0;
}

export async function getAccountsData(today = iso(new Date())) {
  const [acctRows, items] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.hidden, false)),
    db.select().from(plaidItems),
  ]);

  const itemStatus = new Map(items.map((i) => [i.id, i.status]));
  const itemInstitution = new Map(items.map((i) => [i.id, i.institutionName]));

  // Exclude local cash (expense funding only) from portfolio net worth UI.
  // Other synthetic accounts (e.g. Kalshi under Betting) are included.
  const accountList = acctRows.filter((a) => a.plaidAccountId !== CASH_PLAID_ACCOUNT_ID).map((a) => {
    // Prefer live type/subtype/name mapping so Robinhood Crypto lands under Crypto
    // even if it was stored as Stocks before the mapper knew about it.
    // Keep explicit synthetic categories (Betting / Kalshi).
    const assetCategory =
      a.assetCategory === "betting"
        ? a.assetCategory
        : mapAccountTypeToAssetCategory(a.type, a.subtype, a.name);
    // Match account cards: credit uses current; banking/assets use available (fallback current).
    // Credit balances count against net worth.
    const signed = signedPortfolioBalance(assetCategory, a.currentBalance, a.availableBalance);
    return {
      id: a.id,
      itemId: a.itemId,
      name: a.customName ?? a.name,
      officialName: a.officialName,
      institutionName: itemInstitution.get(a.itemId) ?? null,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      assetCategory,
      currentBalance: a.currentBalance,
      availableBalance: a.availableBalance,
      creditLimit: a.creditLimit,
      signedBalance: signed,
      color: a.color,
      needsRelink: itemStatus.get(a.itemId) === "login_required",
    };
  });

  const assetCats = ASSET_CATEGORIES.map((c) => {
    const catAccounts = accountList.filter((a) => a.assetCategory === c.key);
    return {
      key: c.key,
      label: c.label,
      color: c.color,
      amt: catAccounts.reduce((s, a) => s + a.signedBalance, 0),
      connected: catAccounts.length > 0,
    };
  });

  // Balance trend: snapshots for the last 6 months, summed per day (signed)
  const t = new Date(today + "T00:00:00Z");
  const trendFrom = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 6, t.getUTCDate())));
  const snaps = await db
    .select()
    .from(balanceSnapshots)
    .where(gte(balanceSnapshots.date, trendFrom))
    .orderBy(balanceSnapshots.date);

  const catByAccount = new Map(accountList.map((a) => [a.id, a.assetCategory]));
  const trendMap = new Map<string, Map<number, number>>();
  for (const s of snaps) {
    const cat = catByAccount.get(s.accountId);
    if (!cat) continue;
    const signed = signedPortfolioBalance(cat, s.currentBalance, s.availableBalance);
    const day = trendMap.get(s.date) ?? new Map<number, number>();
    day.set(s.accountId, signed);
    trendMap.set(s.date, day);
  }
  const trend = [...trendMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, perAccount]) => ({
      date,
      byAccount: Object.fromEntries(perAccount),
      total: [...perAccount.values()].reduce((s, v) => s + v, 0),
    }));

  // Month-over-month change of total selected balance
  const monthAgo = iso(new Date(t.getTime() - 30 * 86400000));
  const past = trend.filter((p) => p.date <= monthAgo).at(-1) ?? trend.at(0);
  const totalNow = accountList.reduce((s, a) => s + a.signedBalance, 0);
  const momDelta = past ? totalNow - past.total : 0;
  const momPct = past && past.total !== 0 ? (momDelta / Math.abs(past.total)) * 100 : 0;

  return { accounts: accountList, assetCats, trend, momDelta, momPct };
}

export type AccountsData = Awaited<ReturnType<typeof getAccountsData>>;

// ---------- Category detail ----------

export interface MonthGroup {
  monthKey: string; // YYYY-MM
  label: string; // "July"
  items: TxItem[];
  total: number; // net spend for the month (expenses minus refunds)
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

function groupByMonth(txs: TxItem[]): MonthGroup[] {
  const map = new Map<string, TxItem[]>();
  for (const tx of txs) {
    const monthKey = tx.date.slice(0, 7);
    const list = map.get(monthKey) ?? [];
    list.push(tx);
    map.set(monthKey, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monthKey, items]) => ({
      monthKey,
      label: monthLabel(monthKey),
      items,
      total: items.reduce((s, tx) => s + (isExcludedFromSpending(tx) ? 0 : tx.amount), 0),
    }));
}

export async function getCategoryData(category: string, today = iso(new Date())) {
  const t = new Date(today + "T00:00:00Z");
  const year = t.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const monthStart = iso(new Date(Date.UTC(year, t.getUTCMonth(), 1)));

  const [allTx, yearSplits, categoryLookups] = await Promise.all([
    fetchTx(yearStart, today),
    fetchSplitsInRange(yearStart, today),
    getCategoryLookups(),
  ]);

  const skipIds = excludedTxIds(allTx);
  const activeSplits = yearSplits.filter((s) => !skipIds.has(s.transactionId));

  let catTx = allTx.filter((tx) => tx.category === category);

  if (category === SPLITS_CATEGORY) {
    const splitPortions = splitPortionsToTxItems(activeSplits, categoryLookups);
    catTx = [...catTx, ...splitPortions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  const countable = (tx: TxItem) => (isExcludedFromSpending(tx) ? 0 : tx.amount);

  const monthSpent = catTx
    .filter((tx) => tx.date >= monthStart)
    .reduce((s, tx) => s + countable(tx), 0);

  const yearTotal = catTx.reduce((s, tx) => s + countable(tx), 0);
  const monthsElapsed = t.getUTCMonth() + 1;
  const yearAvg = monthsElapsed > 0 ? yearTotal / monthsElapsed : 0;

  const groups = groupByMonth(catTx);
  const { colors, emojis } = categoryLookups;

  return {
    name: category,
    emoji: resolveCategoryEmoji(category, emojis),
    color: resolveCategoryColor(category, colors),
    monthSpent,
    monthName: new Date(Date.UTC(year, t.getUTCMonth(), 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
    year,
    yearTotal,
    yearAvg,
    txCount: catTx.length,
    groups,
  };
}

export type CategoryData = Awaited<ReturnType<typeof getCategoryData>>;
