import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, transactions, transactionSplits } from "@/db";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  if (Number.isNaN(txId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { splits?: { amount: number }[] };
  const splits = body.splits;
  if (!Array.isArray(splits)) return NextResponse.json({ error: "splits array required" }, { status: 400 });

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, txId));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });
  const baseAmount = tx.amountOverride ?? tx.amount;
  if (baseAmount <= 0) return NextResponse.json({ error: "only expenses can be split" }, { status: 400 });

  for (const s of splits) {
    if (typeof s.amount !== "number" || s.amount <= 0) {
      return NextResponse.json({ error: "each split amount must be positive" }, { status: 400 });
    }
  }

  const total = splits.reduce((sum, s) => sum + s.amount, 0);
  if (total > baseAmount) {
    return NextResponse.json({ error: "split total exceeds transaction amount" }, { status: 400 });
  }

  await db.delete(transactionSplits).where(eq(transactionSplits.transactionId, txId));

  if (splits.length > 0) {
    await db.insert(transactionSplits).values(
      splits.map((s) => ({
        transactionId: txId,
        amount: Math.round(s.amount * 100) / 100,
      })),
    );
  }

  const saved = await db
    .select({ id: transactionSplits.id, amount: transactionSplits.amount })
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, txId));

  const excludedAmount = saved.reduce((sum, s) => sum + s.amount, 0);

  return NextResponse.json({
    ok: true,
    splits: saved,
    excludedAmount,
    effectiveAmount: Math.max(0, baseAmount - excludedAmount),
    originalAmount: tx.amount,
  });
}
