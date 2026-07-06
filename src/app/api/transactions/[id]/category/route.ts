import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, transactions, categoryRules } from "@/db";
import { reapplyRuleToExisting } from "@/lib/plaid/sync";

// Change a transaction's category. Optionally create a merchant rule and
// apply it to all existing transactions of that merchant.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  const { category, createRule } = (await request.json().catch(() => ({}))) as {
    category?: string;
    createRule?: boolean;
  };
  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, txId));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .update(transactions)
    .set({ categoryOverride: category, updatedAt: new Date() })
    .where(eq(transactions.id, txId));

  if (createRule) {
    const merchantMatch = (tx.merchantName ?? tx.name).toLowerCase();
    await db
      .insert(categoryRules)
      .values({ merchantMatch, category })
      .onConflictDoUpdate({ target: categoryRules.merchantMatch, set: { category } });
    await reapplyRuleToExisting(merchantMatch, category);
  }

  return NextResponse.json({ ok: true });
}
