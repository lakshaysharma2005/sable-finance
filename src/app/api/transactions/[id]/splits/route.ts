import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, transactions } from "@/db";
import { upsertSplitsForTransaction, type SplitInput } from "@/lib/splits";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  if (Number.isNaN(txId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    splits?: { id?: number; amount: number; name?: string }[];
  };
  const splits = body.splits;
  if (!Array.isArray(splits)) return NextResponse.json({ error: "splits array required" }, { status: 400 });

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, txId));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });
  const baseAmount = tx.amountOverride ?? tx.amount;
  if (baseAmount <= 0) return NextResponse.json({ error: "only expenses can be split" }, { status: 400 });

  const inputs: SplitInput[] = splits.map((s) => ({
    id: typeof s.id === "number" ? s.id : undefined,
    amount: s.amount,
    name: typeof s.name === "string" ? s.name : "",
  }));

  try {
    const saved = await upsertSplitsForTransaction(txId, baseAmount, inputs);
    const excludedAmount = saved.reduce((sum, s) => sum + s.amount, 0);

    return NextResponse.json({
      ok: true,
      splits: saved.map((s) => ({
        id: s.id,
        amount: s.amount,
        name: s.name,
        settledAmount: s.settledAmount,
        outstanding: s.outstanding,
        paybacks: s.paybacks,
      })),
      excludedAmount,
      effectiveAmount: Math.max(0, baseAmount - excludedAmount),
      originalAmount: tx.amount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to save splits";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
