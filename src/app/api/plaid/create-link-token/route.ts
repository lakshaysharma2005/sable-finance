import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { eq } from "drizzle-orm";
import { db, plaidItems } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { plaidClient } from "@/lib/plaid/client";

// Creates a link_token. Pass { itemId } to open Link in update mode for re-linking.
export async function POST(request: Request) {
  const { itemId } = (await request.json().catch(() => ({}))) as { itemId?: number };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const base = {
    user: { client_user_id: "sable-user" },
    client_name: "Sable Finance",
    language: "en",
    country_codes: [CountryCode.Us],
    webhook: `${appUrl}/api/plaid/webhook`,
    // Required for OAuth institutions (Chase, BofA, etc.)
    redirect_uri: `${appUrl.replace(/\/$/, "")}/`,
  };

  try {
    if (itemId) {
      const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, itemId));
      if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });
      const { data } = await plaidClient.linkTokenCreate({
        ...base,
        access_token: decryptToken(item.accessTokenEncrypted),
      });
      return NextResponse.json({ link_token: data.link_token });
    }

    const { data } = await plaidClient.linkTokenCreate({
      ...base,
      products: [Products.Transactions],
      transactions: { days_requested: 730 },
    });
    return NextResponse.json({ link_token: data.link_token });
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: unknown } })?.response?.data ?? String(err);
    console.error("link token create failed", detail);
    return NextResponse.json({ error: "link_token_create_failed", detail }, { status: 500 });
  }
}
