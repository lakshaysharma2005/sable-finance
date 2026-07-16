import { initialOf, tint } from "@/lib/format";
import { mono } from "@/lib/ui";

const VENMO_LOGO = "/icons/venmo.png";

function isVenmoAccount(accountName?: string | null): boolean {
  return !!accountName && /venmo/i.test(accountName);
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
  const resolvedLogo = isVenmoAccount(accountName) ? VENMO_LOGO : logoUrl;

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
