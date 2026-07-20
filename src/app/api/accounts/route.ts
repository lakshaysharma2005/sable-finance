import { NextResponse } from "next/server";
import { syncKalshiBalance } from "@/lib/kalshi/sync";
import { getAccountsData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  // Best-effort refresh so Betting balance stays current without a full sync.
  await syncKalshiBalance();
  return NextResponse.json(await getAccountsData());
}
