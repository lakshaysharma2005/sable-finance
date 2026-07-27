import { NextResponse } from "next/server";
import { CountryCode, InvestmentAccountSubtype, Products } from "plaid";
import { eq } from "drizzle-orm";
import { db, plaidItems } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { plaidClient } from "@/lib/plaid/client";

export type LinkProducts = "transactions" | "investments";

// Creates a link_token.
// - No itemId: new Link (connect a bank or brokerage)
// - products: "investments" opens Link for brokerages (Robinhood, etc.); default is bank Transactions
// - itemId: update mode (re-link / repair)
// - itemId + accountSelection: update mode that lets the user share additional accounts
export async function POST(request: Request) {
  const { itemId, accountSelection, products } = (await request.json().catch(() => ({}))) as {
    itemId?: number;
    accountSelection?: boolean;
    products?: LinkProducts;
  };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const linkProducts: LinkProducts = products === "investments" ? "investments" : "transactions";

  const base = {
    user: { client_user_id: "sable-user" },
    client_name: "Sable Finance",
    language: "en",
    country_codes: [CountryCode.Us],
    webhook: `${appUrl}/api/plaid/webhook`,
    // Required for OAuth institutions (Chase, BofA, Robinhood, etc.)
    redirect_uri: `${appUrl.replace(/\/$/, "")}/`,
  };

  try {
    if (itemId) {
      const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, itemId));
      if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });
      const { data } = await plaidClient.linkTokenCreate({
        ...base,
        access_token: decryptToken(item.accessTokenEncrypted),
        ...(accountSelection ? { update: { account_selection_enabled: true } } : {}),
      });
      return NextResponse.json({ link_token: data.link_token });
    }

    if (linkProducts === "investments") {
      // Robinhood and other brokerages need the Investments product; account balance
      // (total portfolio value) comes back on /accounts/get as balances.current.
      const { data } = await plaidClient.linkTokenCreate({
        ...base,
        products: [Products.Investments],
        account_filters: {
          investment: { account_subtypes: [InvestmentAccountSubtype.All] },
        },
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
