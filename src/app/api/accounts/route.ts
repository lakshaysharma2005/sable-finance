import { NextResponse } from "next/server";
import { syncKalshiBalance } from "@/lib/kalshi/sync";
import { ensureCashAccount } from "@/lib/manual-expense";
import { getAccountsData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  // Ensure Cash wallet exists so it always appears under Accounts.
  await ensureCashAccount();
  // Best-effort refresh so Betting balance stays current without a full sync.
  await syncKalshiBalance();
  return NextResponse.json(await getAccountsData());
}
