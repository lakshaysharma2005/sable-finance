import { NextResponse } from "next/server";
import { getSplitById, unlinkPayback } from "@/lib/splits";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; splitId: string; paybackId: string }> },
) {
  const { id, splitId: splitIdRaw, paybackId: paybackIdRaw } = await params;
  const txId = parseInt(id, 10);
  const splitId = parseInt(splitIdRaw, 10);
  const paybackId = parseInt(paybackIdRaw, 10);
  if (Number.isNaN(txId) || Number.isNaN(splitId) || Number.isNaN(paybackId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const split = await getSplitById(splitId);
  if (!split) return NextResponse.json({ error: "split not found" }, { status: 404 });
  if (split.transactionId !== txId) {
    return NextResponse.json({ error: "split does not belong to transaction" }, { status: 400 });
  }

  try {
    const updated = await unlinkPayback(splitId, paybackId);
    return NextResponse.json({ ok: true, split: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to unlink payback";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
