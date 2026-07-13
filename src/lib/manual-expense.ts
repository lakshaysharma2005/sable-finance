import { eq } from "drizzle-orm";
import { db, accounts, transactions } from "@/db";
import { EXCLUDED_CATEGORIES } from "@/lib/categories";

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createManualExpense(input: {
  amount: number;
  category: string;
  accountId: number;
}): Promise<{ id: number; accountName: string }> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const category = input.category.trim();
  if (!category) throw new Error("Category is required");
  if ((EXCLUDED_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("Cannot use this category for an expense");
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))
    .limit(1);
  if (!account || account.hidden) {
    throw new Error("Account not found");
  }

  const plaidTransactionId = `manual_${crypto.randomUUID()}`;
  const [row] = await db
    .insert(transactions)
    .values({
      plaidTransactionId,
      accountId: account.id,
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
    accountName: account.customName ?? account.name,
  };
}
