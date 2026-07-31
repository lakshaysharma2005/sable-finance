import { NextResponse } from "next/server";
import { setSplitSettled } from "@/lib/owed";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const splitId = parseInt(id, 10);
  if (Number.isNaN(splitId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { settled?: boolean };
  if (typeof body.settled !== "boolean") {
    return NextResponse.json({ error: "settled boolean required" }, { status: 400 });
  }

  const result = await setSplitSettled(splitId, body.settled);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
