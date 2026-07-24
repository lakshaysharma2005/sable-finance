import { NextResponse } from "next/server";
import { completeItemUpdate } from "@/lib/plaid/sync";

// Called after Link update mode succeeds (re-link or add accounts to an Item).
// No public_token exchange — the access_token is unchanged.
export async function POST(request: Request) {
  const { itemId } = (await request.json().catch(() => ({}))) as { itemId?: number };
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  try {
    const result = await completeItemUpdate(itemId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: unknown } })?.response?.data ?? String(err);
    console.error("complete-update failed", detail);
    return NextResponse.json({ error: "complete_update_failed", detail }, { status: 500 });
  }
}
