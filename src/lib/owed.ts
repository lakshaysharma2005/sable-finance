import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, accounts, transactions, transactionSplits, splitRepayments } from "@/db";

const displayDateSql = sql`COALESCE(${transactions.dateOverride}, ${transactions.authorizedDate}, ${transactions.date})`;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDisplayDate(dateOverride: string | null, authorizedDate: string | null, date: string): string {
  return dateOverride ?? authorizedDate ?? date;
}

export interface OwedRepayment {
  id: number;
  transactionId: number;
  amount: number;
  date: string;
  name: string;
  logoUrl: string | null;
  accountName: string;
}

export interface OwedSplitLine {
  splitId: number;
  amount: number;
  label: string;
  settledAt: string | null;
  repaid: number;
  remaining: number;
  parentTxId: number;
  parentName: string;
  parentDate: string;
  parentLogoUrl: string | null;
  repayments: OwedRepayment[];
}

export interface OwedPerson {
  label: string;
  owed: number;
  repaid: number;
  open: number;
  lines: OwedSplitLine[];
}

export interface OwedSummary {
  totalOpen: number;
  people: OwedPerson[];
  unlabeledOpen: number;
}

async function repaidBySplitIds(splitIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (splitIds.length === 0) return map;
  const rows = await db
    .select({
      splitId: splitRepayments.splitId,
      total: sql<number>`coalesce(sum(${splitRepayments.amount}), 0)`.mapWith(Number),
    })
    .from(splitRepayments)
    .where(inArray(splitRepayments.splitId, splitIds))
    .groupBy(splitRepayments.splitId);
  for (const r of rows) map.set(r.splitId, r.total);
  return map;
}

/** Sync settledAt from repayment coverage. */
export async function refreshSplitSettlement(
  splitId: number,
  opts?: { clearIfUnder?: boolean },
): Promise<void> {
  const [split] = await db.select().from(transactionSplits).where(eq(transactionSplits.id, splitId));
  if (!split) return;

  const [agg] = await db
    .select({
      total: sql<number>`coalesce(sum(${splitRepayments.amount}), 0)`.mapWith(Number),
    })
    .from(splitRepayments)
    .where(eq(splitRepayments.splitId, splitId));

  const repaid = agg?.total ?? 0;
  const covered = repaid + 1e-9 >= split.amount;

  if (covered && !split.settledAt) {
    await db.update(transactionSplits).set({ settledAt: new Date() }).where(eq(transactionSplits.id, splitId));
  } else if (!covered && opts?.clearIfUnder && split.settledAt) {
    await db.update(transactionSplits).set({ settledAt: null }).where(eq(transactionSplits.id, splitId));
  }
}

export async function setSplitSettled(splitId: number, settled: boolean): Promise<{ ok: true } | { error: string; status: number }> {
  const [split] = await db.select().from(transactionSplits).where(eq(transactionSplits.id, splitId));
  if (!split) return { error: "not found", status: 404 };

  if (settled) {
    await db.update(transactionSplits).set({ settledAt: new Date() }).where(eq(transactionSplits.id, splitId));
  } else {
    await db.update(transactionSplits).set({ settledAt: null }).where(eq(transactionSplits.id, splitId));
  }
  return { ok: true };
}

export async function linkRepayment(input: {
  splitId: number;
  transactionId: number;
  amount?: number;
}): Promise<{ ok: true; repaymentId: number; amount: number } | { error: string; status: number }> {
  const [split] = await db.select().from(transactionSplits).where(eq(transactionSplits.id, input.splitId));
  if (!split) return { error: "split not found", status: 404 };

  const [tx] = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      amountOverride: transactions.amountOverride,
      removed: transactions.removed,
    })
    .from(transactions)
    .where(eq(transactions.id, input.transactionId));
  if (!tx || tx.removed) return { error: "transaction not found", status: 404 };

  const baseAmount = tx.amountOverride ?? tx.amount;
  if (baseAmount >= 0) return { error: "only inflows can be linked as repayments", status: 400 };

  const inflowAbs = Math.abs(baseAmount);

  // How much of this inflow is already allocated to other splits
  const [usedAgg] = await db
    .select({
      total: sql<number>`coalesce(sum(${splitRepayments.amount}), 0)`.mapWith(Number),
    })
    .from(splitRepayments)
    .where(eq(splitRepayments.transactionId, input.transactionId));
  const alreadyUsed = usedAgg?.total ?? 0;
  const inflowRemaining = round2(Math.max(0, inflowAbs - alreadyUsed));
  if (inflowRemaining <= 0) return { error: "this payment is already fully allocated", status: 400 };

  const [splitUsedAgg] = await db
    .select({
      total: sql<number>`coalesce(sum(${splitRepayments.amount}), 0)`.mapWith(Number),
    })
    .from(splitRepayments)
    .where(eq(splitRepayments.splitId, input.splitId));
  const splitRepaid = splitUsedAgg?.total ?? 0;
  const splitRemaining = round2(Math.max(0, split.amount - splitRepaid));
  if (splitRemaining <= 0) return { error: "this split is already fully repaid", status: 400 };

  const requested =
    typeof input.amount === "number" && Number.isFinite(input.amount) ? round2(input.amount) : Math.min(inflowRemaining, splitRemaining);
  if (requested <= 0) return { error: "amount must be positive", status: 400 };

  const amount = round2(Math.min(requested, inflowRemaining, splitRemaining));

  const existing = await db
    .select({ id: splitRepayments.id })
    .from(splitRepayments)
    .where(and(eq(splitRepayments.splitId, input.splitId), eq(splitRepayments.transactionId, input.transactionId)))
    .limit(1);
  if (existing.length > 0) return { error: "already linked", status: 409 };

  const [inserted] = await db
    .insert(splitRepayments)
    .values({
      splitId: input.splitId,
      transactionId: input.transactionId,
      amount,
    })
    .returning({ id: splitRepayments.id });

  await refreshSplitSettlement(input.splitId);

  return { ok: true, repaymentId: inserted.id, amount };
}

