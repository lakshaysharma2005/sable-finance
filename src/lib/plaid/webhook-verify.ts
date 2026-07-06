import { createHash } from "crypto";
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";
import { plaidClient } from "./client";

// Verify a Plaid webhook per https://plaid.com/docs/api/webhooks/webhook-verification/
// The Plaid-Verification header is a JWT (ES256) whose payload contains
// request_body_sha256; the signing key is fetched from Plaid by key id.

const keyCache = new Map<string, JWK>();

export async function verifyPlaidWebhook(body: string, jwtToken: string | null): Promise<boolean> {
  if (!jwtToken) return false;
  try {
    const header = decodeProtectedHeader(jwtToken);
    if (header.alg !== "ES256" || typeof header.kid !== "string") return false;

    let jwk = keyCache.get(header.kid);
    if (!jwk) {
      const { data } = await plaidClient.webhookVerificationKeyGet({ key_id: header.kid });
      jwk = data.key as unknown as JWK;
      keyCache.set(header.kid, jwk);
    }

    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(jwtToken, key, { maxTokenAge: "5 min" });

    const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
    return payload.request_body_sha256 === bodyHash;
  } catch {
    return false;
  }
}
