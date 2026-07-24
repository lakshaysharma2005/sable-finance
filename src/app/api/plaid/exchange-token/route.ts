import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, plaidItems } from "@/db";
import { encryptToken } from "@/lib/crypto";
import { plaidClient } from "@/lib/plaid/client";
import {
  hideDuplicateAccounts,
  removeEmptyDuplicateItem,
  snapshotBalances,
  syncItem,
  upsertAccountsForItem,
} from "@/lib/plaid/sync";

export async function POST(request: Request) {
  const { public_token } = (await request.json().catch(() => ({}))) as { public_token?: string };
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  try {
    const { data: exchange } = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = exchange.access_token;

    // Institution metadata
    const { data: itemData } = await plaidClient.itemGet({ access_token: accessToken });
    let institutionName: string | null = null;
    const institutionId = itemData.item.institution_id ?? null;
    if (institutionId) {
      institutionName = itemData.item.institution_name ?? null;
    }

    const [itemRow] = await db
      .insert(plaidItems)
      .values({
        plaidItemId: exchange.item_id,
        accessTokenEncrypted: encryptToken(accessToken),
        institutionId,
        institutionName,
      })
      .onConflictDoUpdate({
        target: plaidItems.plaidItemId,
        set: { accessTokenEncrypted: encryptToken(accessToken), status: "ok" },
      })
      .returning();

    // Accounts — skip ones that already exist under another Item (same bank + mask).
    const { data: accountsData } = await plaidClient.accountsGet({ access_token: accessToken });
    const accountResult = await upsertAccountsForItem(itemRow, accountsData.accounts);

    // If this Link session only re-selected cards we already have, drop the empty Item
    // so we don't leave a useless second Chase connection hanging around.
    if (accountResult.inserted === 0 && accountResult.updated === 0) {
      await removeEmptyDuplicateItem(itemRow);
      await hideDuplicateAccounts();
      return NextResponse.json({
        ok: true,
        item_id: exchange.item_id,
        removed_empty_duplicate: true,
        accounts: accountResult,
      });
    }

    // First transaction pull (more history arrives via webhook)
    const [freshItem] = await db.select().from(plaidItems).where(eq(plaidItems.id, itemRow.id));
    await syncItem(freshItem);
    await hideDuplicateAccounts();
    await snapshotBalances();

    return NextResponse.json({
      ok: true,
      item_id: exchange.item_id,
      accounts: accountResult,
    });
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: unknown } })?.response?.data ?? String(err);
    console.error("exchange failed", detail);
    return NextResponse.json({ error: "exchange_failed", detail }, { status: 500 });
  }
}
