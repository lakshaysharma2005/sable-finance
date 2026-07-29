import { NextResponse } from "next/server";
import { getSplitById, linkPayback } from "@/lib/splits";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; splitId: string }> }) {
  const { splitId: splitIdRaw } = await params;
  const splitId = parseInt(splitIdRaw, 10);
  if (Number.isNaN(splitId)) return NextResponse.json({ error: "invalid split id" }, { status: 400 });

  const split = await getSplitById(splitId);
  if (!split) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(split);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; splitId: string }> }) {
  const { id, splitId: splitIdRaw } = await params;
  const txId = parseInt(id, 10);
  const splitId = parseInt(splitIdRaw, 10);
  if (Number.isNaN(txId) || Number.isNaN(splitId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { transactionId?: number; amount?: number };
  if (typeof body.transactionId !== "number") {
    return NextResponse.json({ error: "transactionId required" }, { status: 400 });
  }

  const split = await getSplitById(splitId);
  if (!split) return NextResponse.json({ error: "split not found" }, { status: 404 });
  if (split.transactionId !== txId) {
    return NextResponse.json({ error: "split does not belong to transaction" }, { status: 400 });
  }

  try {
    const updated = await linkPayback(splitId, body.transactionId, body.amount);
    return NextResponse.json({ ok: true, split: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to link payback";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
