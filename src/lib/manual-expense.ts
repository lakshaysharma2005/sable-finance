import { eq } from "drizzle-orm";
import { db, accounts, balanceSnapshots, plaidItems, transactions } from "@/db";
import {
  CASH_PAY_FROM,
  CASH_PLAID_ACCOUNT_ID,
  CASH_PLAID_ITEM_ID,
} from "@/lib/cash";
import { EXCLUDED_CATEGORIES } from "@/lib/categories";
import { encryptToken } from "@/lib/crypto";

export { CASH_PAY_FROM } from "@/lib/cash";

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ensures a local Cash account exists for manual cash expenses (not linked to Plaid). */
export async function ensureCashAccount(): Promise<{ id: number; name: string }> {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.plaidAccountId, CASH_PLAID_ACCOUNT_ID))
    .limit(1);
  if (existing) {
    // Migrate legacy Cash rows that were stored under "others".
    if (existing.assetCategory !== "cash" || existing.subtype !== "cash") {
      await db
        .update(accounts)
        .set({ assetCategory: "cash", subtype: "cash", updatedAt: new Date() })
        .where(eq(accounts.id, existing.id));
    }
    return { id: existing.id, name: existing.customName ?? existing.name };
  }

  let itemId: number;
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, CASH_PLAID_ITEM_ID))
    .limit(1);

  if (item) {
    itemId = item.id;
  } else {
    const [created] = await db
      .insert(plaidItems)
      .values({
        plaidItemId: CASH_PLAID_ITEM_ID,
        accessTokenEncrypted: encryptToken("local"),
        institutionName: "Cash",
        status: "ok",
      })
      .returning({ id: plaidItems.id });
    itemId = created.id;
  }

  const [row] = await db
    .insert(accounts)
    .values({
      plaidAccountId: CASH_PLAID_ACCOUNT_ID,
      itemId,
      name: "Cash",
      mask: null,
      type: "other",
      subtype: "cash",
      assetCategory: "cash",
      currentBalance: null,
      availableBalance: null,
      color: "#C49A6B",
    })
    .returning();

  return { id: row.id, name: row.customName ?? row.name };
}

/** Set the manually tracked cash-on-hand balance (creates the Cash account if needed). */
export async function setCashBalance(amount: number): Promise<{ id: number; availableBalance: number }> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Balance must be a non-negative number");
  }
  const rounded = Math.round(amount * 100) / 100;
  const cash = await ensureCashAccount();

  await db
    .update(accounts)
    .set({
      assetCategory: "cash",
      subtype: "cash",
      currentBalance: rounded,
      availableBalance: rounded,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, cash.id));

  const today = isoToday();
  await db
    .insert(balanceSnapshots)
    .values({
      accountId: cash.id,
      date: today,
      currentBalance: rounded,
      availableBalance: rounded,
    })
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.date],
      set: {
        currentBalance: rounded,
        availableBalance: rounded,
      },
    });

  return { id: cash.id, availableBalance: rounded };
}

export async function createManualExpense(input: {
  amount: number;
  category: string;
  accountId: number | typeof CASH_PAY_FROM;
}): Promise<{ id: number; accountName: string }> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("Amount must be greater than zero");
  }

  const category = input.category.trim();
  if (!category) throw new Error("Category is required");
  if ((EXCLUDED_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("Cannot use this category for an expense");
  }

  let accountId: number;
  let accountName: string;

  if (input.accountId === CASH_PAY_FROM) {
    const cash = await ensureCashAccount();
    accountId = cash.id;
    accountName = cash.name;
  } else {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.accountId))
      .limit(1);
    if (!account || account.hidden) {
      throw new Error("Account not found");
    }
    accountId = account.id;
    accountName = account.customName ?? account.name;
  }

  const plaidTransactionId = `manual_${crypto.randomUUID()}`;
  const [row] = await db
    .insert(transactions)
    .values({
      plaidTransactionId,
      accountId,
      date: isoToday(),
      name: category,
      merchantName: category,
      amount,
      pending: false,
      category,
      categoryOverride: category,
      removed: false,
      updatedAt: new Date(),
    })
    .returning({ id: transactions.id });

  return {
    id: row.id,
    accountName,
  };
}
