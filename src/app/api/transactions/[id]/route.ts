import { NextResponse } from "next/server";
import { getTransactionById } from "@/lib/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const txId = parseInt(id, 10);
  if (Number.isNaN(txId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const tx = await getTransactionById(txId);
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(tx);
}
