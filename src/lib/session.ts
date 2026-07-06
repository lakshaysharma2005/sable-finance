import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sable_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

interface SessionPayload {
  authenticated: boolean;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 chars");
  return s;
}

export async function createSessionCookieValue(): Promise<string> {
  const payload: SessionPayload = { authenticated: true };
  return sealData(payload, { password: secret(), ttl: SESSION_TTL_SECONDS });
}

export async function verifySessionCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  try {
    const data = (await unsealData(value, { password: secret(), ttl: SESSION_TTL_SECONDS })) as SessionPayload;
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionCookieValue(store.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
