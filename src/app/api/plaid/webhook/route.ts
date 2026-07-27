import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, plaidItems } from "@/db";
import { verifyPlaidWebhook } from "@/lib/plaid/webhook-verify";
import { syncItemByPlaidId, refreshBalances, refreshBalancesForPlaidItem, snapshotBalances } from "@/lib/plaid/sync";

export async function POST(request: Request) {
  const body = await request.text();
  const verified = await verifyPlaidWebhook(body, request.headers.get("plaid-verification"));
  if (!verified) {
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
  }

  const payload = JSON.parse(body) as {
    webhook_type: string;
    webhook_code: string;
    item_id?: string;
    error?: { error_code?: string } | null;
  };

  try {
    if (payload.webhook_type === "TRANSACTIONS" && payload.webhook_code === "SYNC_UPDATES_AVAILABLE") {
      if (payload.item_id) {
        await syncItemByPlaidId(payload.item_id);
        await refreshBalances();
      }
    } else if (
      (payload.webhook_type === "HOLDINGS" || payload.webhook_type === "INVESTMENTS_TRANSACTIONS") &&
      payload.webhook_code === "DEFAULT_UPDATE" &&
      payload.item_id
    ) {
      // Overnight Investments update — refresh Robinhood / brokerage portfolio balances.
      await refreshBalancesForPlaidItem(payload.item_id);
      await snapshotBalances();
    } else if (payload.webhook_type === "ITEM") {
      if (payload.webhook_code === "ERROR" && payload.error?.error_code === "ITEM_LOGIN_REQUIRED" && payload.item_id) {
        await db
          .update(plaidItems)
          .set({ status: "login_required" })
          .where(eq(plaidItems.plaidItemId, payload.item_id));
      } else if (payload.webhook_code === "LOGIN_REPAIRED" && payload.item_id) {
        await db.update(plaidItems).set({ status: "ok" }).where(eq(plaidItems.plaidItemId, payload.item_id));
      }
    }
  } catch (err) {
    // Always 200 after verification so Plaid doesn't disable the webhook;
    // failures are retried on the next webhook or daily cron.
    console.error("webhook handling failed", err);
  }

  return NextResponse.json({ ok: true });
}
