import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, transactions } from "@/db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(iso: string): boolean {
  if (!DATE_RE.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  if (Number.isNaN(txId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { date?: string };
  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, txId));
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .update(transactions)
    .set({ dateOverride: date, updatedAt: new Date() })
    .where(eq(transactions.id, txId));

  return NextResponse.json({ ok: true, date });
}
