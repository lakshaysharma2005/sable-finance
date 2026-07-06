import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, accounts, plaidItems } from "@/db";
import { encryptToken } from "@/lib/crypto";
import { ACCOUNT_COLORS, mapAccountTypeToAssetCategory } from "@/lib/categories";
import { plaidClient } from "@/lib/plaid/client";
import { syncItem, snapshotBalances } from "@/lib/plaid/sync";

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

    // Accounts
    const { data: accountsData } = await plaidClient.accountsGet({ access_token: accessToken });
    const existingCount = (await db.select({ id: accounts.id }).from(accounts)).length;
    let colorIdx = existingCount;
    for (const acct of accountsData.accounts) {
      await db
        .insert(accounts)
        .values({
          plaidAccountId: acct.account_id,
          itemId: itemRow.id,
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
        })
        .onConflictDoUpdate({
          target: accounts.plaidAccountId,
          set: {
            name: acct.name,
            currentBalance: acct.balances.current ?? null,
            availableBalance: acct.balances.available ?? null,
            creditLimit: acct.balances.limit ?? null,
            updatedAt: new Date(),
          },
        });
    }

    // First transaction pull (more history arrives via webhook)
    const [freshItem] = await db.select().from(plaidItems).where(eq(plaidItems.id, itemRow.id));
    await syncItem(freshItem);
    await snapshotBalances();

    return NextResponse.json({ ok: true, item_id: exchange.item_id });
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: unknown } })?.response?.data ?? String(err);
    console.error("exchange failed", detail);
    return NextResponse.json({ error: "exchange_failed", detail }, { status: 500 });
  }
}
