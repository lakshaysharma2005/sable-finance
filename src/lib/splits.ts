import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, accounts, splitPaybacks, transactionSplits, transactions } from "@/db";

export type SplitPaybackItem = {
  id: number;
  transactionId: number;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  accountName: string;
};

export type SplitDetail = {
  id: number;
  transactionId: number;
  amount: number;
  name: string | null;
  settledAmount: number;
  outstanding: number;
  paybacks: SplitPaybackItem[];
};

export type SplitInput = {
  id?: number;
  amount: number;
  name: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDisplayDate(dateOverride: string | null, authorizedDate: string | null, date: string): string {
  return dateOverride ?? authorizedDate ?? date;
}

const displayDateSql = sql`COALESCE(${transactions.dateOverride}, ${transactions.authorizedDate}, ${transactions.date})`;

export function outstandingOf(owed: number, settled: number): number {
  return Math.max(0, round2(owed - settled));
}

/** Settled totals keyed by split id. */
export async function fetchSettledBySplitIds(splitIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (splitIds.length === 0) return map;

  const rows = await db
    .select({
      splitId: splitPaybacks.splitId,
      settled: sql<number>`coalesce(sum(${splitPaybacks.amount}), 0)`.mapWith(Number),
    })
    .from(splitPaybacks)
    .where(inArray(splitPaybacks.splitId, splitIds))
    .groupBy(splitPaybacks.splitId);

  for (const r of rows) map.set(r.splitId, r.settled);
  return map;
}

/** Transaction ids that settle any split (excluded from income/spend stats). */
export async function fetchLinkedPaybackTxIds(txIds?: number[]): Promise<Set<number>> {
  if (txIds && txIds.length === 0) return new Set();

  const rows = await db
    .select({ transactionId: splitPaybacks.transactionId })
    .from(splitPaybacks)
    .where(txIds ? inArray(splitPaybacks.transactionId, txIds) : undefined);

  return new Set(rows.map((r) => r.transactionId));
}

export async function loadSplitsForTransaction(transactionId: number): Promise<SplitDetail[]> {
  const splits = await db
    .select({
      id: transactionSplits.id,
      transactionId: transactionSplits.transactionId,
      amount: transactionSplits.amount,
      name: transactionSplits.name,
    })
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, transactionId));

  if (splits.length === 0) return [];

  const splitIds = splits.map((s) => s.id);
  const paybackRows = await db
    .select({
      id: splitPaybacks.id,
      splitId: splitPaybacks.splitId,
      transactionId: splitPaybacks.transactionId,
      amount: splitPaybacks.amount,
      date: transactions.date,
      authorizedDate: transactions.authorizedDate,
      dateOverride: transactions.dateOverride,
      name: transactions.name,
      merchantName: transactions.merchantName,
      logoUrl: transactions.logoUrl,
      accountName: accounts.name,
      customName: accounts.customName,
    })
    .from(splitPaybacks)
    .innerJoin(transactions, eq(splitPaybacks.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(inArray(splitPaybacks.splitId, splitIds));

  const paybacksBySplit = new Map<number, SplitPaybackItem[]>();
  const settledBySplit = new Map<number, number>();

  for (const r of paybackRows) {
    const item: SplitPaybackItem = {
      id: r.id,
      transactionId: r.transactionId,
      amount: r.amount,
      date: toDisplayDate(r.dateOverride, r.authorizedDate, r.date),
      name: r.merchantName ?? r.name,
      merchantName: r.merchantName,
      logoUrl: r.logoUrl,
      accountName: r.customName ?? r.accountName,
    };
    const list = paybacksBySplit.get(r.splitId) ?? [];
    list.push(item);
    paybacksBySplit.set(r.splitId, list);
    settledBySplit.set(r.splitId, round2((settledBySplit.get(r.splitId) ?? 0) + r.amount));
  }

  return splits.map((s) => {
    const settledAmount = settledBySplit.get(s.id) ?? 0;
    return {
      id: s.id,
      transactionId: s.transactionId,
      amount: s.amount,
      name: s.name,
      settledAmount,
      outstanding: outstandingOf(s.amount, settledAmount),
      paybacks: paybacksBySplit.get(s.id) ?? [],
    };
  });
}

export async function upsertSplitsForTransaction(
  transactionId: number,
  baseAmount: number,
  inputs: SplitInput[],
): Promise<SplitDetail[]> {
  for (const s of inputs) {
    if (typeof s.amount !== "number" || !(s.amount > 0)) {
      throw new Error("each split amount must be positive");
    }
    if (!s.name?.trim()) {
      throw new Error("each split must have a name");
    }
  }

  const total = round2(inputs.reduce((sum, s) => sum + s.amount, 0));
  if (total > baseAmount) {
    throw new Error("split total exceeds transaction amount");
  }

  const existing = await db
    .select({ id: transactionSplits.id })
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, transactionId));
  const existingIds = new Set(existing.map((e) => e.id));

  const keepIds = new Set<number>();
  for (const s of inputs) {
    if (s.id != null) {
      if (!existingIds.has(s.id)) throw new Error("invalid split id");
      keepIds.add(s.id);
      await db
        .update(transactionSplits)
        .set({
          amount: round2(s.amount),
          name: s.name.trim(),
        })
        .where(and(eq(transactionSplits.id, s.id), eq(transactionSplits.transactionId, transactionId)));
    } else {
      const [inserted] = await db
        .insert(transactionSplits)
        .values({
          transactionId,
          amount: round2(s.amount),
          name: s.name.trim(),
        })
        .returning({ id: transactionSplits.id });
      keepIds.add(inserted.id);
    }
  }

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    await db.delete(transactionSplits).where(inArray(transactionSplits.id, toDelete));
  }

  return loadSplitsForTransaction(transactionId);
}

