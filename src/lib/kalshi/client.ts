import { constants, createPrivateKey, sign } from "crypto";

const PRODUCTION_BASE = "https://external-api.kalshi.com/trade-api/v2";
const BALANCE_PATH = "/portfolio/balance";

export interface KalshiBalance {
  /** Cash available for trading (USD). */
  available: number;
  /** Cash + open position value (USD). */
  total: number;
}

function envKeyId(): string | undefined {
  const id = process.env.KALSHI_API_KEY_ID?.trim();
  return id || undefined;
}

function envPrivateKeyPem(): string | undefined {
  const raw = process.env.KALSHI_PRIVATE_KEY?.trim();
  if (!raw) return undefined;
  // .env often stores PEM with literal \n escapes
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function isKalshiConfigured(): boolean {
  return Boolean(envKeyId() && envPrivateKeyPem());
}

function signRequest(timestampMs: string, method: string, path: string): string {
  const pem = envPrivateKeyPem();
  if (!pem) throw new Error("KALSHI_PRIVATE_KEY is not set");

  const key = createPrivateKey(pem);
  const message = `${timestampMs}${method.toUpperCase()}${path.split("?")[0]}`;
  const signature = sign("sha256", Buffer.from(message, "utf8"), {
    key,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
  });
  return signature.toString("base64");
}

function authHeaders(method: string, apiPath: string): Record<string, string> {
  const keyId = envKeyId();
  if (!keyId) throw new Error("KALSHI_API_KEY_ID is not set");

  // Sign the full path from the API root (includes /trade-api/v2 prefix).
  const signPath = `/trade-api/v2${apiPath.split("?")[0]}`;
  const timestamp = String(Date.now());
  return {
    "KALSHI-ACCESS-KEY": keyId,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": signRequest(timestamp, method, signPath),
    Accept: "application/json",
  };
}

/** Fetch cash + portfolio value from Kalshi (amounts in USD). */
export async function fetchKalshiBalance(): Promise<KalshiBalance> {
  const base = (process.env.KALSHI_API_BASE_URL?.trim() || PRODUCTION_BASE).replace(/\/$/, "");
  const url = `${base}${BALANCE_PATH}`;
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders("GET", BALANCE_PATH),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kalshi balance failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    balance?: number;
    portfolio_value?: number;
    balance_dollars?: string;
  };

  const availableCents = Number(data.balance ?? 0);
  const portfolioCents = Number(data.portfolio_value ?? 0);
  const available =
    data.balance_dollars != null && data.balance_dollars !== ""
      ? Number(data.balance_dollars)
      : availableCents / 100;
  const portfolio = portfolioCents / 100;
  const total = (Number.isFinite(available) ? available : 0) + (Number.isFinite(portfolio) ? portfolio : 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    available: round2(Number.isFinite(available) ? available : 0),
    total: round2(total),
  };
}
