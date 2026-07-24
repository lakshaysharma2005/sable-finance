import { eq } from "drizzle-orm";
import { db, accounts, plaidItems } from "@/db";
import { encryptToken } from "@/lib/crypto";
import { fetchKalshiBalance, isKalshiConfigured } from "@/lib/kalshi/client";
import { KALSHI_PLAID_ACCOUNT_ID, KALSHI_PLAID_ITEM_ID } from "@/lib/kalshi/ids";

const BETTING_COLOR = "#7FE08A";

async function ensureKalshiAccount(): Promise<number> {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.plaidAccountId, KALSHI_PLAID_ACCOUNT_ID))
    .limit(1);
  if (existing) return existing.id;

  let itemId: number;
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, KALSHI_PLAID_ITEM_ID))
    .limit(1);

  if (item) {
    itemId = item.id;
  } else {
    const [created] = await db
      .insert(plaidItems)
      .values({
        plaidItemId: KALSHI_PLAID_ITEM_ID,
        accessTokenEncrypted: encryptToken("local"),
        institutionName: "Kalshi",
        status: "ok",
      })
      .returning({ id: plaidItems.id });
    itemId = created.id;
  }

  const [row] = await db
    .insert(accounts)
    .values({
      plaidAccountId: KALSHI_PLAID_ACCOUNT_ID,
      itemId,
      name: "Kalshi",
      officialName: "Kalshi",
      mask: null,
      type: "other",
      subtype: "betting",
      assetCategory: "betting",
      currentBalance: 0,
      availableBalance: 0,
      isoCurrencyCode: "USD",
      color: BETTING_COLOR,
    })
    .returning({ id: accounts.id });

  return row.id;
}

/**
 * Pull Kalshi cash + portfolio value into the Betting account.
 * No-op when env credentials are missing. Returns null on skip/failure.
 */
export async function syncKalshiBalance(): Promise<{ available: number; total: number } | null> {
  if (!isKalshiConfigured()) return null;

  try {
    const bal = await fetchKalshiBalance();
    const accountId = await ensureKalshiAccount();
    // Store total (cash + positions) for portfolio; available mirrors it for the Accounts row.
    await db
      .update(accounts)
      .set({
        currentBalance: bal.total,
        availableBalance: bal.total,
        color: BETTING_COLOR,
        assetCategory: "betting",
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));

    await db
      .update(plaidItems)
      .set({ lastSyncedAt: new Date(), status: "ok" })
      .where(eq(plaidItems.plaidItemId, KALSHI_PLAID_ITEM_ID));

    return bal;
  } catch (err) {
    console.error("[kalshi] balance sync failed:", err);
    return null;
  }
}
