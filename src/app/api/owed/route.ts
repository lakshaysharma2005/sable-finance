import { NextResponse } from "next/server";
import { getOwedSummary, listPriorSplitLabels } from "@/lib/owed";

export async function GET() {
  const [summary, labels] = await Promise.all([getOwedSummary(), listPriorSplitLabels()]);
  return NextResponse.json({ ...summary, labels });
}
