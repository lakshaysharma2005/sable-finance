import { NextResponse } from "next/server";
import { linkRepayment } from "@/lib/owed";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    splitId?: number;
    transactionId?: number;
    amount?: number;
  };

  const splitId = typeof body.splitId === "number" ? body.splitId : parseInt(String(body.splitId ?? ""), 10);
  const transactionId =
    typeof body.transactionId === "number" ? body.transactionId : parseInt(String(body.transactionId ?? ""), 10);

  if (Number.isNaN(splitId) || Number.isNaN(transactionId)) {
    return NextResponse.json({ error: "splitId and transactionId required" }, { status: 400 });
  }

  const amount =
    body.amount === undefined
      ? undefined
      : typeof body.amount === "number"
        ? body.amount
        : parseFloat(String(body.amount));

  const result = await linkRepayment({
    splitId,
    transactionId,
    amount: Number.isFinite(amount) ? amount : undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
