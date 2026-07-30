import { NextResponse } from "next/server";
import { setCashBalance } from "@/lib/manual-expense";

export const dynamic = "force-dynamic";

/** Create/ensure the local Cash account and set its manually tracked balance. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { balance?: number };
  const balance = Number(body.balance);
  if (!Number.isFinite(balance)) {
    return NextResponse.json({ error: "balance required" }, { status: 400 });
  }
  try {
    const result = await setCashBalance(balance);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to set cash balance";
    console.error("POST /api/accounts/cash", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
