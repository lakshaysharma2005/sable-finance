import { NextResponse } from "next/server";
import { listPaybackCandidates } from "@/lib/splits";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  const candidates = await listPaybackCandidates({
    q,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({ candidates });
}
