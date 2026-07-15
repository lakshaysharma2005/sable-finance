import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, transactions, transactionSplits } from "@/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  if (Number.isNaN(txId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { amount?: number };
  const parsed = typeof body.amount === "number" ? body.amount : parseFloat(String(body.amount ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, txId));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });

  const splitRows = await db
    .select({ amount: transactionSplits.amount })
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, txId));
  const excludedAmount = splitRows.reduce((sum, s) => sum + s.amount, 0);

  const sign = tx.amount < 0 ? -1 : 1;
  const rounded = Math.round(parsed * 100) / 100;
  // User edits the displayed amount; store override on the full base amount.
  const amountOverride = sign < 0 ? -rounded : rounded + excludedAmount;

  await db
    .update(transactions)
    .set({ amountOverride, updatedAt: new Date() })
    .where(eq(transactions.id, txId));

  const effectiveAmount = sign < 0 ? amountOverride : Math.max(0, amountOverride - excludedAmount);

  return NextResponse.json({
    ok: true,
    amount: effectiveAmount,
    originalAmount: tx.amount,
    amountOverride,
    excludedAmount,
  });
}
