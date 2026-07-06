import { NextResponse } from "next/server";
import { db, reviewedDays } from "@/db";

// Mark a day as reviewed (Dashboard "To Review" stack).
export async function POST(request: Request) {
  const { day } = (await request.json().catch(() => ({}))) as { day?: string };
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "day (YYYY-MM-DD) required" }, { status: 400 });
  }
  await db.insert(reviewedDays).values({ day }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
