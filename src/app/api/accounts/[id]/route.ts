import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, accounts, balanceSnapshots } from "@/db";
import { CASH_PLAID_ACCOUNT_ID } from "@/lib/cash";
import { setCashBalance } from "@/lib/manual-expense";

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function snapshotAccountToday(accountId: number, currentBalance: number, availableBalance: number) {
  const today = isoToday();
  await db
    .insert(balanceSnapshots)
    .values({
      accountId,
      date: today,
      currentBalance,
      availableBalance,
    })
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.date],
      set: { currentBalance, availableBalance },
    });
}

// Rename an account, or update Cash balance.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = parseInt(id, 10);
  if (!Number.isFinite(accountId)) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    customName?: string;
    balance?: number;
  };

  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account || account.hidden) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (body.balance !== undefined) {
    if (account.plaidAccountId !== CASH_PLAID_ACCOUNT_ID) {
      return NextResponse.json({ error: "Balance can only be set for Cash" }, { status: 400 });
    }
    const balance = Number(body.balance);
    if (!Number.isFinite(balance) || balance < 0) {
      return NextResponse.json({ error: "balance must be a non-negative number" }, { status: 400 });
    }
    const { id: cashId } = await setCashBalance(balance);
    const rounded = Math.round(balance * 100) / 100;
    await snapshotAccountToday(cashId, rounded, rounded);
    return NextResponse.json({ ok: true });
  }

  if (!body.customName?.trim()) {
    return NextResponse.json({ error: "customName required" }, { status: 400 });
  }
  await db
    .update(accounts)
    .set({ customName: body.customName.trim(), updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
  return NextResponse.json({ ok: true });
}
