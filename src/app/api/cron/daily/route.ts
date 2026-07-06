import { NextResponse } from "next/server";
import { syncAllItems, refreshBalances, snapshotBalances } from "@/lib/plaid/sync";

// Daily cron (vercel.json): fallback sync in case webhooks were missed,
// balance refresh, and the daily balance snapshot for trend charts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await syncAllItems();
  await refreshBalances();
  await snapshotBalances();

  return NextResponse.json({ ok: true, results });
}
