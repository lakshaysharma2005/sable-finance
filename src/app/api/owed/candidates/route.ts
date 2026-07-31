import { NextResponse } from "next/server";
import { listRepaymentCandidates } from "@/lib/owed";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  const candidates = await listRepaymentCandidates({
    q,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return NextResponse.json({ candidates });
}
