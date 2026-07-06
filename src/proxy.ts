import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionCookieValue } from "@/lib/session";

// Routes reachable without a session. The Plaid webhook authenticates via
// JWT signature verification; the cron route via CRON_SECRET.
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/plaid/webhook",
  "/api/cron/daily",
  "/manifest.webmanifest",
  "/sw.js",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  const authed = await verifySessionCookieValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
