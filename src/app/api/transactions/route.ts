import { NextResponse } from "next/server";
import { CASH_PAY_FROM, createManualExpense } from "@/lib/manual-expense";
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
  const month = url.searchParams.get("month") ?? undefined;
  return NextResponse.json(await getTransactionsData(accountIds, { month }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      amount?: number | string;
      category?: string;
      accountId?: number | string;
    };
    const amount = typeof body.amount === "string" ? parseFloat(body.amount) : body.amount;
    if (amount === undefined || Number.isNaN(amount)) {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 });
    }
    if (!body.category?.trim()) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    let accountId: number | typeof CASH_PAY_FROM;
    if (body.accountId === CASH_PAY_FROM || body.accountId === "cash") {
      accountId = CASH_PAY_FROM;
    } else if (body.accountId === undefined || Number.isNaN(Number(body.accountId))) {
      return NextResponse.json({ error: "Account is required" }, { status: 400 });
    } else {
      accountId = Number(body.accountId);
    }

    const result = await createManualExpense({
      amount,
      category: body.category,
      accountId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add expense";
    console.error("POST /api/transactions", e);
    const status =
      msg.includes("required") ||
      msg.includes("greater than") ||
      msg.includes("not found") ||
      msg.includes("Cannot use")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