export async function unlinkRepayment(repaymentId: number): Promise<{ ok: true } | { error: string; status: number }> {
  const [row] = await db.select().from(splitRepayments).where(eq(splitRepayments.id, repaymentId));
  if (!row) return { error: "not found", status: 404 };

  await db.delete(splitRepayments).where(eq(splitRepayments.id, repaymentId));
  await refreshSplitSettlement(row.splitId, { clearIfUnder: true });
  return { ok: true };
}

export async function getOwedSummary(): Promise<OwedSummary> {
  const splits = await db
    .select({
      id: transactionSplits.id,
      amount: transactionSplits.amount,
      label: transactionSplits.label,
      settledAt: transactionSplits.settledAt,
      parentTxId: transactions.id,
      parentName: transactions.name,
      parentMerchant: transactions.merchantName,
      parentLogoUrl: transactions.logoUrl,
      date: transactions.date,
      authorizedDate: transactions.authorizedDate,
      dateOverride: transactions.dateOverride,
      parentExcluded: transactions.excludedFromSpending,
      parentRemoved: transactions.removed,
      accountHidden: accounts.hidden,
    })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.removed, false), eq(accounts.hidden, false)));

  const visible = splits.filter((s) => !s.parentExcluded);
  const splitIds = visible.map((s) => s.id);
  const repaidMap = await repaidBySplitIds(splitIds);

  const repaymentRows =
    splitIds.length > 0
      ? await db
          .select({
            id: splitRepayments.id,
            splitId: splitRepayments.splitId,
            transactionId: splitRepayments.transactionId,
            amount: splitRepayments.amount,
            date: transactions.date,
            authorizedDate: transactions.authorizedDate,
            dateOverride: transactions.dateOverride,
            name: transactions.name,
            merchantName: transactions.merchantName,
            logoUrl: transactions.logoUrl,
            accountName: accounts.name,
            customName: accounts.customName,
          })
          .from(splitRepayments)
          .innerJoin(transactions, eq(splitRepayments.transactionId, transactions.id))
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .where(inArray(splitRepayments.splitId, splitIds))
      : [];

  const repaymentsBySplit = new Map<number, OwedRepayment[]>();
  for (const r of repaymentRows) {
    const list = repaymentsBySplit.get(r.splitId) ?? [];
    list.push({
      id: r.id,
      transactionId: r.transactionId,
      amount: r.amount,
      date: toDisplayDate(r.dateOverride, r.authorizedDate, r.date),
      name: r.merchantName ?? r.name,
      logoUrl: r.logoUrl,
      accountName: r.customName ?? r.accountName,
    });
    repaymentsBySplit.set(r.splitId, list);
  }

  const peopleMap = new Map<string, OwedPerson>();
  let unlabeledOpen = 0;
  let totalOpen = 0;

  for (const s of visible) {
    const label = s.label?.trim() || null;
    const repaid = repaidMap.get(s.id) ?? 0;
    const settled = s.settledAt != null;
    const remaining = settled ? 0 : round2(Math.max(0, s.amount - repaid));
    totalOpen = round2(totalOpen + remaining);

    const line: OwedSplitLine = {
      splitId: s.id,
      amount: s.amount,
      label: label ?? "Unlabeled",
      settledAt: s.settledAt ? s.settledAt.toISOString() : null,
      repaid: round2(Math.min(repaid, s.amount)),
      remaining,
      parentTxId: s.parentTxId,
      parentName: s.parentMerchant ?? s.parentName,
      parentDate: toDisplayDate(s.dateOverride, s.authorizedDate, s.date),
      parentLogoUrl: s.parentLogoUrl,
      repayments: repaymentsBySplit.get(s.id) ?? [],
    };

    if (!label) {
      unlabeledOpen = round2(unlabeledOpen + remaining);
      const key = "Unlabeled";
      const person = peopleMap.get(key) ?? { label: key, owed: 0, repaid: 0, open: 0, lines: [] };
      person.owed = round2(person.owed + s.amount);
      person.repaid = round2(person.repaid + line.repaid);
      person.open = round2(person.open + remaining);
      person.lines.push(line);
      peopleMap.set(key, person);
      continue;
    }

    const person = peopleMap.get(label) ?? { label, owed: 0, repaid: 0, open: 0, lines: [] };
    person.owed = round2(person.owed + s.amount);
    person.repaid = round2(person.repaid + line.repaid);
    person.open = round2(person.open + remaining);
    person.lines.push(line);
    peopleMap.set(label, person);
  }

  const people = [...peopleMap.values()].sort((a, b) => {
    if (a.open !== b.open) return b.open - a.open;
    return a.label.localeCompare(b.label);
  });

  return { totalOpen, people, unlabeledOpen };
}

