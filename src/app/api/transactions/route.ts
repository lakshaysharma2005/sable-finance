import { NextResponse } from "next/server";
import { getTransactionsData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const acctParam = url.searchParams.get("accounts");
  const accountIds = acctParam
    ? acctParam
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n))
    : undefined;
  return NextResponse.json(await getTransactionsData(accountIds));
}
