import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, accounts } from "@/db";

// Rename an account (persists custom_name).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = parseInt(id, 10);
  const { customName } = (await request.json().catch(() => ({}))) as { customName?: string };
  if (!customName?.trim()) {
    return NextResponse.json({ error: "customName required" }, { status: 400 });
  }
  await db
    .update(accounts)
    .set({ customName: customName.trim(), updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
  return NextResponse.json({ ok: true });
}
