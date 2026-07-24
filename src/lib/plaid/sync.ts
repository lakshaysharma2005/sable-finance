import { eq, inArray, sql } from "drizzle-orm";
import type { AccountBase, RemovedTransaction, Transaction } from "plaid";
import { db, accounts, plaidItems, transactions, categoryRules, balanceSnapshots } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { ACCOUNT_COLORS, mapAccountTypeToAssetCategory, mapPfcToCategory } from "@/lib/categories";
import { isLocalPlaidId } from "@/lib/cash";
import { plaidClient } from "./client";

const MUTATION_ERROR = "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";

type ItemRow = typeof plaidItems.$inferSelect;

/** Fingerprint for matching the same real-world account across duplicate Plaid Items. */
export function accountFingerprint(institutionId: string | null | undefined, type: string, mask: string | null | undefined) {
  if (!institutionId || !mask) return null;
  return `${institutionId}|${type}|${mask}`;
}

async function existingFingerprints(excludeItemId?: number): Promise<Set<string>> {
  const rows = await db
    .select({
      type: accounts.type,
      mask: accounts.mask,
      institutionId: plaidItems.institutionId,
      itemId: accounts.itemId,
      hidden: accounts.hidden,
    })
    .from(accounts)
    .innerJoin(plaidItems, eq(accounts.itemId, plaidItems.id));

  const out = new Set<string>();
  for (const row of rows) {
    if (excludeItemId != null && row.itemId === excludeItemId) continue;
    if (row.hidden) continue;
    const fp = accountFingerprint(row.institutionId, row.type, row.mask);
    if (fp) out.add(fp);
  }
  return out;
}

/**
 * Upsert Plaid accounts for an Item. Skips accounts that already exist under
 * another Item at the same institution with the same type+mask (prevents the
 * "linked Chase twice" duplicate-card problem). Never overwrites customName.
 */
export async function upsertAccountsForItem(
  item: ItemRow,
  plaidAccounts: AccountBase[],
): Promise<{ inserted: number; updated: number; skippedDuplicates: number }> {
  const known = await existingFingerprints(item.id);
  const existingCount = (await db.select({ id: accounts.id }).from(accounts)).length;
  let colorIdx = existingCount;
  let inserted = 0;
  let updated = 0;
  let skippedDuplicates = 0;

  for (const acct of plaidAccounts) {
    const fp = accountFingerprint(item.institutionId, acct.type, acct.mask ?? null);
    const [existing] = await db.select().from(accounts).where(eq(accounts.plaidAccountId, acct.account_id)).limit(1);

    if (!existing && fp && known.has(fp)) {
      skippedDuplicates++;
      continue;
    }

    if (existing) {
      await db
        .update(accounts)
        .set({
          // Keep user renames; only refresh Plaid's raw name when no customName.
          name: existing.customName ? existing.name : acct.name,
          officialName: acct.official_name ?? existing.officialName,
          currentBalance: acct.balances.current ?? null,
          availableBalance: acct.balances.available ?? null,
          creditLimit: acct.balances.limit ?? null,
          isoCurrencyCode: acct.balances.iso_currency_code ?? existing.isoCurrencyCode,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existing.id));
      updated++;
      continue;
    }

    await db.insert(accounts).values({
      plaidAccountId: acct.account_id,
      itemId: item.id,
      name: acct.name,
      officialName: acct.official_name ?? null,
      mask: acct.mask ?? null,
      type: acct.type,
      subtype: acct.subtype ?? null,
      assetCategory: mapAccountTypeToAssetCategory(acct.type),
      currentBalance: acct.balances.current ?? null,
      availableBalance: acct.balances.available ?? null,
      creditLimit: acct.balances.limit ?? null,
      isoCurrencyCode: acct.balances.iso_currency_code ?? null,
      color: ACCOUNT_COLORS[colorIdx++ % ACCOUNT_COLORS.length],
    });
    if (fp) known.add(fp);
    inserted++;
  }

  return { inserted, updated, skippedDuplicates };
}

/** Pull /accounts/get for an Item and upsert into our DB. */
export async function syncAccountsForItem(item: ItemRow) {
  const accessToken = decryptToken(item.accessTokenEncrypted);
  const { data } = await plaidClient.accountsGet({ access_token: accessToken });
  return upsertAccountsForItem(item, data.accounts);
}

/**
 * Hide newer duplicate account rows (same institution + type + mask) so the
 * original linked accounts — and their manual categorizations — stay visible.
 */
export async function hideDuplicateAccounts(): Promise<number> {
  const rows = await db
    .select({
      id: accounts.id,
      type: accounts.type,
      mask: accounts.mask,
      createdAt: accounts.createdAt,
      hidden: accounts.hidden,
      institutionId: plaidItems.institutionId,
    })
    .from(accounts)
    .innerJoin(plaidItems, eq(accounts.itemId, plaidItems.id))
    .orderBy(accounts.createdAt);

  const keeperByFp = new Map<string, number>();
  const toHide: number[] = [];

  for (const row of rows) {
    const fp = accountFingerprint(row.institutionId, row.type, row.mask);
    if (!fp) continue;
    const keeper = keeperByFp.get(fp);
    if (keeper == null) {
      keeperByFp.set(fp, row.id);
      continue;
    }
    if (!row.hidden) toHide.push(row.id);
  }

  if (toHide.length === 0) return 0;
  await db.update(accounts).set({ hidden: true, updatedAt: new Date() }).where(inArray(accounts.id, toHide));
  return toHide.length;
}

/** Remove a Plaid Item from Plaid + our DB when it contributed no new accounts. */
export async function removeEmptyDuplicateItem(item: ItemRow) {
  const remaining = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.itemId, item.id));
  if (remaining.length > 0) return false;

  try {
    await plaidClient.itemRemove({ access_token: decryptToken(item.accessTokenEncrypted) });
  } catch {
    // Item may already be invalid; still drop our row.
  }
  await db.delete(plaidItems).where(eq(plaidItems.id, item.id));
  return true;
}

/** After Link update mode (re-link or add accounts), refresh status + accounts + txs. */
export async function completeItemUpdate(itemId: number) {
  const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, itemId));
  if (!item) throw new Error("item not found");

  await db.update(plaidItems).set({ status: "ok" }).where(eq(plaidItems.id, item.id));
  const accountResult = await syncAccountsForItem(item);
  const [fresh] = await db.select().from(plaidItems).where(eq(plaidItems.id, item.id));
  const syncResult = await syncItem(fresh);
  await hideDuplicateAccounts();
  await refreshBalances();
  await snapshotBalances();

  return { accountResult, syncResult };
}

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
