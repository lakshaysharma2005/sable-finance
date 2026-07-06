import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { createSessionCookieValue, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// Naive in-memory rate limit: serverless instances are short-lived, but this
// still blunts rapid brute-force within one instance.
let attempts: { count: number; windowStart: number } = { count: 0, windowStart: 0 };

export async function POST(request: Request) {
  const now = Date.now();
  if (now - attempts.windowStart > 60_000) attempts = { count: 0, windowStart: now };
  attempts.count += 1;
  if (attempts.count > 10) {
    return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const value = await createSessionCookieValue();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, value, sessionCookieOptions);
  return response;
}