export interface RepaymentCandidate {
  id: number;
  date: string;
  name: string;
  amount: number; // positive dollars available (abs inflow remaining)
  inflowAmount: number; // abs of base amount
  allocated: number;
  logoUrl: string | null;
  accountName: string;
  accountMask: string | null;
  hint: "venmo" | "zelle" | null;
}

export async function listRepaymentCandidates(opts?: {
  q?: string;
  limit?: number;
}): Promise<RepaymentCandidate[]> {
  const limit = Math.min(opts?.limit ?? 40, 100);
  const q = opts?.q?.trim().toLowerCase() ?? "";

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
      accountName: accounts.name,
      customName: accounts.customName,
      accountMask: accounts.mask,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.removed, false),
        eq(accounts.hidden, false),
        sql`coalesce(${transactions.amountOverride}, ${transactions.amount}) < 0`,
      ),
    )
    .orderBy(sql`${displayDateSql} DESC, ${transactions.id} DESC`)
    .limit(200);

  const txIds = rows.map((r) => r.id);
  const allocatedMap = new Map<number, number>();
  if (txIds.length > 0) {
    const allocated = await db
      .select({
        transactionId: splitRepayments.transactionId,
        total: sql<number>`coalesce(sum(${splitRepayments.amount}), 0)`.mapWith(Number),
      })
      .from(splitRepayments)
      .where(inArray(splitRepayments.transactionId, txIds))
      .groupBy(splitRepayments.transactionId);
    for (const a of allocated) allocatedMap.set(a.transactionId, a.total);
  }

  const out: RepaymentCandidate[] = [];
  for (const r of rows) {
    const base = r.amountOverride ?? r.amount;
    const inflowAbs = Math.abs(base);
    const allocated = allocatedMap.get(r.id) ?? 0;
    const available = round2(Math.max(0, inflowAbs - allocated));
    if (available <= 0) continue;

    const displayName = r.merchantName ?? r.name;
    const accountName = r.customName ?? r.accountName;
    if (q) {
      const hay = `${displayName} ${accountName}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    let hint: RepaymentCandidate["hint"] = null;
    if (/venmo/i.test(accountName)) hint = "venmo";
    else if (/zelle/i.test(displayName) || /zelle/i.test(r.name)) hint = "zelle";

    out.push({
      id: r.id,
      date: toDisplayDate(r.dateOverride, r.authorizedDate, r.date),
      name: displayName,
      amount: available,
      inflowAmount: inflowAbs,
      allocated,
      logoUrl: r.logoUrl,
      accountName,
      accountMask: r.accountMask,
      hint,
    });
    if (out.length >= limit) break;
  }

  // Prefer Venmo/Zelle hints first, then by date (already roughly date-sorted)
  out.sort((a, b) => {
    const ah = a.hint ? 0 : 1;
    const bh = b.hint ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  return out;
}

export async function listPriorSplitLabels(limit = 20): Promise<string[]> {
  const rows = await db
    .selectDistinct({ label: transactionSplits.label })
    .from(transactionSplits)
    .where(and(ne(transactionSplits.label, ""), sql`${transactionSplits.label} is not null`))
    .limit(100);

  return rows
    .map((r) => r.label?.trim())
    .filter((l): l is string => !!l)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}
