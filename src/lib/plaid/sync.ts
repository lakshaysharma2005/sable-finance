import { eq, inArray, sql } from "drizzle-orm";
import type { RemovedTransaction, Transaction } from "plaid";
import { db, accounts, plaidItems, transactions, categoryRules, balanceSnapshots } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { mapPfcToCategory } from "@/lib/categories";
import { isLocalPlaidId } from "@/lib/cash";
import { plaidClient } from "./client";

const MUTATION_ERROR = "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";

type ItemRow = typeof plaidItems.$inferSelect;

async function fetchAllUpdates(accessToken: string, initialCursor: string | null) {
  let cursor = initialCursor;
  const added: Transaction[] = [];
  const modified: Transaction[] = [];
  const removed: RemovedTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const { data } = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor ?? undefined,
      count: 500,
    });
    added.push(...data.added);
    modified.push(...data.modified);
    removed.push(...data.removed);
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  return { added, modified, removed, nextCursor: cursor };
}

async function applyRules(name: string, merchantName: string | null, mapped: string) {
  const rules = await db.select().from(categoryRules);
  const haystack = (merchantName ?? name).toLowerCase();
  for (const rule of rules) {
    if (haystack.includes(rule.merchantMatch)) return rule.category;
  }
  return mapped;
}

async function upsertTransactions(itemId: number, txs: Transaction[]) {
  if (txs.length === 0) return;

  const accountRows = await db.select().from(accounts).where(eq(accounts.itemId, itemId));
  const accountIdByPlaidId = new Map(accountRows.map((a) => [a.plaidAccountId, a.id]));
  const rules = await db.select().from(categoryRules);

  for (const tx of txs) {
    const accountId = accountIdByPlaidId.get(tx.account_id);
    if (!accountId) continue; // account not tracked (e.g. unselected in Link)

    const pfcPrimary = tx.personal_finance_category?.primary ?? null;
    let category = mapPfcToCategory(pfcPrimary);
    const haystack = (tx.merchant_name ?? tx.name).toLowerCase();
    for (const rule of rules) {
      if (haystack.includes(rule.merchantMatch)) {
        category = rule.category;
        break;
      }
    }

    const values = {
      plaidTransactionId: tx.transaction_id,
      accountId,
      date: tx.date,
      authorizedDate: tx.authorized_date ?? null,
      name: tx.name,
      merchantName: tx.merchant_name ?? null,
      logoUrl: tx.logo_url ?? tx.personal_finance_category_icon_url ?? null,
      amount: tx.amount,
      isoCurrencyCode: tx.iso_currency_code ?? null,
      pending: tx.pending,
      pfcPrimary,
      pfcDetailed: tx.personal_finance_category?.detailed ?? null,
      category,
      removed: false,
      updatedAt: new Date(),
    };

    await db
      .insert(transactions)
      .values(values)
      .onConflictDoUpdate({
        target: transactions.plaidTransactionId,
        set: {
          date: values.date,
          authorizedDate: values.authorizedDate,
          name: values.name,
          merchantName: values.merchantName,
          logoUrl: values.logoUrl,
          amount: sql`CASE WHEN ${transactions.amountOverride} IS NULL THEN ${values.amount} ELSE ${transactions.amount} END`,
          pending: values.pending,
          pfcPrimary: values.pfcPrimary,
          pfcDetailed: values.pfcDetailed,
          // Only remap category when the user hasn't set an override
          category: sql`CASE WHEN ${transactions.categoryOverride} IS NULL THEN ${values.category} ELSE ${transactions.category} END`,
          removed: false,
          updatedAt: values.updatedAt,
        },
      });
  }
}

export async function syncItem(item: ItemRow): Promise<{ added: number; modified: number; removed: number }> {
  const accessToken = decryptToken(item.accessTokenEncrypted);

  let updates;
  try {
    updates = await fetchAllUpdates(accessToken, item.syncCursor);
  } catch (err: unknown) {
    const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
    if (code === MUTATION_ERROR) {
      // Restart pagination from the last committed cursor
      updates = await fetchAllUpdates(accessToken, item.syncCursor);
    } else {
      throw err;
    }
  }

  await upsertTransactions(item.id, [...updates.added, ...updates.modified]);

  if (updates.removed.length > 0) {
    await db
      .update(transactions)
      .set({ removed: true, updatedAt: new Date() })
      .where(
        inArray(
          transactions.plaidTransactionId,
          updates.removed.map((r) => r.transaction_id),
        ),
      );
  }

  await db
    .update(plaidItems)
    .set({ syncCursor: updates.nextCursor, lastSyncedAt: new Date(), status: "ok" })
    .where(eq(plaidItems.id, item.id));

  return {
    added: updates.added.length,
    modified: updates.modified.length,
    removed: updates.removed.length,
  };
}

export async function syncItemByPlaidId(plaidItemId: string) {
  const [item] = await db.select().from(plaidItems).where(eq(plaidItems.plaidItemId, plaidItemId));
  if (!item) return null;
  return syncItem(item);
}

export async function syncAllItems() {
  const items = await db.select().from(plaidItems);
  const results = [];
  for (const item of items) {
    if (isLocalPlaidId(item.plaidItemId)) continue;
    try {
      results.push({ item: item.plaidItemId, ...(await syncItem(item)) });
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code === "ITEM_LOGIN_REQUIRED") {
        await db.update(plaidItems).set({ status: "login_required" }).where(eq(plaidItems.id, item.id));
      }
      results.push({ item: item.plaidItemId, error: code ?? String(err) });
    }
  }
  return results;
}

// Pull fresh balances for all items and update the accounts table.
export async function refreshBalances() {
  const items = await db.select().from(plaidItems);
  for (const item of items) {
    if (isLocalPlaidId(item.plaidItemId)) continue;
    const accessToken = decryptToken(item.accessTokenEncrypted);
    try {
      const { data } = await plaidClient.accountsBalanceGet({ access_token: accessToken });
      for (const acct of data.accounts) {
        await db
          .update(accounts)
          .set({
            currentBalance: acct.balances.current ?? null,
            availableBalance: acct.balances.available ?? null,
            creditLimit: acct.balances.limit ?? null,
            updatedAt: new Date(),
          })
          .where(eq(accounts.plaidAccountId, acct.account_id));
      }
    } catch {
      // Balance refresh is best-effort; sync errors are surfaced elsewhere
    }
  }
}

// Write today's balance snapshot for every account (idempotent per day).
export async function snapshotBalances() {
  const rows = await db.select().from(accounts);
  const today = new Date().toISOString().slice(0, 10);
  for (const acct of rows) {
    await db
      .insert(balanceSnapshots)
      .values({
        accountId: acct.id,
        date: today,
        currentBalance: acct.currentBalance,
        availableBalance: acct.availableBalance,
      })
      .onConflictDoUpdate({
        target: [balanceSnapshots.accountId, balanceSnapshots.date],
        set: {
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
        },
      });
  }
}

// Re-apply category rules to existing (non-overridden) transactions.
export async function reapplyRuleToExisting(merchantMatch: string, category: string) {
  await db.execute(sql`
    UPDATE transactions
    SET category = ${category}, updated_at = now()
    WHERE category_override IS NULL
      AND lower(coalesce(merchant_name, name)) LIKE ${"%" + merchantMatch + "%"}
  `);
}
