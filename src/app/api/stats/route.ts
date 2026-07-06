import { NextResponse } from "next/server";
import { getStatsData, type StatsRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") ?? "month") as StatsRange;
  if (!["week", "month", "year"].includes(range)) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }
  return NextResponse.json(await getStatsData(range));
}
