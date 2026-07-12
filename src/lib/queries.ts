import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, accounts, transactions, plaidItems, balanceSnapshots, reviewedDays } from "@/db";
import { ASSET_CATEGORIES, EXCLUDED_CATEGORIES } from "@/lib/categories";
import { getCategoryLookups, resolveCategoryColor, resolveCategoryEmoji } from "@/lib/category-queries";

// ---------- shared ----------

export interface TxItem {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  amount: number; // Plaid convention: positive = outflow
  pending: boolean;
  category: string;
  emoji: string | null;
  color: string;
  accountId: number;
  accountName: string;
  accountMask: string | null;
  accountColor: string;
  note: string | null;
}

const isExcluded = (cat: string) => (EXCLUDED_CATEGORIES as readonly string[]).includes(cat);

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchTx(from: string, to: string, accountIds?: number[]): Promise<TxItem[]> {
  const categoryLookups = await getCategoryLookups();
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      logoUrl: transactions.logoUrl,
      amount: transactions.amount,
      pending: transactions.pending,
      category: transactions.category,
      categoryOverride: transactions.categoryOverride,
      note: transactions.note,
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
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    )
    .orderBy(sql`${transactions.date} DESC, ${transactions.id} DESC`);

  return rows
    .filter((r) => !accountIds || accountIds.includes(r.accountId))
    .map((r) => {
      const category = r.categoryOverride ?? r.category;
      return {
        id: r.id,
        date: r.date,
        name: r.merchantName ?? r.name,
        merchantName: r.merchantName,
        logoUrl: r.logoUrl,
        amount: r.amount,
        pending: r.pending,
        category,
        emoji: resolveCategoryEmoji(category, categoryLookups.emojis),
        color: resolveCategoryColor(category, categoryLookups.colors),
        accountId: r.accountId,
        accountName: r.customName ?? r.accountName,
        accountMask: r.accountMask,
        accountColor: r.accountColor,
        note: r.note,
      };
    });
}

function spendTotal(txs: TxItem[]): number {
  return txs.filter((t) => t.amount > 0 && !isExcluded(t.category)).reduce((s, t) => s + t.amount, 0);
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
      net: -items.reduce((s, t) => s + t.amount, 0),
      items,
    }));
}

// ---------- Dashboard ----------

export async function getDashboardData(today = iso(new Date())) {
  const t = new Date(today + "T00:00:00Z");
  const monthStart = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)));
  const prevMonthStart = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)));
  const prevMonthEnd = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)));

  const [monthTx, prevTx] = await Promise.all([
    fetchTx(monthStart, today),
    fetchTx(prevMonthStart, prevMonthEnd),
  ]);

  const spent = spendTotal(monthTx);
  const prevSpent = spendTotal(prevTx);
  const deltaPct = prevSpent > 0 ? ((prevSpent - spent) / prevSpent) * 100 : 0;

  // Category breakdown for the donut
  const byCat = new Map<string, number>();
  const catColors = new Map<string, string>();
  const catEmojis = new Map<string, string | null>();
  for (const tx of monthTx) {
    if (tx.amount <= 0 || isExcluded(tx.category)) continue;
    byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + tx.amount);
    if (!catColors.has(tx.category)) catColors.set(tx.category, tx.color);
    if (!catEmojis.has(tx.category)) catEmojis.set(tx.category, tx.emoji);
  }
  const cats = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: spent > 0 ? Math.round((amount / spent) * 100) : 0,
      color: catColors.get(name) ?? resolveCategoryColor(name, {}),
      emoji: catEmojis.get(name) ?? null,
    }));

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
  const txs = await fetchTx(from, to > today ? to : today);

  const vals = buckets.map((b) => spendTotal(txs.filter((tx) => tx.date >= b.from && tx.date <= b.to)));
  const cur = buckets.length - 1;
  const curTotal = vals[cur];
  const prevTotal = vals[cur - 1] ?? 0;
  const deltaPct = prevTotal > 0 ? Math.round(Math.abs(((curTotal - prevTotal) / prevTotal) * 100)) : 0;
  const deltaDir = curTotal > prevTotal ? "up" : curTotal < prevTotal ? "down" : "flat";

  // Current-period bucket totals for Top Spending + Excluded
  const curFrom = buckets[cur].from;
  const curTx = txs.filter((tx) => tx.date >= curFrom);
  const byCat = new Map<string, number>();
  const catColors = new Map<string, string>();
  const catEmojis = new Map<string, string | null>();
  for (const tx of curTx) {
    if (tx.amount <= 0 || isExcluded(tx.category)) continue;
    byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + tx.amount);
    if (!catColors.has(tx.category)) catColors.set(tx.category, tx.color);
    if (!catEmojis.has(tx.category)) catEmojis.set(tx.category, tx.emoji);
  }
  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      color: catColors.get(name) ?? resolveCategoryColor(name, {}),
      emoji: catEmojis.get(name) ?? null,
    }));

  const excluded = curTx
    .filter((tx) => isExcluded(tx.category))
    .slice(0, 20)
    .map((tx) => ({
      name: tx.name,
      reason: tx.category,
      amount: tx.amount,
      color: tx.color,
      logoUrl: tx.logoUrl,
    }));

  const periodLabel = range === "week" ? "This week" : range === "month" ? "This month" : "This year";
  const compareLabel =
    range === "week" ? "vs last wk" : range === "month" ? `vs ${buckets[cur - 1]?.label ?? ""}` : "vs last yr";

  return {
    labels: buckets.map((b) => b.label),
    vals,
    cur,
    total: curTotal,
    periodLabel,
    deltaPct,
    deltaDir,
    compareLabel,
    top,
    excluded,
  };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;