export async function linkPayback(
  splitId: number,
  transactionId: number,
  amountOverride?: number,
): Promise<SplitDetail> {
  const [split] = await db.select().from(transactionSplits).where(eq(transactionSplits.id, splitId));
  if (!split) throw new Error("split not found");

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, transactionId));
  if (!tx || tx.removed) throw new Error("transaction not found");

  const baseAmount = tx.amountOverride ?? tx.amount;
  if (!(baseAmount < 0)) throw new Error("only inflows can settle a split");

  const [already] = await db
    .select({ id: splitPaybacks.id })
    .from(splitPaybacks)
    .where(eq(splitPaybacks.transactionId, transactionId))
    .limit(1);
  if (already) throw new Error("transaction already linked to a split");

  const current = await loadSplitsForTransaction(split.transactionId);
  const leg = current.find((s) => s.id === splitId);
  if (!leg) throw new Error("split not found");
  if (leg.outstanding <= 0) throw new Error("split is already settled");

  const inflowAbs = Math.abs(baseAmount);
  const credit =
    amountOverride != null
      ? round2(amountOverride)
      : round2(Math.min(leg.outstanding, inflowAbs));

  if (!(credit > 0)) throw new Error("payback amount must be positive");
  if (credit > leg.outstanding) throw new Error("payback exceeds outstanding amount");
  if (credit > inflowAbs) throw new Error("payback exceeds transaction amount");

  await db.insert(splitPaybacks).values({
    splitId,
    transactionId,
    amount: credit,
  });

  const updated = await loadSplitsForTransaction(split.transactionId);
  const result = updated.find((s) => s.id === splitId);
  if (!result) throw new Error("split not found after link");
  return result;
}

export async function unlinkPayback(splitId: number, paybackId: number): Promise<SplitDetail> {
  const [row] = await db
    .select()
    .from(splitPaybacks)
    .where(and(eq(splitPaybacks.id, paybackId), eq(splitPaybacks.splitId, splitId)));
  if (!row) throw new Error("payback not found");

  const [split] = await db.select().from(transactionSplits).where(eq(transactionSplits.id, splitId));
  if (!split) throw new Error("split not found");

  await db.delete(splitPaybacks).where(eq(splitPaybacks.id, paybackId));

  const updated = await loadSplitsForTransaction(split.transactionId);
  const result = updated.find((s) => s.id === splitId);
  if (!result) throw new Error("split not found after unlink");
  return result;
}

export type PaybackCandidate = {
  id: number;
  date: string;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  amount: number;
  accountName: string;
};

export async function listPaybackCandidates(opts?: {
  q?: string;
  limit?: number;
}): Promise<PaybackCandidate[]> {
  const limit = opts?.limit ?? 40;
  const linked = await db.select({ transactionId: splitPaybacks.transactionId }).from(splitPaybacks);
  const linkedIds = linked.map((r) => r.transactionId);

  const q = opts?.q?.trim().toLowerCase();

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
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.removed, false),
        eq(accounts.hidden, false),
        sql`coalesce(${transactions.amountOverride}, ${transactions.amount}) < 0`,
        linkedIds.length > 0 ? notInArray(transactions.id, linkedIds) : undefined,
      ),
    )
    .orderBy(desc(displayDateSql), desc(transactions.id))
    .limit(q ? 200 : limit);

  let mapped = rows.map((r) => ({
    id: r.id,
    date: toDisplayDate(r.dateOverride, r.authorizedDate, r.date),
    name: r.merchantName ?? r.name,
    merchantName: r.merchantName,
    logoUrl: r.logoUrl,
    amount: r.amountOverride ?? r.amount,
    accountName: r.customName ?? r.accountName,
  }));

  if (q) {
    mapped = mapped.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.merchantName?.toLowerCase().includes(q) ?? false) ||
        r.accountName.toLowerCase().includes(q),
    );
    mapped = mapped.slice(0, limit);
  }

  return mapped;
}

export async function getSplitById(splitId: number): Promise<SplitDetail | null> {
  const [split] = await db.select().from(transactionSplits).where(eq(transactionSplits.id, splitId));
  if (!split) return null;
  const all = await loadSplitsForTransaction(split.transactionId);
  return all.find((s) => s.id === splitId) ?? null;
}
