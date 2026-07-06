import { NextResponse } from "next/server";
import { db, plaidItems } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { plaidClient } from "@/lib/plaid/client";
import { syncAllItems, refreshBalances, snapshotBalances } from "@/lib/plaid/sync";

// Manual refresh: ask Plaid to check for new transactions, then pull
// whatever is already available and refresh balances.
export async function POST() {
  const items = await db.select().from(plaidItems);

  for (const item of items) {
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
  await snapshotBalances();

  return NextResponse.json({ ok: true, results });
}