// ---------- Transactions ----------

export async function getTransactionsData(accountIds: number[] | undefined, today = iso(new Date())) {
  const t = new Date(today + "T00:00:00Z");
  const from = iso(new Date(t.getTime() - 89 * 86400000)); // last 90 days

  const [txs, acctRows] = await Promise.all([
    fetchTx(from, today, accountIds && accountIds.length > 0 ? accountIds : undefined),
    db.select().from(accounts).where(eq(accounts.hidden, false)),
  ]);

  const groups = groupByDay(txs, today);
  const txCount = txs.length;
  const txSpent = spendTotal(txs);

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

export async function getAccountsData(today = iso(new Date())) {
  const [acctRows, items] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.hidden, false)),
    db.select().from(plaidItems),
  ]);

  const itemStatus = new Map(items.map((i) => [i.id, i.status]));

  const accountList = acctRows.map((a) => {
    // Signed balance: credit balances count against net worth
    const raw = a.currentBalance ?? 0;
    const signed = a.assetCategory === "cc" ? -raw : raw;
    return {
      id: a.id,
      itemId: a.itemId,
      name: a.customName ?? a.name,
      officialName: a.officialName,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      assetCategory: a.assetCategory,
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

  const catByAccount = new Map(acctRows.map((a) => [a.id, a.assetCategory]));
  const trendMap = new Map<string, Map<number, number>>();
  for (const s of snaps) {
    const cat = catByAccount.get(s.accountId);
    if (!cat) continue;
    const raw = s.currentBalance ?? 0;
    const signed = cat === "cc" ? -raw : raw;
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
    }));
}

export async function getCategoryData(category: string, today = iso(new Date())) {
  const t = new Date(today + "T00:00:00Z");
  const year = t.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const monthStart = iso(new Date(Date.UTC(year, t.getUTCMonth(), 1)));

  const allTx = await fetchTx(yearStart, today);
  const catTx = allTx.filter((tx) => tx.category === category);

  const monthSpent = catTx
    .filter((tx) => tx.date >= monthStart && tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);

  const yearTx = catTx.filter((tx) => tx.amount > 0);
  const yearTotal = yearTx.reduce((s, tx) => s + tx.amount, 0);
  const monthsElapsed = t.getUTCMonth() + 1;
  const yearAvg = monthsElapsed > 0 ? yearTotal / monthsElapsed : 0;

  const groups = groupByMonth(catTx);
  const { colors, emojis } = await getCategoryLookups();

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
