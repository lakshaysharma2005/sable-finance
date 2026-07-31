import { NextResponse } from "next/server";
import { unlinkRepayment } from "@/lib/owed";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repaymentId = parseInt(id, 10);
  if (Number.isNaN(repaymentId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const result = await unlinkRepayment(repaymentId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
