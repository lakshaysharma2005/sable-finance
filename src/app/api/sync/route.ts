import { NextResponse } from "next/server";
import { db, plaidItems } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { isLocalPlaidId } from "@/lib/cash";
import { syncKalshiBalance } from "@/lib/kalshi/sync";
import { plaidClient } from "@/lib/plaid/client";
import { syncAllItems, refreshBalances, snapshotBalances, hideDuplicateAccounts } from "@/lib/plaid/sync";

// Manual refresh: ask Plaid to check for new transactions, then pull
// whatever is already available and refresh balances.
export async function POST() {
  const items = await db.select().from(plaidItems);

  for (const item of items) {
    if (isLocalPlaidId(item.plaidItemId)) continue;
    try {
      await plaidClient.transactionsRefresh({
        access_token: decryptToken(item.accessTokenEncrypted),
      });
    } catch {
      // Not supported at all institutions; ignore
    }
  }

  const results = await syncAllItems();
  await refreshBalances();
  const kalshi = await syncKalshiBalance();
  const hiddenDuplicates = await hideDuplicateAccounts();
  await snapshotBalances();

  return NextResponse.json({ ok: true, results, kalshi, hiddenDuplicates });
}
