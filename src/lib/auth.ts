import { scryptSync, timingSafeEqual } from "crypto";

// Verify the single-user password against APP_PASSWORD_HASH (salt:hash hex, scrypt).
export function verifyPassword(password: string): boolean {
  const stored = process.env.APP_PASSWORD_HASH;
  if (!stored) throw new Error("APP_PASSWORD_HASH is not set");
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
