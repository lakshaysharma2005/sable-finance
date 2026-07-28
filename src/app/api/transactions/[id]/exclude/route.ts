import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, transactions } from "@/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  if (Number.isNaN(txId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { excluded?: boolean };
  if (typeof body.excluded !== "boolean") {
    return NextResponse.json({ error: "excluded boolean required" }, { status: 400 });
  }

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, txId));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .update(transactions)
    .set({ excludedFromSpending: body.excluded, updatedAt: new Date() })
    .where(eq(transactions.id, txId));

  return NextResponse.json({ ok: true, excludedFromSpending: body.excluded });
}
