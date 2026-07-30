import { BRAND_LOGOS } from "@/lib/brand-logos";
import { initialOf, tint } from "@/lib/format";
import { mono } from "@/lib/ui";

function isVenmoAccount(accountName?: string | null): boolean {
  return !!accountName && /venmo/i.test(accountName);
}

function isCashAccount(accountName?: string | null): boolean {
  return !!accountName && /^cash$/i.test(accountName.trim());
}

function isZelleTransaction(name: string): boolean {
  return /zelle/i.test(name);
}

function isEmpowerTransaction(name: string): boolean {
  return /empower/i.test(name);
}

/** Chase credit-card autopay payments, e.g. "CHASE CREDIT CRD AUTOPAY". */
function isChaseCreditAutopay(name: string): boolean {
  return /chase\s+credit\s+crd(?:\s+autopay)?/i.test(name);
}

// Merchant avatar: Plaid logo when available, otherwise letter initial on a tinted square.
export function TxAvatar({
  name,
  color,
  logoUrl,
  accountName,
  size = 38,
}: {
  name: string;
  color: string;
  logoUrl?: string | null;
  accountName?: string | null;
  size?: number;
}) {
  const resolvedLogo = isVenmoAccount(accountName)
    ? BRAND_LOGOS.venmo
    : isCashAccount(accountName)
      ? BRAND_LOGOS.cash
      : isZelleTransaction(name)
        ? BRAND_LOGOS.zelle
        : isEmpowerTransaction(name)
          ? BRAND_LOGOS.empower
          : isChaseCreditAutopay(name)
            ? BRAND_LOGOS.chase
            : logoUrl;

  if (resolvedLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedLogo}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: 12, flex: "none", objectFit: "cover", background: tint(color) }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...mono(14, 600),
        background: tint(color),
        color,
      }}
    >
      {initialOf(name)}
    </span>
  );
}
